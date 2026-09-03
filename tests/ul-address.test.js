"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createEngine } = require("@jsonspecs/rules");
const engine = createEngine({ operators: require("../operators/node") });
const prepared = engine.compileSnapshot(require("../dist/snapshot.json"));
const sample = require("../samples/ul-resident.address.locality-no-full-address.json");

function evaluate(legal) {
  const payload = structuredClone(sample.payload);
  payload.beneficiary.address.legal = legal;
  return engine.runPipeline(prepared, {
    pipelineId: sample.pipelineId, payload, context: sample.context,
  });
}

const fields = [
  ["regionCode", "REGION_CODE"], ["postalCode", "POSTAL_CODE"],
  ["streetType", "STREET_TYPE"], ["street", "STREET"], ["house", "HOUSE"],
];

test("каждое обязательное поле адреса ЮЛ проверяется независимо от полной строки", () => {
  for (const [field, code] of fields) {
    for (const value of [undefined, null, ""]) {
      const legal = { ...sample.payload.beneficiary.address.legal, fullAddress: "Полная строка" };
      if (value === undefined) delete legal[field];
      else legal[field] = value;
      const result = evaluate(legal);
      assert.equal(result.status, "ERROR");
      assert.deepEqual(result.issues.map(i => [i.code, i.field, i.level]), [
        [`UL.ADDRESS.LEGAL.FIAS.${code}.REQUIRED`, `beneficiary.address.legal.${field}`, "ERROR"],
      ]);
    }
  }
});

test("составные поля не принимают пробелы и нестроковые JSON-значения", () => {
  for (const [field, code] of [...fields, ["city", "CITY"], ["locality", "LOCALITY"]]) {
    for (const value of [" \t\r\n", "\u00a0", 39, false, [], {}]) {
      const legal = { ...sample.payload.beneficiary.address.legal, [field]: value };
      const result = evaluate(legal);
      assert.equal(result.status, "ERROR");
      assert.deepEqual(result.issues.map(i => [i.code, i.field, i.level]), [
        [`UL.ADDRESS.LEGAL.FIAS.${code}.FORMAT`, `beneficiary.address.legal.${field}`, "ERROR"],
      ]);
    }
  }
});

test("город и населённый пункт альтернативны, полная строка необязательна", () => {
  for (const location of [{ city: "Иркутск" }, { locality: "Жигалово" }, { city: "Иркутск", locality: "Жигалово" }]) {
    for (const fullAddress of [undefined, null, "", "Полная строка"]) {
      const legal = { ...sample.payload.beneficiary.address.legal };
      delete legal.locality;
      Object.assign(legal, location);
      if (fullAddress !== undefined) legal.fullAddress = fullAddress;
      const result = evaluate(legal);
      assert.equal(result.status, "OK");
      assert.deepEqual(result.issues, []);
    }
  }
});
