import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const jsonspecs = require("jsonspecs");
const rootDir = path.resolve(new URL("..", import.meta.url).pathname);

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const manifest = readJson("manifest.json");
const snapshot = readJson(path.join(manifest.paths.dist, manifest.build.snapshotFile));
const buildInfo = readJson(path.join(manifest.paths.dist, manifest.build.buildInfoFile));
const version = packageJson.version;

assertEqual(packageLock.version, version, "package-lock.json version");
assertEqual(packageLock.packages?.[""]?.version, version, "package-lock.json root package version");
assertEqual(manifest.project.version, version, "manifest project version");
assertEqual(snapshot.meta?.rulesetVersion, version, "snapshot ruleset version");
assertEqual(buildInfo.rulesetVersion, version, "build-info ruleset version");
assertEqual(snapshot.meta?.projectId, manifest.project.id, "snapshot project id");
assertEqual(buildInfo.projectId, manifest.project.id, "build-info project id");
assertEqual(buildInfo.artifactCount, snapshot.artifacts?.length, "build-info artifact count");

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

console.log(`Package consistency OK: ${version}, ${snapshot.artifacts.length} artifacts, ${entrypoints.length} entrypoints, sourceHash ${sourceHash}`);
