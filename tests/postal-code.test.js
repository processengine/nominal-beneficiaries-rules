'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEngine } = require('@jsonspecs/rules');
const engine = createEngine({ operators: require('../operators/node') });
const prepared = engine.compileSnapshot(require('../dist/snapshot.json'));
const registration = require('../samples/fl-resident.ok.json').payload.beneficiary.address.registration;
const types = ['fl-resident', 'fl-nonresident', 'ip-resident', 'ip-nonresident', 'ul-resident'];
const cases = types.flatMap(type => [false, true]
  .filter(update => !update || !['ip-nonresident', 'ul-resident'].includes(type))
  .map(update => ({ type, update })));

function evaluate(type, update, postalCode, mutate = () => {}) {
  const sample = require(`../samples/${type}.ok.json`);
  const payload = structuredClone(sample.payload);
  const kind = type === 'ul-resident' ? 'legal' : 'registration';
  const address = payload.beneficiary.address[kind] = { ...registration };
  if (postalCode === undefined) delete address.postalCode;
  else address.postalCode = postalCode;
  mutate(payload.beneficiary, address);
  const original = structuredClone(payload);
  const result = engine.runPipeline(prepared, {
    pipelineId: update ? sample.pipelineId.replace('full_validation', 'update_validation') : sample.pipelineId,
    payload, context: sample.context,
  });
  assert.deepEqual(payload, original, 'проверка не меняет индекс и заявку');
  return result;
}

function issues(result) {
  return result.issues.map(({ code, field, level }) => ({ code, field, level }));
}

for (const { type, update } of cases) {
  const legal = type === 'ul-resident';
  const field = `beneficiary.address.${legal ? 'legal' : 'registration'}.postalCode`;
  const format = legal ? 'UL.ADDRESS.LEGAL.FIAS.POSTAL_CODE.FORMAT' : 'BEN.ADDR.REG.POSTAL.FORMAT';
  const required = legal ? 'UL.ADDRESS.LEGAL.FIAS.POSTAL_CODE.REQUIRED' : 'BEN.ADDR.REG.FIAS.POSTAL.REQUIRED';
  test(`${type} ${update ? 'update' : 'registration'}: принимаем шесть ASCII-цифр и сохраняем ведущий ноль`, () => {
    for (const value of ['123456', '012345', '000000']) {
      const result = evaluate(type, update, value);
      assert.equal(result.status, 'OK', JSON.stringify(result.issues));
      assert.deepEqual(result.issues, []);
    }
  });
  test(`${type} ${update ? 'update' : 'registration'}: неверный формат даёт одну подробную ERROR`, () => {
    for (const value of ['12345', '1234567', '12345a', '123-45', '12 345', ' 123456', '123456 ',
      '123456\n', '123456\r\n', '\u00a0123456', '１２３４５６', '١٢٣٤٥٦', ' \t\n', 123456, 0, false, true, [], {}]) {
      const result = evaluate(type, update, value);
      assert.equal(result.status, 'ERROR', JSON.stringify(value));
      assert.deepEqual(issues(result), [{ code: format, field, level: 'ERROR' }], JSON.stringify(value));
    }
  });
  test(`${type} ${update ? 'update' : 'registration'}: прежняя обязательность сохранена`, () => {
    for (const value of [undefined, null, '']) {
      const result = evaluate(type, update, value);
      assert.deepEqual(issues(result), [{ code: required, field, level: 'ERROR' }]);
    }
  });
  test(`${type} ${update ? 'update' : 'registration'}: длинная строка не даёт дублирующих ошибок`, () => {
    assert.deepEqual(issues(evaluate(type, update, '1'.repeat(33))), [{
      code: legal ? format : 'BEN.ADDR.REG.POSTAL.LENGTH', field, level: 'ERROR',
    }]);
  });
}

for (const countryCode of [undefined, 'RU', 'TM', 'US']) {
  test(`update ФЛ-нерезидента сохраняет российскую маску при совместимом countryCode=${countryCode}`, () => {
    const mutate = (_, address) => {
      if (countryCode === undefined) delete address.countryCode;
      else address.countryCode = countryCode;
    };
    assert.equal(evaluate('fl-nonresident', true, '012345', mutate).status, 'OK');
    assert.deepEqual(issues(evaluate('fl-nonresident', true, '1234567', mutate)), [{
      code: 'BEN.ADDR.REG.POSTAL.FORMAT', field: 'beneficiary.address.registration.postalCode', level: 'ERROR',
    }]);
  });
}

for (const postalCode of [undefined, '12345', 'SW1A 1AA', 'A'.repeat(32)]) {
  test(`иностранная регистрация ФЛ-нерезидента не получает российскую маску: ${postalCode}`, () => {
    assert.equal(evaluate('fl-nonresident', false, postalCode, (_, address) => {
      address.countryCode = 'GB'; address.fullAddress = 'Foreign address';
    }).status, 'OK');
  });
}

test('иностранная регистрация сохраняет прежний лимит 32 и не преобразует числовой индекс', () => {
  for (const value of ['A'.repeat(33), 12345]) {
    const result = evaluate('fl-nonresident', false, value, (_, address) => {
      address.countryCode = 'GB'; address.fullAddress = 'Foreign address';
    });
    assert.deepEqual(issues(result), [{ code: 'BEN.ADDR.REG.POSTAL.LENGTH',
      field: 'beneficiary.address.registration.postalCode', level: 'ERROR' }]);
  }
});

test('неизвестная страна не становится RU, юридический иностранный адрес получает только ошибку страны', () => {
  for (const type of ['fl-resident', 'fl-nonresident', 'ip-resident', 'ip-nonresident', 'ul-resident']) {
    const result = evaluate(type, false, '1234567', (_, address) => { delete address.countryCode; });
    assert.ok(result.issues.some(i => i.field.endsWith('.countryCode')));
    assert.ok(!result.issues.some(i => i.code.includes('POSTAL') && i.code.endsWith('.FORMAT')));
  }
  const result = evaluate('ul-resident', false, 'SW1A 1AA', (_, address) => { address.countryCode = 'GB'; });
  assert.deepEqual(result.issues.map(i => i.code), ['UL.ADDRESS.LEGAL.COUNTRY_RU']);

  // Это граница flat-проекции, не разрешение таких заявок в merchant API.
  // Полный RU-адрес с объектом останавливает REQUIRED, но контейнеры без
  // скалярного признака адреса пропускают всю группу. Их проверяет processor.
  for (const [type, registration] of [
    ['fl_nonresident', { postalCode: { value: '123456' } }],
    ['ip_resident', { countryCode: { value: 'RU' }, postalCode: { value: '123456' } }],
  ]) {
    const sample = require('../samples/fl-resident.ok.json');
    const flatBoundary = engine.runPipeline(prepared, {
      pipelineId: `entrypoints.${type}.update_validation`,
      payload: { beneficiary: { type: type.toUpperCase(), address: { registration } } },
      context: sample.context,
    });
    assert.equal(flatBoundary.status, 'OK');
    assert.deepEqual(flatBoundary.issues, []);
  }
});

test('частичное обновление без адреса не начинает требовать индекс', () => {
  for (const type of ['fl-resident', 'fl-nonresident', 'ip-resident', 'ul-resident', 'ul-nonresident']) {
    const sample = require(`../samples/${type}.ok.json`);
    const result = engine.runPipeline(prepared, {
      pipelineId: sample.pipelineId.replace('full_validation', 'update_validation'),
      payload: { beneficiary: { type: sample.payload.beneficiary.type, contacts: { email: 'test@example.com' } } },
      context: sample.context,
    });
    assert.equal(result.status, 'OK', `${type}: ${JSON.stringify(result.issues)}`);
  }
});

test('update ЮЛ не наследует обязательность регистрационного индекса', () => {
  for (const type of ['ul-resident', 'ul-nonresident']) {
    for (const postalCode of [undefined, 'SW1A 1AA']) {
      const sample = require(`../samples/${type}.ok.json`);
      const legal = { countryCode: type === 'ul-resident' ? 'RU' : 'GB', fullAddress: 'Address' };
      if (postalCode !== undefined) legal.postalCode = postalCode;
      const result = engine.runPipeline(prepared, {
        pipelineId: sample.pipelineId.replace('full_validation', 'update_validation'),
        payload: { beneficiary: { type: sample.payload.beneficiary.type, address: { legal } } },
        context: sample.context,
      });
      assert.equal(result.status, 'OK', JSON.stringify(result.issues));
    }
  }
});

test('обычные ошибки собираются вместе, реальный комплаенс сохраняет приоритет', () => {
  const ordinary = evaluate('fl-resident', false, '1234567', b => { b.contacts.phone = 'bad'; });
  assert.equal(ordinary.status, 'ERROR');
  assert.ok(ordinary.issues.some(i => i.code === 'BEN.ADDR.REG.POSTAL.FORMAT'));
  assert.ok(ordinary.issues.some(i => i.field === 'beneficiary.contacts.phone'));
  const compliance = evaluate('fl-resident', false, '1234567', b => { b.tax.usTaxResident = true; });
  assert.equal(compliance.status, 'EXCEPTION');
});
