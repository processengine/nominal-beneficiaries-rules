import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const version = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  throw new Error("Usage: npm run version:set -- <major.minor.patch>");
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  writeFileSync(path.join(rootDir, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const manifest = readJson("manifest.json");

packageJson.version = version;
packageLock.version = version;
packageLock.packages[""].version = version;
manifest.project.version = version;

writeJson("package.json", packageJson);
writeJson("package-lock.json", packageLock);
writeJson("manifest.json", manifest);

console.log(`Version synchronized to ${version}; run npm test to rebuild dist.`);
