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

function evaluate(sample, payload) {
  return engine.runPipeline(prepared, {
    pipelineId: sample.pipelineId,
    payload,
    context: sample.context,
  });
}

function issue(result) {
  return result.issues.map(({ code, field, level }) => [code, field, level]);
}

test("регистрация ФЛ и ИП требует каждый налоговый признак", () => {
  for (const [title, sample] of registrations) {
    for (const [field, codePart] of fields) {
      for (const value of [undefined, null, ""]) {
        const payload = structuredClone(sample.payload);
        if (value === undefined) delete payload.beneficiary.tax[field];
        else payload.beneficiary.tax[field] = value;

        const result = evaluate(sample, payload);
        assert.equal(result.status, "EXCEPTION", `${title}: ${field}=${String(value)}`);
        assert.deepEqual(issue(result), [[
          `BEN.TAX.${codePart}.REQUIRED`,
          `beneficiary.tax.${field}`,
          "EXCEPTION",
        ]], `${title}: ${field}=${String(value)}`);
      }
    }
  }
});

test("регистрация ФЛ и ИП не принимает не-логические налоговые признаки", () => {
  for (const [title, sample] of registrations) {
    for (const [field, codePart] of fields) {
      for (const value of ["false", 0, [], {}]) {
        const payload = structuredClone(sample.payload);
        payload.beneficiary.tax[field] = value;

        const result = evaluate(sample, payload);
        assert.equal(result.status, "EXCEPTION", `${title}: ${field}=${JSON.stringify(value)}`);
        assert.deepEqual(issue(result), [[
          `BEN.TAX.${codePart}.BOOL`,
          `beneficiary.tax.${field}`,
          "EXCEPTION",
        ]], `${title}: ${field}=${JSON.stringify(value)}`);
      }
    }
  }
});

test("частичное обновление допускает отсутствие налоговых признаков, но не null и неверный тип", () => {
  for (const [title, sample, supportedFields] of updates) {
    assert.equal(evaluate(sample, structuredClone(sample.payload)).status, "OK", title);

    for (const [field, codePart] of supportedFields) {
      for (const value of [null, "", "false", 0, [], {}]) {
        const payload = structuredClone(sample.payload);
        payload.beneficiary.tax = { [field]: value };

        const result = evaluate(sample, payload);
        assert.equal(result.status, "EXCEPTION", `${title}: ${field}=${JSON.stringify(value)}`);
        assert.deepEqual(issue(result), [[
          `BEN.TAX.${codePart}.BOOL`,
          `beneficiary.tax.${field}`,
          "EXCEPTION",
        ]], `${title}: ${field}=${JSON.stringify(value)}`);
      }
    }
  }
});
