import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildOperatorPack } from "./operators.mjs";

const require = createRequire(import.meta.url);
const jsonspecs = require("jsonspecs");
const jsonspecsPackage = require("jsonspecs/package.json");
const rootDir = path.resolve(new URL("..", import.meta.url).pathname);

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function parseSemver(value, label) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(value || ""));
  if (!match) throw new Error(`${label} must be a complete SemVer version, got ${JSON.stringify(value)}`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareSemver(leftValue, rightValue) {
  const left = parseSemver(leftValue, "left semver");
  const right = parseSemver(rightValue, "right semver");
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
  }
  return 0;
}

function satisfiesRange(version, range) {
  const value = String(range || "").trim();
  if (/^\d+\.\d+\.\d+$/.test(value)) return compareSemver(version, value) === 0;
  const caret = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (caret) {
    const minVersion = `${caret[1]}.${caret[2]}.${caret[3]}`;
    const nextMajor = `${Number(caret[1]) + 1}.0.0`;
    return compareSemver(version, minVersion) >= 0 && compareSemver(version, nextMajor) < 0;
  }
  throw new Error(`Unsupported jsonspecs dependency range ${JSON.stringify(range)}`);
}

function formatDiagnostic(diagnostic) {
  return `${diagnostic.level || "unknown"} ${diagnostic.code || "UNKNOWN"} ${diagnostic.artifactId || "<unknown>"} ${diagnostic.path || ""}: ${diagnostic.message || ""}`;
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const manifest = readJson("manifest.json");
const snapshot = readJson(path.join(manifest.paths.dist, manifest.build.snapshotFile));
const buildInfo = readJson(path.join(manifest.paths.dist, manifest.build.buildInfoFile));
const version = packageJson.version;
const installedJsonspecsVersion = jsonspecsPackage.version;
const jsonspecsRange = packageJson.dependencies?.jsonspecs;

assertEqual(packageLock.version, version, "package-lock.json version");
assertEqual(packageLock.packages?.[""]?.version, version, "package-lock.json root package version");
assertEqual(manifest.project.version, version, "manifest project version");
assertEqual(snapshot.meta?.rulesetVersion, version, "snapshot ruleset version");
assertEqual(buildInfo.rulesetVersion, version, "build-info ruleset version");
assertEqual(snapshot.meta?.projectId, manifest.project.id, "snapshot project id");
assertEqual(buildInfo.projectId, manifest.project.id, "build-info project id");
assertEqual(buildInfo.artifactCount, snapshot.artifacts?.length, "build-info artifact count");
assertEqual(buildInfo.warningCount, 0, "build-info warning count");
assertEqual(buildInfo.diagnosticCount, 0, "build-info diagnostic count");
assertCondition(!Object.hasOwn(buildInfo, "warnings"), "build-info must use warningCount, not warnings");
assertCondition(
  satisfiesRange(installedJsonspecsVersion, jsonspecsRange),
  `installed jsonspecs ${installedJsonspecsVersion} does not satisfy package.json dependency range ${jsonspecsRange}`,
);
assertEqual(buildInfo.engineVersion, installedJsonspecsVersion, "build-info engineVersion");
assertCondition(
  compareSemver(installedJsonspecsVersion, snapshot.engine?.minVersion) >= 0,
  `installed jsonspecs ${installedJsonspecsVersion} is lower than snapshot.engine.minVersion ${snapshot.engine?.minVersion}`,
);

const sourceHash = jsonspecs.computeSourceHash(snapshot.artifacts || []);
assertEqual(snapshot.sourceHash, sourceHash, "snapshot source hash");
assertEqual(buildInfo.sourceHash, sourceHash, "build-info source hash");

const expectedEntrypoints = [
  "entrypoints.beneficiary.unbind.field_validation",
  "entrypoints.beneficiary.unbind.type_supported",
  "entrypoints.fl_nonresident.full_validation",
  "entrypoints.fl_resident.full_validation",
  "entrypoints.ip_nonresident.full_validation",
  "entrypoints.ip_resident.full_validation",
  "entrypoints.ul_nonresident.full_validation",
  "entrypoints.ul_resident.full_validation",
];
const entrypoints = (snapshot.artifacts || [])
  .filter((artifact) => artifact.type === "pipeline" && artifact.id.startsWith("entrypoints."))
  .map((artifact) => artifact.id)
  .sort();
assertEqual(JSON.stringify(entrypoints), JSON.stringify(expectedEntrypoints), "active entrypoint ids");

const engine = jsonspecs.createEngine({ operators: buildOperatorPack() });
let prepared;
try {
  prepared = engine.compileSnapshot(snapshot);
} catch (error) {
  const diagnostics = Array.isArray(error?.diagnostics) ? error.diagnostics : [];
  const details = diagnostics.slice(0, 5).map(formatDiagnostic).join("\n");
  throw new Error(`snapshot compile diagnostics must be empty; compileSnapshot threw${details ? `:\n${details}` : ""}`);
}
const compileDiagnostics = Array.isArray(prepared.diagnostics) ? prepared.diagnostics : [];
if (compileDiagnostics.length > 0) {
  const details = compileDiagnostics.slice(0, 5).map(formatDiagnostic).join("\n");
  throw new Error(`snapshot compile diagnostics must be empty, got ${compileDiagnostics.length}:\n${details}`);
}

const trialResult = engine.runPipeline(prepared, { pipelineId: entrypoints[0], payload: {}, context: {} });
assertEqual(trialResult.ruleset?.engineVersion, installedJsonspecsVersion, "runtime ruleset engineVersion");

console.log(`Package consistency OK: ${version}, jsonspecs ${installedJsonspecsVersion}, ${snapshot.artifacts.length} artifacts, ${entrypoints.length} entrypoints, sourceHash ${sourceHash}`);
