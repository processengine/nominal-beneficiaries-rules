import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Проверяет согласованность опубликованного пакета после канонической сборки CLI.
 * Здесь нет второго builder: скрипт только сверяет версии, хеш, exports,
 * provenance внешних операторов и фактическую компилируемость snapshot.
 */

const require = createRequire(import.meta.url);
const rules = require("@jsonspecs/rules");
const rulesPackage = require("@jsonspecs/rules/package.json");
const operators = require("../operators/node/index.js");
const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const requirementDocument = "Бизнес-требования для работы с бенефициарами номинальных счетов.docx";
const requirementDocumentSha256 = "sha256:521375fedfffed655736cadc6d13bd564d55aef68777cc8a3f96d24bc6235578";

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const manifest = readJson("manifest.json");
const snapshot = readJson(path.join(manifest.paths.dist, manifest.build.snapshotFile));
const buildInfo = readJson(path.join(manifest.paths.dist, manifest.build.buildInfoFile));

assertEqual(packageLock.version, packageJson.version, "package-lock version");
assertEqual(packageLock.packages?.[""]?.version, packageJson.version, "lock root version");
assertEqual(manifest.project.version, packageJson.version, "manifest project version");
assertEqual(manifest.specVersion, "1.0.0-rc.7", "manifest specVersion");
assertEqual(snapshot.format, "jsonspecs-snapshot", "snapshot format");
assertEqual(snapshot.formatVersion, 2, "snapshot formatVersion");
assertEqual(snapshot.specVersion, manifest.specVersion, "snapshot specVersion");
assertEqual(snapshot.exports, manifest.exports, "snapshot exports");
assertEqual(snapshot.sourceHash, rules.computeSourceHash(snapshot), "snapshot sourceHash");

const artifactIds = Object.keys(snapshot.artifacts);
assertEqual(buildInfo.project?.id, manifest.project.id, "build-info project id");
assertEqual(buildInfo.project?.version, packageJson.version, "build-info project version");
assertEqual(buildInfo.runtime?.package, "@jsonspecs/rules", "build-info runtime package");
assertEqual(buildInfo.runtime?.version, rulesPackage.version, "build-info runtime version");
assertEqual(buildInfo.specVersion, snapshot.specVersion, "build-info specVersion");
assertEqual(buildInfo.sourceHash, snapshot.sourceHash, "build-info sourceHash");
assertEqual(buildInfo.exports, snapshot.exports, "build-info exports");
assertEqual(buildInfo.artifactCount, artifactIds.length, "build-info artifact count");
assertEqual(buildInfo.warningCount, 0, "build-info warning count");
assertEqual(buildInfo.diagnosticCount, 0, "build-info diagnostic count");

const localPack = buildInfo.operatorPacks?.find((pack) => pack.specifier === "./operators/node");
assert(localPack, "build-info must identify ./operators/node");
assert(/^sha256:[0-9a-f]{64}$/.test(localPack.digest || ""), "operator pack must have sha256 digest");
assertEqual(Object.keys(operators).sort(), [
  "inn_not_repeated",
  "is_iso_date",
  "passport_rf_issued_at_or_after_age",
  "passport_rf_valid_after_replacement_age",
  "valid_inn",
], "published operator set");

assertEqual(
  Object.keys(manifest.catalog.artifacts).sort(),
  artifactIds.slice().sort(),
  "artifact catalog must match executable closure",
);
assertEqual(
  Object.keys(manifest.catalog.entrypoints).sort(),
  snapshot.exports.slice().sort(),
  "entrypoint catalog must match exports",
);
for (const [field, metadata] of Object.entries(manifest.catalog.fields)) {
  assert(!Object.hasOwn(metadata, "btName"), `${field}: obsolete btName is forbidden`);
  assert(!Object.hasOwn(metadata, "businessDescription"), `${field}: obsolete businessDescription is forbidden`);
  assert(typeof metadata.description === "string" && metadata.description.trim().length > 0,
    `${field}: catalog description is required`);
}

const executableFields = new Set();
for (const artifact of Object.values(snapshot.artifacts)) {
  if (artifact.field) executableFields.add(artifact.field);
  if (artifact.value_field) executableFields.add(artifact.value_field);
  for (const field of artifact.fields || []) executableFields.add(field);
  for (const field of Object.values(artifact.inputs || {})) executableFields.add(field);
}
assertEqual(
  Object.keys(manifest.catalog.fields).sort(),
  [...executableFields].sort(),
  "field catalog must match executable paths",
);
const executableOperators = new Set(
  Object.values(snapshot.artifacts).map((artifact) => artifact.operator).filter(Boolean),
);
assertEqual(
  Object.keys(manifest.catalog.operators).sort(),
  [...executableOperators].sort(),
  "operator catalog must match executable operators",
);

const issueArtifacts = Object.entries(snapshot.artifacts)
  .filter(([, artifact]) => artifact.issue?.code);
for (const [id, artifact] of issueArtifacts) {
  const meta = artifact.issue.meta;
  assert(meta && typeof meta === "object" && !Array.isArray(meta), `${id}: issue.meta is required`);
  assert(Array.isArray(meta.requirements) && meta.requirements.length > 0,
    `${id}: issue.meta.requirements must be a non-empty array`);
  for (const reference of meta.requirements) {
    assertEqual(reference.document, requirementDocument, `${id}: requirement document`);
    assertEqual(reference.documentSha256, requirementDocumentSha256, `${id}: requirement document SHA-256`);
    assert(typeof reference.section === "string" && reference.section.trim().length > 0,
      `${id}: requirement section is required`);
    assert(typeof reference.item === "string" && reference.item.trim().length > 0,
      `${id}: requirement item is required`);
    assert(Number.isInteger(reference.page) && reference.page > 0,
      `${id}: positive requirement page is required`);
    assertEqual(reference.pageKind, "section-start", `${id}: requirement page kind`);
  }
  if (meta.explanation !== undefined) {
    assert(typeof meta.explanation === "string" && meta.explanation.trim().length > 0,
      `${id}: issue.meta.explanation must be a non-empty string`);
  }
}

const sampleFiles = readdirSync(path.join(rootDir, manifest.paths.samples))
  .filter((file) => file.endsWith(".json"));
const sampleIssueCodes = new Set();
let hasNullBoundarySample = false;
for (const file of sampleFiles) {
  const sample = readJson(path.join(manifest.paths.samples, file));
  for (const issue of sample.expect?.issues || []) {
    if (typeof issue.code === "string") sampleIssueCodes.add(issue.code);
  }
  if (sample.coverage?.includes("null")) hasNullBoundarySample = true;
}
const uncoveredIssueCodes = [...new Set(issueArtifacts.map(([, artifact]) => artifact.issue.code))]
  .filter((code) => !sampleIssueCodes.has(code))
  .sort();
assertEqual(uncoveredIssueCodes, [], "every reachable issue code must have a sample");
assert(hasNullBoundarySample, "samples must include null boundary coverage");

const prepared = rules.createEngine({ operators }).compileSnapshot(snapshot);
const result = rules.runPipeline(prepared, {
  pipelineId: manifest.exports[0],
  payload: {},
  context: {},
});
assertEqual(result.ruleset, {
  specVersion: snapshot.specVersion,
  sourceHash: snapshot.sourceHash,
}, "runtime ruleset provenance");

const forbiddenRoots = ["field-contracts", "test-fixtures"];
for (const root of forbiddenRoots) {
  assert(!readdirSync(rootDir).includes(root), `${root}/ must not return to the v1 package`);
}

console.log(
  `Package consistency OK: ${packageJson.version}, Rules ${rulesPackage.version}, `
  + `${artifactIds.length} artifacts, ${snapshot.exports.length} exports, `
  + `${issueArtifacts.length} issue rules, ${sampleFiles.length} samples, ${snapshot.sourceHash}`,
);
