"use strict";

/** Нормативные примеры доменных операторов, общие для будущих runtime-портов. */

const assert = require("node:assert/strict");
const test = require("node:test");
const operators = require("../operators/node");

test("valid_inn проверяет ИНН ФЛ и ЮЛ по контрольным разрядам", () => {
  const evaluate = operators.valid_inn.evaluate;
  assert.equal(evaluate({ field: "7707083893" }), "PASS");
  assert.equal(evaluate({ field: "744404355804" }), "PASS");
  assert.equal(evaluate({ field: "7707083894" }), "FAIL");
  assert.equal(evaluate({ field: "744404355805" }), "FAIL");
  assert.equal(evaluate({ field: "not-an-inn" }), "FAIL");
  assert.equal(evaluate({ field: 7707083893 }), "FAIL");
  assert.equal(evaluate({ field: null }), "FAIL");
  assert.equal(evaluate({ field: ["7707083893"] }), "FAIL");
});

test("inn_not_repeated требует 12 цифр и не принимает одну повторённую цифру", () => {
  const evaluate = operators.inn_not_repeated.evaluate;
  assert.equal(evaluate({ field: "744404355804" }), "PASS");
  assert.equal(evaluate({ field: "000000000000" }), "FAIL");
  assert.equal(evaluate({ field: "111111111111" }), "FAIL");
  assert.equal(evaluate({ field: "74440435580A" }), "FAIL");
  assert.equal(evaluate({ field: 744404355804 }), "FAIL");
  assert.equal(evaluate({ field: null }), "FAIL");
});

test("is_iso_date принимает только существующую календарную дату YYYY-MM-DD", () => {
  const evaluate = operators.is_iso_date.evaluate;
  assert.equal(evaluate({ field: "2024-02-29" }), "PASS");
  assert.equal(evaluate({ field: "2023-02-29" }), "FAIL");
  assert.equal(evaluate({ field: "2024-02-30" }), "FAIL");
  assert.equal(evaluate({ field: "2024-13-01" }), "FAIL");
  assert.equal(evaluate({ field: "01.01.2024" }), "FAIL");
  assert.equal(evaluate({ field: 20240101 }), "FAIL");
  assert.equal(evaluate({ field: null }), "FAIL");
});

test("проверка минимального возраста корректно обрабатывает 29 февраля", () => {
  const evaluate = operators.passport_rf_issued_at_or_after_age.evaluate;
  const params = { ageYears: 14 };
  assert.equal(evaluate({
    field: "2014-02-28",
    inputs: { birthDate: "2000-02-29" },
    params,
  }), "PASS");
  assert.equal(evaluate({
    field: "2014-02-27",
    inputs: { birthDate: "2000-02-29" },
    params,
  }), "FAIL");
  assert.equal(evaluate({ field: "bad-date", inputs: { birthDate: "2000-02-29" }, params }), "SKIP");
  assert.equal(evaluate({ field: null, inputs: { birthDate: "2000-02-29" }, params }), "SKIP");
  assert.equal(evaluate({ field: "2014-02-28", inputs: null, params }), "SKIP");
});

test("проверка замены паспорта учитывает возраст, дату выдачи и льготный период", () => {
  const evaluate = operators.passport_rf_valid_after_replacement_age.evaluate;
  const params = { ageYears: 20, graceDays: 90 };
  assert.equal(evaluate({
    field: "2019-01-01",
    inputs: { birthDate: "2000-01-01", currentDate: "2019-12-31" },
    params,
  }), "PASS");
  assert.equal(evaluate({
    field: "2019-01-01",
    inputs: { birthDate: "2000-01-01", currentDate: "2020-03-31" },
    params,
  }), "PASS");
  assert.equal(evaluate({
    field: "2019-01-01",
    inputs: { birthDate: "2000-01-01", currentDate: "2020-04-01" },
    params,
  }), "FAIL");
  assert.equal(evaluate({
    field: "2020-01-01",
    inputs: { birthDate: "2000-01-01", currentDate: "2025-01-01" },
    params,
  }), "PASS");
  assert.equal(evaluate({ field: "2020-01-01", inputs: {}, params }), "SKIP");
  assert.equal(evaluate({ field: "2020-01-01", inputs: null, params }), "SKIP");
  assert.equal(evaluate({
    field: "2020-01-01",
    inputs: { birthDate: null, currentDate: ["2025-01-01"] },
    params,
  }), "SKIP");
});
