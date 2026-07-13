import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildOperatorPack } from "./operators.mjs";

const require = createRequire(import.meta.url);
const jsonspecs = require("jsonspecs");
const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const manifest = JSON.parse(readFileSync(path.join(rootDir, "manifest.json"), "utf8"));

function readArtifacts(dir) {
  const result = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      result.push(...readArtifacts(fullPath));
      continue;
    }
    if (entry.endsWith(".json")) {
      result.push(JSON.parse(readFileSync(fullPath, "utf8")));
    }
  }
  return result;
}

const artifacts = readArtifacts(path.join(rootDir, manifest.paths.rules))
  .sort((left, right) => left.id.localeCompare(right.id));

const snapshot = {
  format: "jsonspecs-snapshot",
  formatVersion: 1,
  sourceHash: jsonspecs.computeSourceHash(artifacts),
  engine: {
    minVersion: "2.0.0",
  },
  artifacts,
  meta: {
    projectId: manifest.project.id,
    projectTitle: manifest.project.title,
    description: manifest.project.description,
    rulesetVersion: manifest.project.version,
  },
};

const engine = jsonspecs.createEngine({ operators: buildOperatorPack() });
engine.compileSnapshot(snapshot);

const distDir = path.join(rootDir, manifest.paths.dist);
mkdirSync(distDir, { recursive: true });
writeFileSync(path.join(distDir, manifest.build.snapshotFile), `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(path.join(distDir, manifest.build.buildInfoFile), `${JSON.stringify({
  projectId: manifest.project.id,
  rulesetVersion: manifest.project.version,
  artifactCount: artifacts.length,
  sourceHash: snapshot.sourceHash,
  builtAt: new Date().toISOString(),
}, null, 2)}\n`);

console.log(`Built ${manifest.build.snapshotFile}: ${artifacts.length} artifacts, sourceHash ${snapshot.sourceHash}`);
