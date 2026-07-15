import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
const expectedTag = `v${packageJson.version}`;

function git(args) {
  return execFileSync("git", args, { cwd: rootDir, encoding: "utf8" }).trim();
}

const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
if (status) {
  throw new Error(`Release requires a clean worktree. Commit or remove these changes:\n${status}`);
}

const head = git(["rev-parse", "HEAD"]);
const tagsAtHead = git(["tag", "--points-at", "HEAD"]).split("\n").filter(Boolean);
if (!tagsAtHead.includes(expectedTag)) {
  throw new Error(`Release requires exact tag ${expectedTag} at HEAD ${head}`);
}

if (process.env.GITHUB_ACTIONS === "true") {
  if (process.env.GITHUB_EVENT_NAME !== "push" || process.env.GITHUB_REF_TYPE !== "tag") {
    throw new Error("Release workflow must run from a pushed tag, not workflow_dispatch or a branch");
  }
  if (process.env.GITHUB_REF_NAME !== expectedTag) {
    throw new Error(`GitHub ref ${process.env.GITHUB_REF_NAME} does not match ${expectedTag}`);
  }
  if (process.env.GITHUB_SHA !== head) {
    throw new Error(`GitHub SHA ${process.env.GITHUB_SHA} does not match checkout HEAD ${head}`);
  }
}

console.log(`Release state OK: clean commit ${head} with exact tag ${expectedTag}`);
