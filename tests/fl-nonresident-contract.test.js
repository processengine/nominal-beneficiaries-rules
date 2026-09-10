"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createEngine } = require("@jsonspecs/rules");

const engine = createEngine({ operators: require("../operators/node") });
const prepared = engine.compileSnapshot(require("../dist/snapshot.json"));
const sample = require("../samples/fl-nonresident.ok.json");

function evaluate(mutator) {
  const payload = structuredClone(sample.payload);
  mutator(payload.beneficiary);
  return engine.runPipeline(prepared, {
    pipelineId: sample.pipelineId,
    payload,
    context: sample.context,
  });
}

function evaluateUpdate(citizenshipCode) {
  return engine.runPipeline(prepared, {
    pipelineId: "entrypoints.fl_nonresident.update_validation",
    payload: {
      beneficiary: {
        type: "FL_NONRESIDENT",
        fl: { citizenshipCode },
      },
    },
    context: sample.context,
  });
}

function issues(result) {
  return result.issues.map(({ code, field, level }) => ({ code, field, level }));
}

test("FL_NONRESIDENT принимает разрешённое иностранное гражданство и строковый адрес", () => {
  const result = evaluate(() => {});

  assert.equal(result.status, "OK");
  assert.deepEqual(result.issues, []);
});

test("FL_NONRESIDENT отклоняет российское гражданство без дублирования комплаенс-ошибки", () => {
  const result = evaluate((beneficiary) => {
    beneficiary.fl.citizenshipCode = "RU";
  });

  assert.equal(result.status, "ERROR");
  assert.deepEqual(issues(result), [{
    code: "FL_NONRESIDENT.FL.CITIZENSHIP.MUST_NOT_BE_RU",
    field: "beneficiary.fl.citizenshipCode",
    level: "ERROR",
  }]);
});

test("FL_NONRESIDENT сохраняет отдельный регуляторный отказ для гражданства US", () => {
  const result = evaluate((beneficiary) => {
    beneficiary.fl.citizenshipCode = "US";
  });

  assert.equal(result.status, "EXCEPTION");
  assert.deepEqual(issues(result), [{
    code: "FL_NONRESIDENT.FL.CITIZENSHIP.NOT_US",
    field: "beneficiary.fl.citizenshipCode",
    level: "EXCEPTION",
  }]);
});

test("FL_NONRESIDENT не допускает смену гражданства на RU при частичном обновлении", () => {
  const result = evaluateUpdate("RU");

  assert.equal(result.status, "ERROR");
  assert.deepEqual(issues(result), [{
    code: "FL_NONRESIDENT.FL.CITIZENSHIP.MUST_NOT_BE_RU",
    field: "beneficiary.fl.citizenshipCode",
    level: "ERROR",
  }]);
});

test("FL_NONRESIDENT требует структурированный код страны регистрационного адреса", () => {
  const result = evaluate((beneficiary) => {
    delete beneficiary.address.registration.countryCode;
  });

  assert.equal(result.status, "ERROR");
  assert.deepEqual(issues(result), [{
    code: "BEN.ADDR.REG.COUNTRY.REQUIRED",
    field: "beneficiary.address.registration.countryCode",
    level: "ERROR",
  }]);
});

test("FL_NONRESIDENT отклоняет US в коде регистрационного адреса", () => {
  const result = evaluate((beneficiary) => {
    beneficiary.address.registration.countryCode = "US";
    delete beneficiary.address.registration.fullAddress;
  });

  assert.equal(result.status, "EXCEPTION");
  assert.deepEqual(issues(result), [{
    code: "FL_NONRESIDENT.BEN.ADDRESS.COUNTRY.NOT_US",
    field: "beneficiary.address.registration.countryCode",
    level: "EXCEPTION",
  }]);
});

test("FL_NONRESIDENT требует строку адреса для разрешённой иностранной страны", () => {
  const result = evaluate((beneficiary) => {
    delete beneficiary.address.registration.fullAddress;
  });

  assert.equal(result.status, "ERROR");
  assert.deepEqual(issues(result), [{
    code: "FL_NONRESIDENT.BEN.ADDR.REG.FOREIGN_ADDRESS.REQUIRED",
    field: "beneficiary.address.registration.fullAddress",
    level: "ERROR",
  }]);
});

test("FL_NONRESIDENT требует ФИАС-структуру только для RU", () => {
  const result = evaluate((beneficiary) => {
    beneficiary.address.registration = {
      countryCode: "RU",
      fullAddress: "Россия, Москва",
    };
  });

  assert.equal(result.status, "ERROR");
  assert.deepEqual(result.issues.map(({ code }) => code), [
    "BEN.ADDR.REG.FIAS.REGION_CODE.REQUIRED",
    "BEN.ADDR.REG.FIAS.CITY_OR_LOCALITY.REQUIRED",
    "BEN.ADDR.REG.FIAS.STREET.REQUIRED",
    "BEN.ADDR.REG.FIAS.STREET_TYPE.REQUIRED",
    "BEN.ADDR.REG.FIAS.HOUSE.REQUIRED",
    "BEN.ADDR.REG.FIAS.POSTAL.REQUIRED",
  ]);
});
