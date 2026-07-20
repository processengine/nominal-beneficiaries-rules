# Changelog

## [0.8.3] - 2026-07-20

- Added a red regression test for the warning gate: a synthetic dangerous regex must fail build before writing `dist`.
- Raised the jsonspecs dependency range to `^2.3.2` and rebuilt release metadata with engine `2.3.2`.
- Pinned GitHub Actions dependencies by full commit SHA in CI and release workflows.

## [0.8.2] - 2026-07-20

- Added warning diagnostics gates in CI/build.
- Switched local `not_true` and `is_boolean` compatibility coverage to built-in jsonspecs operators.
- Raised the jsonspecs dependency range to `^2.3.1`.
- Added package provenance checks for engine version, snapshot compatibility, zero diagnostics, and runtime ruleset metadata.
