import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jsonspecs = require("jsonspecs");
const beneficiaryOperators = require("../operators/node/index.js");

export function buildOperatorPack() {
  return {
    check: {
      ...jsonspecs.Operators.check,
      ...beneficiaryOperators.check,
    },
    predicate: {
      ...jsonspecs.Operators.predicate,
      ...beneficiaryOperators.predicate,
    },
  };
}

export function customOperatorMeta() {
  return beneficiaryOperators.meta?.operators || {};
}
