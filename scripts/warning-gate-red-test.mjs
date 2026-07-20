import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const tempDir = mkdtempSync(path.join(tmpdir(), "nominal-beneficiaries-warning-gate-"));
const manifest = JSON.parse(readFileSync(path.join(rootDir, "manifest.json"), "utf8"));
const distFiles = [
  path.join("dist", manifest.build.snapshotFile),
  path.join("dist", manifest.build.buildInfoFile),
];

try {
  copyProjectEntry("manifest.json");
  copyProjectEntry("rules");
  copyProjectEntry("scripts");
  copyProjectEntry("operators");
  copyProjectEntry("dist");
  linkNodeModules();

  const before = new Map(distFiles.map((file) => [file, fileHash(path.join(tempDir, file))]));
  writeDangerousRegexProbe();

  const result = spawnSync(process.execPath, ["scripts/build.mjs"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;

  if (result.status === 0) {
    throw new Error("warning gate red test expected build to fail, but it exited with 0");
  }
  if (!output.includes("REGEX_REDOS_RISK")) {
    throw new Error(`warning gate red test expected REGEX_REDOS_RISK diagnostic, got:\n${output}`);
  }
  for (const [file, hash] of before) {
    const afterHash = fileHash(path.join(tempDir, file));
    if (afterHash !== hash) {
      throw new Error(`warning gate red test changed ${file}; warning failures must not write dist`);
    }
  }

  console.log("Warning gate red test OK: dangerous regex fails before writing dist");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function copyProjectEntry(entry) {
  cpSync(path.join(rootDir, entry), path.join(tempDir, entry), { recursive: true });
}

function linkNodeModules() {
  const nodeModules = path.join(rootDir, "node_modules");
  if (!existsSync(nodeModules)) {
    throw new Error("node_modules not found; run npm ci before warning gate red test");
  }
  symlinkSync(nodeModules, path.join(tempDir, "node_modules"), "dir");
}

function writeDangerousRegexProbe() {
  const probePath = path.join(tempDir, "rules", "library", "__warning_gate_red_test.json");
  writeFileSync(probePath, `${JSON.stringify({
    id: "library.__warning_gate_red_test",
    type: "rule",
    description: "Synthetic warning gate regression probe",
    role: "check",
    operator: "matches_regex",
    field: "__warningGateProbe",
    level: "ERROR",
    code: "WARNING_GATE.REDOS_PROBE",
    message: "Synthetic warning gate regression probe",
    value: "^(a+)+$",
  }, null, 2)}\n`);
}

function fileHash(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}
