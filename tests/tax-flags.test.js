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

const nonresidentRegistrations = [
  ["ФЛ-нерезидент", require("../samples/fl-nonresident.ok.json")],
  ["ИП-нерезидент", require("../samples/ip-nonresident.ok.json")],
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

test("регистрация нерезидента допускает отсутствие иностранного налогового и почтового адресов", () => {
  for (const [title, sample] of nonresidentRegistrations) {
    const payload = structuredClone(sample.payload);
    delete payload.beneficiary.tax.foreignTaxResidency.address;
    delete payload.beneficiary.contacts.postalAddress;
    delete payload.beneficiary.contacts.postalAddressCountryCode;

    const result = evaluate(sample, payload);
    assert.equal(result.status, "OK", title);
    assert.deepEqual(issue(result), [], title);
  }
});

test("почтовый адрес не делает иностранный налоговый адрес обязательным", () => {
  for (const [title, sample] of nonresidentRegistrations) {
    const payload = structuredClone(sample.payload);
    delete payload.beneficiary.tax.foreignTaxResidency.address;
    payload.beneficiary.contacts.postalAddress = "Республика Таджикистан, Душанбе";
    payload.beneficiary.contacts.postalAddressCountryCode = "TJ";

    const result = evaluate(sample, payload);
    assert.equal(result.status, "OK", title);
    assert.deepEqual(issue(result), [], title);
  }
});

test("необязательность адреса не ослабляет обязательные налоговые данные нерезидента", () => {
  for (const [title, sample] of nonresidentRegistrations) {
    const withoutCountry = structuredClone(sample.payload);
    delete withoutCountry.beneficiary.tax.foreignTaxResidency.countryCode;
    assert.deepEqual(issue(evaluate(sample, withoutCountry)), [[
      "BEN.TAX.FOREIGN_COUNTRY.REQUIRED",
      "beneficiary.tax.foreignTaxResidency.countryCode",
      "EXCEPTION",
    ]], `${title}: страна`);

    const withoutTinOrReason = structuredClone(sample.payload);
    delete withoutTinOrReason.beneficiary.tax.foreignTaxResidency.tin;
    delete withoutTinOrReason.beneficiary.tax.foreignTaxResidency.tinAbsenceReason;
    assert.deepEqual(issue(evaluate(sample, withoutTinOrReason)), [[
      "BEN.TAX.FOREIGN_TIN.OR_REASON",
      null,
      "EXCEPTION",
    ]], `${title}: ИНН или причина`);

    const usCountry = structuredClone(sample.payload);
    usCountry.beneficiary.tax.foreignTaxResidency.countryCode = "US";
    assert.deepEqual(issue(evaluate(sample, usCountry)), [[
      "BEN.TAX.FOREIGN_COUNTRY.NOT_US",
      "beneficiary.tax.foreignTaxResidency.countryCode",
      "EXCEPTION",
    ]], `${title}: США`);
  }
});
