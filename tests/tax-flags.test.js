"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createEngine } = require("@jsonspecs/rules");

const engine = createEngine({ operators: require("../operators/node") });
const prepared = engine.compileSnapshot(require("../dist/snapshot.json"));

const fields = [
  ["foreignTaxResident", "FOREIGN_TAX_RESIDENT"],
  ["usTaxResident", "US_TAX_RESIDENT"],
  ["usResident", "US_RESIDENT"],
];
const registrations = [
  ["ФЛ-резидент", require("../samples/fl-resident.ok.json")],
  ["ФЛ-нерезидент", require("../samples/fl-nonresident.ok.json")],
  ["ИП-резидент", require("../samples/ip-resident.ok.json")],
  ["ИП-нерезидент", require("../samples/ip-nonresident.ok.json")],
];
const updates = [
  ["ФЛ-резидент", require("../samples/update.fl_resident.ok-email-only.json"), fields],
  ["ФЛ-нерезидент", require("../samples/update.fl_nonresident.ok-email-only.json"), fields.slice(1)],
  ["ИП-резидент", require("../samples/update.ip_resident.ok-email-only.json"), fields],
];
const nonresidentRegistrations = registrations.filter(([, sample]) =>
  sample.payload.beneficiary.type.endsWith("_NONRESIDENT"));

function evaluate(sample, mutate = () => {}) {
  const payload = structuredClone(sample.payload);
  mutate(payload.beneficiary);
  return engine.runPipeline(prepared, { pipelineId: sample.pipelineId, payload, context: sample.context });
}
function issues(result) {
  return result.issues.map(({ code, field, level }) => [code, field, level]);
}
function error(result, code, field) {
  assert.equal(result.status, "ERROR");
  assert.deepEqual(issues(result), [[code, field, "ERROR"]]);
}
function setOrDelete(object, field, value) {
  if (value === undefined) delete object[field];
  else object[field] = value;
}
const label = (value) => value === undefined ? "пропуск" : JSON.stringify(value);

for (const [title, sample] of registrations) {
  test(`${title}: корректные логические признаки проходят`, () => {
    assert.equal(evaluate(sample).status, "OK");
  });
  for (const [field, codePart] of fields) {
    for (const value of [undefined, null, ""]) {
      test(`${title}: ${field}=${label(value)} — ERROR/REQUIRED`, () => {
        error(evaluate(sample, b => setOrDelete(b.tax, field, value)),
          `BEN.TAX.${codePart}.REQUIRED`, `beneficiary.tax.${field}`);
      });
    }
    for (const value of ["false", "true", 0, 1, [], {}]) {
      test(`${title}: ${field}=${label(value)} — ERROR/BOOL`, () => {
        error(evaluate(sample, b => { b.tax[field] = value; }),
          `BEN.TAX.${codePart}.BOOL`, `beneficiary.tax.${field}`);
      });
    }
  }
  for (const value of [undefined, null, "", {}, []]) {
    test(`${title}: tax=${label(value)} перечисляет все обязательные налоговые поля`, () => {
      const result = evaluate(sample, b => setOrDelete(b, "tax", value));
      const expected = fields.map(([field, codePart]) =>
        [`BEN.TAX.${codePart}.REQUIRED`, `beneficiary.tax.${field}`, "ERROR"]);
      if (sample.payload.beneficiary.type.endsWith("_NONRESIDENT")) {
        expected.push(["BEN.TAX.FOREIGN_COUNTRY.REQUIRED", "beneficiary.tax.foreignTaxResidency.countryCode", "ERROR"],
          ["BEN.TAX.FOREIGN_TIN.OR_REASON", null, "ERROR"]);
      }
      assert.equal(result.status, "ERROR");
      assert.deepEqual(issues(result), expected);
    });
  }
  for (const [field, codePart] of fields.slice(1)) {
    test(`${title}: реальный ${field}=true остаётся EXCEPTION`, () => {
      const result = evaluate(sample, b => { b.tax[field] = true; });
      assert.equal(result.status, "EXCEPTION");
      assert.equal(result.issues.length, 1);
      assert(result.issues[0].code.endsWith(`BEN.TAX.${codePart}.NOT_TRUE`));
      assert.equal(result.issues[0].level, "EXCEPTION");
    });
  }
  test(`${title}: ошибки данных не отменяют реальный комплаенс-запрет`, () => {
    const result = evaluate(sample, b => {
      delete b.tax.foreignTaxResident;
      b.contacts.phone = "79123456789";
      b.tax.usResident = true;
    });
    assert.equal(result.status, "EXCEPTION");
    assert(result.issues.some(i => i.code === "BEN.TAX.FOREIGN_TAX_RESIDENT.REQUIRED" && i.level === "ERROR"));
    assert(result.issues.some(i => i.code.endsWith("BEN.TAX.US_RESIDENT.NOT_TRUE") && i.level === "EXCEPTION"));
  });
  test(`${title}: ограничение значения foreignTaxResident не ослаблено`, () => {
    const nonresident = sample.payload.beneficiary.type.endsWith("_NONRESIDENT");
    const result = evaluate(sample, b => { b.tax.foreignTaxResident = !nonresident; });
    assert.equal(result.status, "EXCEPTION");
    assert.equal(result.issues.length, 1);
    assert(result.issues[0].code.endsWith(nonresident
      ? "BEN.TAX.FOREIGN_TAX_RESIDENT.MUST_BE_TRUE"
      : "BEN.TAX.FOREIGN_TAX_RESIDENT.NOT_TRUE"));
    assert.equal(result.issues[0].level, "EXCEPTION");
  });
}

for (const [title, sample, supportedFields] of updates) {
  for (const tax of [undefined, {}]) {
    test(`${title}: update без налоговых полей (${label(tax)}) не требует их заполнения`, () => {
      assert.equal(evaluate(sample, b => setOrDelete(b, "tax", tax)).status, "OK");
    });
  }
  for (const [field, codePart] of supportedFields) {
    for (const value of [null, "", "false", "true", 0, 1, [], {}]) {
      test(`${title}: update ${field}=${label(value)} — ERROR/BOOL`, () => {
        error(evaluate(sample, b => { b.tax = { [field]: value }; }),
          `BEN.TAX.${codePart}.BOOL`, `beneficiary.tax.${field}`);
      });
    }
    test(`${title}: update ${field}=false не считается отсутствующим`, () => {
      assert.equal(evaluate(sample, b => { b.tax = { [field]: false }; }).status, "OK");
    });
    test(`${title}: update ${field}=true сохраняет EXCEPTION`, () => {
      const result = evaluate(sample, b => { b.tax = { [field]: true }; });
      assert.equal(result.status, "EXCEPTION");
      assert.equal(result.issues.length, 1);
      assert(result.issues[0].code.endsWith(`BEN.TAX.${codePart}.NOT_TRUE`));
      assert.equal(result.issues[0].level, "EXCEPTION");
    });
  }
}

for (const [title, sample] of nonresidentRegistrations) {
  for (const value of [undefined, null, ""]) {
    test(`${title}: отсутствующая иностранная налоговая страна ${label(value)} — ERROR`, () => {
      const result = evaluate(sample, b => setOrDelete(b.tax.foreignTaxResidency, "countryCode", value));
      const field = "beneficiary.tax.foreignTaxResidency.countryCode";
      const expected = [["BEN.TAX.FOREIGN_COUNTRY.REQUIRED", field, "ERROR"]];
      // После ERROR исполнение продолжается: переданные null/пустая строка также
      // нарушают существующую проверку формата. Само правило FORMAT не меняем.
      if (value !== undefined) expected.push(["BEN.TAX.FOREIGN_COUNTRY.FORMAT", field, "ERROR"]);
      assert.equal(result.status, "ERROR");
      assert.deepEqual(issues(result), expected);
    });
    test(`${title}: нет иностранного ИНН и причины ${label(value)} — ERROR`, () => {
      error(evaluate(sample, b => {
        setOrDelete(b.tax.foreignTaxResidency, "tin", value);
        setOrDelete(b.tax.foreignTaxResidency, "tinAbsenceReason", value);
      }), "BEN.TAX.FOREIGN_TIN.OR_REASON", null);
    });
  }
  for (const value of ["INVALID", "D", 0, true, [], {}]) {
    test(`${title}: недопустимая причина отсутствия ИНН ${label(value)} — ERROR`, () => {
      error(evaluate(sample, b => {
        delete b.tax.foreignTaxResidency.tin;
        b.tax.foreignTaxResidency.tinAbsenceReason = value;
      }), "BEN.TAX.TIN_ABSENCE_REASON.DICT", "beneficiary.tax.foreignTaxResidency.tinAbsenceReason");
    });
  }
  for (const reason of ["A", "B", "C"]) {
    test(`${title}: допустимая причина ${reason} заменяет иностранный ИНН`, () => {
      assert.equal(evaluate(sample, b => {
        delete b.tax.foreignTaxResidency.tin;
        b.tax.foreignTaxResidency.tinAbsenceReason = reason;
      }).status, "OK");
    });
  }
  test(`${title}: неизвестная причина не игнорируется даже при переданном ИНН`, () => {
    error(evaluate(sample, b => { b.tax.foreignTaxResidency.tinAbsenceReason = "INVALID"; }),
      "BEN.TAX.TIN_ABSENCE_REASON.DICT", "beneficiary.tax.foreignTaxResidency.tinAbsenceReason");
  });
  test(`${title}: US в налоговой стране сохраняет EXCEPTION`, () => {
    const result = evaluate(sample, b => { b.tax.foreignTaxResidency.countryCode = "US"; });
    assert.equal(result.status, "EXCEPTION");
    assert.deepEqual(issues(result), [["BEN.TAX.FOREIGN_COUNTRY.NOT_US",
      "beneficiary.tax.foreignTaxResidency.countryCode", "EXCEPTION"]]);
  });
  test(`${title}: отсутствие иностранных налогового и почтового адресов допустимо`, () => {
    assert.equal(evaluate(sample, b => {
      delete b.tax.foreignTaxResidency.address;
      delete b.contacts.postalAddress;
      delete b.contacts.postalAddressCountryCode;
    }).status, "OK");
  });
  test(`${title}: почтовый адрес не делает иностранный налоговый адрес обязательным`, () => {
    assert.equal(evaluate(sample, b => {
      delete b.tax.foreignTaxResidency.address;
      b.contacts.postalAddress = "Республика Таджикистан, Душанбе";
      b.contacts.postalAddressCountryCode = "TJ";
    }).status, "OK");
  });
}

test("PAY-996 / BEN-BUG-001: смешанный пример возвращает все шесть исправимых ошибок", () => {
  const result = evaluate(registrations[0][1], b => {
    delete b.tax;
    b.contacts.phone = "79123456789";
    b.idDoc.series = "123456";
    b.idDoc.number = "1234";
  });
  assert.equal(result.status, "ERROR");
  assert.deepEqual(result.issues.map(i => [i.code, i.level]), [
    ["BEN.CONTACTS.PHONE.RU_LOCAL_FORMAT", "ERROR"],
    ["BEN.IDDOC.SERIES.PASSPORT_RF.FORMAT", "ERROR"],
    ["BEN.IDDOC.NUMBER.PASSPORT_RF.FORMAT", "ERROR"],
    ...fields.map(([, codePart]) => [`BEN.TAX.${codePart}.REQUIRED`, "ERROR"]),
  ]);
});
