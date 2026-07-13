import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as legacyRules from "@processengine/rules";
import { buildOperatorPack } from "./operators.mjs";

const require = createRequire(import.meta.url);
const jsonspecs = require("jsonspecs");
const customOperators = require("../operators/node/index.js");
const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const processorDir = process.env.PROCESSOR_REPO || path.resolve(rootDir, "../processor-preprod");
const legacyFixtureDir = path.join(rootDir, "test-fixtures/legacy-snapshots");

function legacySnapshotPath(processorRelativePath, fixtureFileName) {
  const processorPath = path.join(processorDir, processorRelativePath);
  if (process.env.PROCESSOR_REPO && existsSync(processorPath)) return processorPath;
  return path.join(legacyFixtureDir, fixtureFileName);
}

const legacySnapshotPaths = {
  "entrypoints.fl_resident.full_validation": legacySnapshotPath(
    "artifacts/fl-resident.registration/subflows/validate-application-v1/rules.snapshot.json",
    "fl-resident.validate-application.rules.snapshot.json",
  ),
  "entrypoints.fl_nonresident.full_validation": legacySnapshotPath(
    "artifacts/fl-nonresident.registration/subflows/validate-application-v1/rules.snapshot.json",
    "fl-nonresident.validate-application.rules.snapshot.json",
  ),
  "entrypoints.ip_resident.full_validation": legacySnapshotPath(
    "artifacts/ip-resident.registration/subflows/validate-application-v1/rules.snapshot.json",
    "ip-resident.validate-application.rules.snapshot.json",
  ),
};

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

function normalizeIssue(issue, codeAliases = new Map()) {
  return {
    level: issue.level,
    code: codeAliases.get(issue.code) || issue.code,
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

function normalizeResult(result, codeAliases = new Map()) {
  return {
    status: result.status,
    control: result.control,
    issues: uniqueIssues((result.issues || []).map((issue) => normalizeIssue(issue, codeAliases))),
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

const legacyPreparedByPipeline = new Map(
  Object.entries(legacySnapshotPaths).map(([pipelineId, snapshotPath]) => [
    pipelineId,
    legacyRules.prepareRules(JSON.parse(readFileSync(snapshotPath, "utf8")), { operators: customOperators }),
  ]),
);

const engine = jsonspecs.createEngine({ operators: buildOperatorPack() });
const jsonspecsSnapshot = JSON.parse(readFileSync(path.join(rootDir, "dist/snapshot.json"), "utf8"));
const jsonspecsPrepared = engine.compileSnapshot(jsonspecsSnapshot);
const jsonspecsCodeAliases = new Map(
  (jsonspecsSnapshot.artifacts || [])
    .filter((artifact) => artifact.type === "rule" && artifact.role === "check" && artifact.meta?.legacyCode)
    .map((artifact) => [artifact.code, artifact.meta.legacyCode]),
);

let checked = 0;
for (const { file, data } of readSamples(path.join(rootDir, "samples"))) {
  const pipelineId = samplePipelineId(data);
  const context = sampleContext(data);
  const legacyPrepared = legacyPreparedByPipeline.get(pipelineId);
  if (!legacyPrepared) {
    throw new Error(`No legacy snapshot configured for ${pipelineId}`);
  }
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
  const normalizedJsonspecsForParity = normalizeResult(jsonspecsResult, jsonspecsCodeAliases);
  const normalizedJsonspecs = normalizeResult(jsonspecsResult);
  if (data.legacyParity !== false) {
    assertEqual(normalizedJsonspecsForParity, normalizedLegacy, path.relative(rootDir, file));
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
