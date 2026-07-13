function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object")
    return Object.values(value).every((item) => isEmptyValue(item));
  return false;
}

function pathHasNonEmptyValue(ctx, field) {
  const got = ctx.get(field);
  if (got.ok) return !isEmptyValue(got.value);

  const payloadKeys = Array.isArray(ctx.payloadKeys)
    ? ctx.payloadKeys
    : Object.keys(ctx.payload ?? {});
  const objectPrefix = `${field}.`;
  const arrayPrefix = `${field}[`;
  return payloadKeys
    .filter(
      (key) =>
        key === field ||
        key.startsWith(objectPrefix) ||
        key.startsWith(arrayPrefix),
    )
    .some((key) => {
      const nested = ctx.get(key);
      return nested.ok && !isEmptyValue(nested.value);
    });
}

function checksum10(inn10) {
  const d = inn10.split("").map(Number);
  const w = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  let s = 0;
  for (let i = 0; i < 9; i += 1) s += w[i] * d[i];
  return (s % 11) % 10;
}

function checksum11(inn12) {
  const d = inn12.split("").map(Number);
  const w = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8, 0];
  let s = 0;
  for (let i = 0; i < 11; i += 1) s += w[i] * d[i];
  return (s % 11) % 10;
}

function checksum12(inn12) {
  const d = inn12.split("").map(Number);
  const w = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8, 0];
  let s = 0;
  for (let i = 0; i < 11; i += 1) s += w[i] * d[i];
  return (s % 11) % 10;
}

function validInn(rule, ctx) {
  try {
    const got = ctx.get(rule.field);
    if (!got.ok) return { status: "FAIL" };
    const inn = String(got.value ?? "");
    if (!/^\d+$/.test(inn)) return { status: "FAIL" };
    if (inn.length === 10)
      return { status: checksum10(inn) === Number(inn[9]) ? "OK" : "FAIL" };
    if (inn.length === 12) {
      const c11 = checksum11(inn);
      const c12 = checksum12(inn);
      return {
        status:
          c11 === Number(inn[10]) && c12 === Number(inn[11]) ? "OK" : "FAIL",
      };
    }
    return { status: "FAIL" };
  } catch (error) {
    return { status: "EXCEPTION", error };
  }
}

function validOgrn(rule, ctx) {
  try {
    const got = ctx.get(rule.field);
    if (!got.ok) return { status: "FAIL" };
    const s = String(got.value ?? "");
    if (!/^\d+$/.test(s)) return { status: "FAIL" };
    if (s.length === 13) {
      const n = BigInt(s.slice(0, 12));
      const cd = Number((n % 11n) % 10n);
      return { status: cd === Number(s[12]) ? "OK" : "FAIL" };
    }
    if (s.length === 15) {
      const n = BigInt(s.slice(0, 14));
      const cd = Number((n % 13n) % 10n);
      return { status: cd === Number(s[14]) ? "OK" : "FAIL" };
    }
    return { status: "FAIL" };
  } catch (error) {
    return { status: "EXCEPTION", error };
  }
}

function notInDictionary(rule, ctx) {
  try {
    const got = ctx.get(rule.field);
    if (!got.ok) return { status: "UNDEFINED" };
    const dictRef = rule.dictionary;
    if (!dictRef || dictRef.type !== "static") {
      return {
        status: "EXCEPTION",
        error: new Error("Only static dictionary supported"),
      };
    }
    const dict = ctx.getDictionary(dictRef.id);
    if (!dict) {
      return {
        status: "EXCEPTION",
        error: new Error(`Dictionary not found: ${dictRef.id}`),
      };
    }
    const value = got.value;
    const entries = Array.isArray(dict.entries) ? dict.entries : [];
    const found = entries.some((entry) =>
      typeof entry === "string"
        ? entry === value
        : entry.code === value || entry.value === value,
    );
    return { status: found ? "FALSE" : "TRUE" };
  } catch (error) {
    return { status: "EXCEPTION", error };
  }
}

function absent(rule, ctx) {
  try {
    return pathHasNonEmptyValue(ctx, rule.field)
      ? { status: "FAIL" }
      : { status: "OK" };
  } catch (error) {
    return { status: "EXCEPTION", error };
  }
}

function notTrue(rule, ctx) {
  try {
    const got = ctx.get(rule.field);
    if (
      !got.ok ||
      got.value === null ||
      got.value === undefined ||
      got.value === ""
    )
      return { status: "UNDEFINED" };
    return got.value === true ? { status: "FAIL" } : { status: "OK" };
  } catch (error) {
    return { status: "EXCEPTION", error };
  }
}

function isBoolean(rule, ctx) {
  try {
    const got = ctx.get(rule.field);
    if (!got.ok) return { status: "FAIL" };
    return typeof got.value === "boolean"
      ? { status: "OK" }
      : { status: "FAIL" };
  } catch (error) {
    return { status: "EXCEPTION", error };
  }
}

function isBooleanPredicate(rule, ctx) {
  try {
    const got = ctx.get(rule.field);
    if (!got.ok) return { status: "UNDEFINED" };
    return typeof got.value === "boolean"
      ? { status: "TRUE" }
      : { status: "FALSE" };
  } catch (error) {
    return { status: "EXCEPTION", error };
  }
}

function parseIsoDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function addYears(date, years) {
  const result = new Date(
    Date.UTC(
      date.getUTCFullYear() + years,
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
  if (result.getUTCMonth() !== date.getUTCMonth()) {
    result.setUTCDate(0);
  }
  return result;
}

function addDays(date, days) {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getDateField(ctx, field) {
  const got = ctx.get(field);
  if (!got.ok) return { ok: false, missing: true };
  const date = parseIsoDate(got.value);
  if (!date) return { ok: false, missing: false };
  return { ok: true, date };
}

function passportRfIssuedAtOrAfterAge(rule, ctx) {
  try {
    const birth = getDateField(ctx, rule.birthDateField);
    const issue = getDateField(ctx, rule.field);
    if (!birth.ok || !issue.ok) return { status: "UNDEFINED" };
    const minIssueDate = addYears(birth.date, Number(rule.ageYears));
    return { status: issue.date >= minIssueDate ? "OK" : "FAIL" };
  } catch (error) {
    return { status: "EXCEPTION", error };
  }
}

function passportRfValidAfterReplacementAge(rule, ctx) {
  try {
    const birth = getDateField(ctx, rule.birthDateField);
    const issue = getDateField(ctx, rule.issueDateField);
    const current = getDateField(ctx, rule.currentDateField);
    if (!birth.ok || !issue.ok || !current.ok) return { status: "UNDEFINED" };
    const replacementBirthday = addYears(birth.date, Number(rule.ageYears));
    if (current.date < replacementBirthday) return { status: "OK" };
    if (issue.date >= replacementBirthday) return { status: "OK" };
    const validThrough = addDays(
      replacementBirthday,
      Number(rule.graceDays ?? 90),
    );
    return { status: current.date <= validThrough ? "OK" : "FAIL" };
  } catch (error) {
    return { status: "EXCEPTION", error };
  }
}

module.exports = {
  check: {
    valid_inn: validInn,
    valid_ogrn: validOgrn,
    absent,
    not_true: notTrue,
    is_boolean: isBoolean,
    passport_rf_issued_at_or_after_age: passportRfIssuedAtOrAfterAge,
    passport_rf_valid_after_replacement_age: passportRfValidAfterReplacementAge,
  },
  predicate: {
    is_boolean: isBooleanPredicate,
    not_in_dictionary: notInDictionary,
  },
  meta: {
    operators: {
      valid_inn: { description: "ИНН корректен по контрольным разрядам" },
      valid_ogrn: {
        description: "ОГРН/ОГРНИП корректен по контрольному разряду",
      },
      absent: { description: "Поле отсутствует или пустое" },
      not_true: {
        description:
          "Значение не равно true; отсутствие поля не считается нарушением",
      },
      is_boolean: {
        title: "значение является логическим признаком",
        description: "является флагом (true или false)",
      },
      passport_rf_issued_at_or_after_age: {
        title: "паспорт РФ выдан не раньше даты достижения возраста",
        description:
          "Паспорт РФ выдан не раньше даты достижения заданного возраста",
        template: "Паспорт РФ выдан не раньше даты {ageYears}-летия",
      },
      passport_rf_valid_after_replacement_age: {
        title: "паспорт РФ действителен после возраста обязательной замены",
        description:
          "Паспорт РФ выдан после возраста обязательной замены или действует в допустимый период замены",
        template:
          "Паспорт РФ выдан после {ageYears}-летия или дата заявки попадает в {graceDays}-дневный период замены",
      },
      not_in_dictionary: { description: "значение не входит в справочник" },
    },
  },
};
