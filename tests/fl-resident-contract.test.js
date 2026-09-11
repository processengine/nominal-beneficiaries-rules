"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createEngine } = require("@jsonspecs/rules");

const engine = createEngine({ operators: require("../operators/node") });
const prepared = engine.compileSnapshot(require("../dist/snapshot.json"));
const sample = require("../samples/fl-resident.ok.json");

function evaluateFull(registration) {
  const payload = structuredClone(sample.payload);
  payload.beneficiary.address.registration = structuredClone(registration);
  return engine.runPipeline(prepared, {
    pipelineId: sample.pipelineId,
    payload,
    context: sample.context,
  });
}

function evaluateUpdate(registration) {
  return engine.runPipeline(prepared, {
    pipelineId: "entrypoints.fl_resident.update_validation",
    payload: {
      beneficiary: {
        type: "FL_RESIDENT",
        address: { registration },
      },
    },
    context: sample.context,
  });
}

function issues(result) {
  return result.issues.map(({ code, field, level }) => ({ code, field, level }));
}

test("FL_RESIDENT принимает российский структурированный адрес", () => {
  const result = evaluateFull(sample.payload.beneficiary.address.registration);

  assert.equal(result.status, "OK");
  assert.deepEqual(result.issues, []);
});

test("FL_RESIDENT отклоняет иностранную страну регистрационного адреса", () => {
  const result = evaluateFull({
    countryCode: "DE",
    fullAddress: "Berlin, Alexanderplatz 1",
  });

  assert.equal(result.status, "ERROR");
  assert.deepEqual(issues(result), [{
    code: "BEN.ADDR.REG.COUNTRY.MUST_BE_RU",
    field: "beneficiary.address.registration.countryCode",
    level: "ERROR",
  }]);
});

test("FL_RESIDENT сохраняет отдельный регуляторный отказ для адреса US", () => {
  const result = evaluateFull({
    countryCode: "US",
    fullAddress: "New York, 1 Main Street",
  });

  assert.equal(result.status, "EXCEPTION");
  assert.deepEqual(issues(result), [{
    code: "BEN.ADDRESS.COUNTRY.NOT_US",
    field: "beneficiary.address.registration.countryCode",
    level: "EXCEPTION",
  }]);
});

test("FL_RESIDENT не дублирует ошибку страны при неверном формате", () => {
  const result = evaluateFull({ countryCode: "D" });

  assert.equal(result.status, "ERROR");
  assert.deepEqual(issues(result), [{
    code: "BEN.ADDR.REG.COUNTRY.FORMAT",
    field: "beneficiary.address.registration.countryCode",
    level: "ERROR",
  }]);
});

test("FL_RESIDENT отклоняет иностранную страну при частичном обновлении адреса", () => {
  const result = evaluateUpdate({
    countryCode: "KZ",
    fullAddress: "Алматы, проспект Абая, 1",
  });

  assert.equal(result.status, "ERROR");
  assert.deepEqual(issues(result), [{
    code: "BEN.ADDR.REG.COUNTRY.MUST_BE_RU",
    field: "beneficiary.address.registration.countryCode",
    level: "ERROR",
  }]);
});

test("FL_RESIDENT сохраняет отдельный отказ US при частичном обновлении адреса", () => {
  const result = evaluateUpdate({
    countryCode: "US",
    fullAddress: "New York, 1 Main Street",
  });

  assert.equal(result.status, "EXCEPTION");
  assert.deepEqual(issues(result), [{
    code: "BEN.ADDRESS.COUNTRY.NOT_US",
    field: "beneficiary.address.registration.countryCode",
    level: "EXCEPTION",
  }]);
});
