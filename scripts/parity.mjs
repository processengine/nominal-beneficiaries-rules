import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as legacyRules from "@processengine/rules";
import { buildOperatorPack } from "./operators.mjs";

const require = createRequire(import.meta.url);
const jsonspecs = require("jsonspecs");
const customOperators = require("../operators/node/index.js");
const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const processorDir = process.env.PROCESSOR_REPO || path.resolve(rootDir, "../processor-preprod");
const legacySnapshotPath = path.join(
  processorDir,
  "artifacts/fl-resident.registration/subflows/validate-application-v1/rules.snapshot.json",
);

function readSamples(dir) {
  const result = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      result.push(...readSamples(fullPath));
      continue;
    }
    if (entry.endsWith(".json")) {
      result.push({ file: fullPath, data: JSON.parse(readFileSync(fullPath, "utf8")) });
    }
  }
  return result.sort((left, right) => left.file.localeCompare(right.file));
}

function normalizeIssue(issue) {
  return {
    level: issue.level,
    code: issue.code,
    field: issue.field ?? null,
    message: issue.message,
  };
}

function uniqueIssues(issues) {
  const seen = new Set();
  const result = [];
  for (const issue of issues) {
    const key = JSON.stringify(issue);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(issue);
  }
  return result;
}

function normalizeResult(result) {
  return {
    status: result.status,
    control: result.control,
    issues: uniqueIssues((result.issues || []).map(normalizeIssue)),
  };
}

function samplePipelineId(sample) {
  const pipelineId = sample.context?.pipelineId ?? sample.pipelineId;
  if (!pipelineId) {
    throw new Error("Sample must define context.pipelineId");
  }
  return pipelineId;
}

function sampleContext(sample) {
  const { pipelineId: _pipelineId, ...context } = sample.context || {};
  return context;
}

function normalizeExpectedIssues(issues) {
  return uniqueIssues((issues || []).map((issue) => ({
    level: issue.level,
    code: issue.code,
    field: issue.field ?? null,
  })));
}

function assertEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual, null, 2);
  const expectedJson = JSON.stringify(expected, null, 2);
  if (actualJson !== expectedJson) {
    throw new Error(`${label} mismatch\nactual: ${actualJson}\nexpected: ${expectedJson}`);
  }
}

const legacySource = JSON.parse(readFileSync(legacySnapshotPath, "utf8"));
const legacyPrepared = legacyRules.prepareRules(legacySource, { operators: customOperators });

const engine = jsonspecs.createEngine({ operators: buildOperatorPack() });
const jsonspecsSnapshot = JSON.parse(readFileSync(path.join(rootDir, "dist/snapshot.json"), "utf8"));
const jsonspecsPrepared = engine.compileSnapshot(jsonspecsSnapshot);

let checked = 0;
for (const { file, data } of readSamples(path.join(rootDir, "samples"))) {
  const pipelineId = samplePipelineId(data);
  const context = sampleContext(data);
  const legacyResult = legacyRules.evaluateRules(legacyPrepared, {
    pipelineId,
    payload: data.payload,
    context,
  }, { trace: false });
  const jsonspecsResult = engine.runPipeline(
    jsonspecsPrepared,
    pipelineId,
    { ...data.payload, __context: context },
    { trace: false },
  );

  const normalizedLegacy = normalizeResult(legacyResult);
  const normalizedJsonspecs = normalizeResult(jsonspecsResult);
  if (data.legacyParity !== false) {
    assertEqual(normalizedJsonspecs, normalizedLegacy, path.relative(rootDir, file));
  }

  if (data.expect) {
    assertEqual(
      {
        status: normalizedJsonspecs.status,
        issues: normalizeExpectedIssues(normalizedJsonspecs.issues),
      },
      {
        status: data.expect.status,
        issues: normalizeExpectedIssues(data.expect.issues),
      },
      `${path.relative(rootDir, file)} expectation`,
    );
  }
  checked += 1;
}

console.log(`Parity OK: ${checked} samples`);
