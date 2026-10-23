'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEngine } = require('@jsonspecs/rules');
const engine = createEngine({ operators: require('../operators/node') });
const prepared = engine.compileSnapshot(require('../dist/snapshot.json'));
const types = ['fl-resident', 'fl-nonresident', 'ip-resident', 'ip-nonresident', 'ul-resident'];

function evaluate(type, address, update = false) {
  const sample = require(`../samples/${type}.ok.json`);
  const payload = structuredClone(sample.payload);
  const kind = type === 'ul-resident' ? 'legal' : 'registration';
  // Общий базовый структурированный адрес нужен и для нерезидентских примеров.
  const base = require('../samples/fl-resident.ok.json').payload.beneficiary.address.registration;
  payload.beneficiary.address[kind] = { ...base, ...address };
  return engine.runPipeline(prepared, {
    pipelineId: update ? sample.pipelineId.replace('full_validation', 'update_validation') : sample.pipelineId,
    payload,
    context: sample.context,
  });
}

for (const type of types) {
  for (const update of [false, true]) {
    if (update && type === 'ip-nonresident') continue;
    if (update && type === 'ul-resident') continue; // Юридический адрес update принадлежит реестру.
    test(`${type} ${update ? 'update' : 'registration'}: district is optional and planning structure is accepted`, () => {
      for (const streetType of ['ул', 'мкр', 'мкр.', 'кв-л', 'кв-л.']) {
        for (const extra of [{}, { regionArea: 'Уфимский' }]) {
          const result = evaluate(type, { streetType, ...extra }, update);
          assert.equal(result.status, 'OK', JSON.stringify(result.issues));
        }
      }
    });
    test(`${type} ${update ? 'update' : 'registration'}: a supplied district must be nonblank text`, () => {
      const kind = type === 'ul-resident' ? 'legal' : 'registration';
      const code = kind === 'legal' ? 'LEGAL' : 'REG';
      for (const regionArea of [null, '', ' \t\r\n', '\u00a0', '\u2003', 42, false, true, [], {}]) {
        const result = evaluate(type, { regionArea }, update);
        assert.equal(result.status, 'ERROR', `${type}: ${JSON.stringify(regionArea)}`);
        assert.deepEqual(result.issues.map(({ code, field, level }) => ({ code, field, level })), [{
          code: `BEN.ADDR.${code}.REGION_AREA.FORMAT`,
          field: `beneficiary.address.${kind}.regionArea`,
          level: 'ERROR',
        }]);
      }
    });
  }
}

test('an update without an address does not require a district or a full address', () => {
  for (const type of ['fl_resident', 'fl_nonresident', 'ip_resident']) {
    const sample = require(`../samples/${type.replaceAll('_', '-')}.ok.json`);
    const payload = structuredClone(sample.payload);
    delete payload.beneficiary.address;
    const result = engine.runPipeline(prepared, {
      pipelineId: `entrypoints.${type}.update_validation`, payload, context: sample.context,
    });
    assert.equal(result.status, 'OK', JSON.stringify(result.issues));
  }
});

test('an explicitly null or empty district in a partial update is not treated as absent', () => {
  for (const type of ['fl_resident', 'fl_nonresident', 'ip_resident']) {
    for (const regionArea of [null, '']) {
      const sample = require(`../samples/${type.replaceAll('_', '-')}.ok.json`);
      const payload = { beneficiary: { type: type.toUpperCase(), address: { registration: { regionArea } } } };
      const result = engine.runPipeline(prepared, {
        pipelineId: `entrypoints.${type}.update_validation`, payload, context: sample.context,
      });
      assert.equal(result.status, 'ERROR');
      assert.deepEqual(result.issues.map(({ code, field }) => ({ code, field })), [{
        code: 'BEN.ADDR.REG.REGION_AREA.FORMAT', field: 'beneficiary.address.registration.regionArea',
      }]);
    }
  }
});

for (const type of ['fl_resident', 'fl_nonresident', 'ip_resident']) {
  test(`${type}: district-only update invokes the existing address completeness checks`, () => {
    const sample = require(`../samples/${type.replaceAll('_', '-')}.ok.json`);
    const result = engine.runPipeline(prepared, {
      pipelineId: `entrypoints.${type}.update_validation`,
      payload: { beneficiary: { type: type.toUpperCase(), address: { registration: { regionArea: 'Уфимский' } } } },
      context: sample.context,
    });
    assert.equal(result.status, 'ERROR');
    assert.ok(result.issues.some(({ field }) => field === 'beneficiary.address.registration.countryCode'
      || field === 'beneficiary.address.registration.regionCode'));
  });
}
