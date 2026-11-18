'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEngine } = require('@jsonspecs/rules');
const fixture = require('./fixtures/pay-1035-street-types.json');
const dictionary = require('../rules/dictionaries/street_types_fias_basic.json');
const engine = createEngine({ operators: require('../operators/node') });
const prepared = engine.compileSnapshot(require('../dist/snapshot.json'));
const additions = fixture.types.flatMap(type => type.entries);
const types = ['fl-resident', 'fl-nonresident', 'ip-resident', 'ip-nonresident'];

// Исследовательский debug не требовал полной анкеты. Здесь используются
// merchant-фикстуры с countryCode и индексом, а не неполный DTO команды ЦФТ.
function run(type, streetType, { update = false, change = () => {} } = {}) {
  const sample = structuredClone(require(`../samples/${type}.ok.json`));
  const base = require('../samples/fl-resident.ok.json').payload.beneficiary.address.registration;
  sample.payload.beneficiary.address.registration = { ...base, streetType };
  change(sample.payload.beneficiary.address.registration);
  return engine.runPipeline(prepared, {
    pipelineId: update ? sample.pipelineId.replace('full_validation', 'update_validation') : sample.pipelineId,
    payload: sample.payload,
    context: sample.context,
  });
}

test('PAY-1035: exact approved additions preserve all previous dictionary values', () => {
  assert.equal(fixture.types.length, 35);
  assert.equal(additions.length, 59);
  assert.equal(new Set(additions).size, 59);
  assert.deepEqual([...dictionary.entries].sort(), [...fixture.previousEntries, ...additions].sort());
  assert.equal(new Set(dictionary.entries).size, 89);
});

for (const type of types) {
  for (const update of [false, true]) {
    if (update && type === 'ip-nonresident') continue;
    const label = `${type} ${update ? 'partial update' : 'registration'}`;
    test(`PAY-1035: all 59 approved spellings pass ${label} with a complete API fixture`, () => {
      for (const streetType of additions) {
        const result = run(type, streetType, { update });
        assert.equal(result.status, 'OK', `${streetType}: ${JSON.stringify(result.issues)}`);
        assert.deepEqual(result.issues, []);
      }
    });
    test(`PAY-1035: previous spellings remain valid in ${label}`, () => {
      for (const streetType of fixture.previousEntries) {
        assert.equal(run(type, streetType, { update }).status, 'OK', streetType);
      }
    });
    test(`PAY-1035: unknown and unapproved aliases still fail ${label}`, () => {
      for (const streetType of ['снт', 'гск', 'днт', 'онт', 'днп', 'тер. СОСН', 'несуществующий тип']) {
        const result = run(type, streetType, { update });
        assert.equal(result.status, 'ERROR', streetType);
        assert.deepEqual(result.issues.map(({ code, field, level }) => ({ code, field, level })), [{
          code: 'BEN.ADDR.REG.STREET_TYPE.DICT',
          field: 'beneficiary.address.registration.streetType',
          level: 'ERROR',
        }]);
      }
    });
    test(`PAY-1035: streetless and street-pair contracts remain in ${label}`, () => {
      assert.equal(run(type, undefined, { update, change(a) { delete a.streetType; delete a.street; } }).status, 'OK');
      const missingName = run(type, 'тер', { update, change(a) { delete a.street; } });
      assert.equal(missingName.status, 'ERROR');
      assert(missingName.issues.some(i => i.field === 'beneficiary.address.registration.street'));
      const missingType = run(type, undefined, { update, change(a) { delete a.streetType; } });
      assert.equal(missingType.status, 'ERROR');
      assert(missingType.issues.some(i => i.field === 'beneficiary.address.registration.streetType'));
    });
  }
}

test('PAY-1035: accepted territory type does not hide missing country or postal code', () => {
  const noCountry = run('fl-resident', 'тер', { change(a) { delete a.countryCode; } });
  assert(noCountry.issues.some(i => i.code === 'BEN.ADDR.REG.COUNTRY.REQUIRED'));
  assert.equal(noCountry.issues.some(i => i.code === 'BEN.ADDR.REG.STREET_TYPE.DICT'), false);
  const noPostal = run('fl-resident', 'тер', { change(a) { delete a.postalCode; } });
  assert(noPostal.issues.some(i => i.code === 'BEN.ADDR.REG.FIAS.POSTAL.REQUIRED'));
});
