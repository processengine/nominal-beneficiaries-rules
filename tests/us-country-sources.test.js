"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createEngine } = require("@jsonspecs/rules");

const engine = createEngine({ operators: require("../operators/node") });
const prepared = engine.compileSnapshot(require("../dist/snapshot.json"));

const registrations = [
  ["ФЛ-резидент", require("../samples/fl-resident.ok.json")],
  ["ФЛ-нерезидент", require("../samples/fl-nonresident.ok.json")],
  ["ИП-резидент", require("../samples/ip-resident.ok.json")],
  ["ИП-нерезидент", require("../samples/ip-nonresident.ok.json")],
];

const residentUpdateBase = require("../samples/update.fl_resident.address-structured-no-full-address.json");
const postalUpdates = [
  ["обновление ФЛ-резидента", residentUpdateBase],
  ["обновление ИП-резидента", {
    ...structuredClone(residentUpdateBase),
    pipelineId: "entrypoints.ip_resident.update_validation",
    payload: {
      beneficiary: {
        ...structuredClone(residentUpdateBase.payload.beneficiary),
        type: "IP_RESIDENT",
      },
    },
  }],
];

const identityUpdates = [
  ["обновление ФЛ-резидента", require("../samples/update.fl_resident.ok-email-only.json")],
  ["обновление ФЛ-нерезидента", require("../samples/update.fl_nonresident.ok-email-only.json")],
  ["обновление ИП-резидента", require("../samples/update.ip_resident.ok-email-only.json")],
];

const nonresidentRegistrations = registrations.filter(([title]) => title.includes("нерезидент"));

function evaluate(sample, payload) {
  return engine.runPipeline(prepared, {
    pipelineId: sample.pipelineId,
    payload,
    context: sample.context,
  });
}

function withPostalCountry(sample, countryCode, postalAddress) {
  const payload = structuredClone(sample.payload);
  payload.beneficiary.contacts = {
    ...payload.beneficiary.contacts,
    postalAddress,
    postalAddressCountryCode: countryCode,
  };
  return payload;
}

function withBirthPlace(sample, birthPlace) {
  const payload = structuredClone(sample.payload);
  payload.beneficiary.fl = {
    ...payload.beneficiary.fl,
    birthPlace,
  };
  return payload;
}

function withForeignTaxAddress(sample, address) {
  const payload = structuredClone(sample.payload);
  payload.beneficiary.tax.foreignTaxResidency.address = address;
  return payload;
}

function issues(result) {
  return result.issues.map(({ code, field, level }) => [code, field, level]);
}

test("код US почтового адреса отклоняется во всех поддерживаемых сценариях ФЛ и ИП", () => {
  for (const [title, sample] of [...registrations, ...postalUpdates]) {
    const result = evaluate(sample, withPostalCountry(sample, "US", "New York, 1 Main Street"));

    assert.equal(result.status, "EXCEPTION", title);
    assert.deepEqual(issues(result), [[
      "BEN.CONTACTS.POSTAL.NOT_US",
      "beneficiary.contacts.postalAddressCountryCode",
      "EXCEPTION",
    ]], title);
  }
});

test("свободный текст почтового адреса не определяет страну", () => {
  for (const [title, sample] of registrations) {
    const result = evaluate(sample, withPostalCountry(sample, "DE", "USA, New York"));
    assert.equal(result.status, "OK", title);
    assert.deepEqual(result.issues, [], title);
  }
});

test("свободный текст места рождения не определяет страну", () => {
  const variants = ["RUSSIA", "USA", "США", "United States of America"];
  const scenarios = [...registrations, ...identityUpdates];

  for (const [index, [title, sample]] of scenarios.entries()) {
    const result = evaluate(sample, withBirthPlace(sample, variants[index % variants.length]));
    assert.equal(result.status, "OK", title);
    assert.deepEqual(result.issues, [], title);
  }
});

test("свободный текст иностранного налогового адреса не определяет страну", () => {
  for (const [title, sample] of nonresidentRegistrations) {
    const result = evaluate(sample, withForeignTaxAddress(sample, "USA, New York"));
    assert.equal(result.status, "OK", title);
    assert.deepEqual(result.issues, [], title);
  }
});

test("код US страны иностранного налогового резидентства остаётся регуляторным отказом", () => {
  for (const [title, sample] of nonresidentRegistrations) {
    const payload = structuredClone(sample.payload);
    payload.beneficiary.tax.foreignTaxResidency.countryCode = "US";
    const result = evaluate(sample, payload);

    assert.equal(result.status, "EXCEPTION", title);
    assert.deepEqual(issues(result), [[
      "BEN.TAX.FOREIGN_COUNTRY.NOT_US",
      "beneficiary.tax.foreignTaxResidency.countryCode",
      "EXCEPTION",
    ]], title);
  }
});
