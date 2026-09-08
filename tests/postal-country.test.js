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
const updates = [
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

function withPostalCountry(sample, countryCode, postalAddress) {
  const payload = structuredClone(sample.payload);
  payload.beneficiary.contacts = {
    ...payload.beneficiary.contacts,
    postalAddress,
    postalAddressCountryCode: countryCode,
  };
  return payload;
}

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

test("код US почтового адреса отклоняется во всех сценариях ФЛ и ИП", () => {
  for (const [title, sample] of [...registrations, ...updates]) {
    const result = evaluate(sample, withPostalCountry(sample, "US", "New York, 1 Main Street"));

    assert.equal(result.status, "EXCEPTION", title);
    assert.deepEqual(issue(result), [[
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
