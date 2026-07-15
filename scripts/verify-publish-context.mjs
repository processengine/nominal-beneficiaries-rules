const packageVersion = process.env.npm_package_version;
const expectedTag = `v${packageVersion}`;

if (process.env.GITHUB_ACTIONS !== "true"
  || process.env.GITHUB_EVENT_NAME !== "push"
  || process.env.GITHUB_REF_TYPE !== "tag"
  || process.env.GITHUB_REF_NAME !== expectedTag) {
  throw new Error(
    `npm publish is allowed only in GitHub Actions for pushed tag ${expectedTag}. `
    + "Push the clean release commit and its tag; do not publish from a developer checkout.",
  );
}

console.log(`Publish context OK: GitHub Actions tag ${expectedTag}`);
