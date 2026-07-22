"use strict";

/**
 * Доменные операторы пакета для Rules v4.
 *
 * Ядро заранее разрешает пути из `field` и `inputs`. Операторы получают только
 * JSON-значения и постоянные `params`, поэтому не зависят от payload, context,
 * порядка pipeline и API конкретного сервиса.
 */

const path = Object.freeze({ type: "string", minLength: 1 });
const nonNegativeInteger = Object.freeze({ type: "integer", minimum: 0 });

function closed(properties, required) {
  return Object.freeze({
    type: "object",
    properties: Object.freeze(properties),
    required: Object.freeze(required),
    additionalProperties: false,
  });
}

function checksum10(inn) {
  const digits = inn.split("").map(Number);
  const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  const sum = weights.reduce((total, weight, index) => total + weight * digits[index], 0);
  return (sum % 11) % 10;
}

function checksum11(inn) {
  const digits = inn.split("").map(Number);
  const weights = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8, 0];
  const sum = weights.reduce((total, weight, index) => total + weight * digits[index], 0);
  return (sum % 11) % 10;
}

function checksum12(inn) {
  const digits = inn.split("").map(Number);
  const weights = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8, 0];
  const sum = weights.reduce((total, weight, index) => total + weight * digits[index], 0);
  return (sum % 11) % 10;
}

function validInn({ field }) {
  if (typeof field !== "string") return "FAIL";
  const inn = field;
  if (!/^\d+$/.test(inn)) return "FAIL";
  if (inn.length === 10) return checksum10(inn) === Number(inn[9]) ? "PASS" : "FAIL";
  if (inn.length !== 12) return "FAIL";
  return checksum11(inn) === Number(inn[10]) && checksum12(inn) === Number(inn[11])
    ? "PASS"
    : "FAIL";
}

function innNotRepeated({ field }) {
  if (typeof field !== "string") return "FAIL";
  const inn = field;
  return /^\d{12}$/.test(inn) && new Set(inn).size > 1 ? "PASS" : "FAIL";
}

function parseIsoDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? date
    : null;
}

function isIsoDate({ field }) {
  return parseIsoDate(field) ? "PASS" : "FAIL";
}

function readInput(inputs, name) {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) return undefined;
  return inputs[name];
}

function addYears(date, years) {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  if (result.getUTCMonth() !== date.getUTCMonth()) result.setUTCDate(0);
  return result;
}

function addDays(date, days) {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function issuedAtOrAfterAge({ field, inputs = {}, params }) {
  const birthDate = parseIsoDate(readInput(inputs, "birthDate"));
  const issueDate = parseIsoDate(field);
  if (!birthDate || !issueDate) return "SKIP";
  return issueDate >= addYears(birthDate, params.ageYears) ? "PASS" : "FAIL";
}

function validAfterReplacementAge({ field, inputs = {}, params }) {
  const birthDate = parseIsoDate(readInput(inputs, "birthDate"));
  const issueDate = parseIsoDate(field);
  const currentDate = parseIsoDate(readInput(inputs, "currentDate"));
  if (!birthDate || !issueDate || !currentDate) return "SKIP";

  const replacementBirthday = addYears(birthDate, params.ageYears);
  if (currentDate < replacementBirthday || issueDate >= replacementBirthday) return "PASS";
  return currentDate <= addDays(replacementBirthday, params.graceDays) ? "PASS" : "FAIL";
}

const birthDateInputs = closed({ birthDate: path }, ["birthDate"]);
const replacementInputs = closed({ birthDate: path, currentDate: path }, ["birthDate", "currentDate"]);

module.exports = Object.freeze({
  inn_not_repeated: Object.freeze({
    schema: closed({ field: path }, ["field"]),
    evaluate: innNotRepeated,
  }),
  is_iso_date: Object.freeze({
    schema: closed({ field: path }, ["field"]),
    evaluate: isIsoDate,
  }),
  valid_inn: Object.freeze({
    schema: closed({ field: path }, ["field"]),
    evaluate: validInn,
  }),
  passport_rf_issued_at_or_after_age: Object.freeze({
    schema: closed({
      field: path,
      inputs: birthDateInputs,
      params: closed({ ageYears: nonNegativeInteger }, ["ageYears"]),
    }, ["field", "inputs", "params"]),
    evaluate: issuedAtOrAfterAge,
  }),
  passport_rf_valid_after_replacement_age: Object.freeze({
    schema: closed({
      field: path,
      inputs: replacementInputs,
      params: closed({
        ageYears: nonNegativeInteger,
        graceDays: nonNegativeInteger,
      }, ["ageYears", "graceDays"]),
    }, ["field", "inputs", "params"]),
    evaluate: validAfterReplacementAge,
  }),
});
