# Обязательная процедура релиза

Публикация выполняется только GitHub Actions по exact tag и npm trusted
publishing. Локальный `npm publish` блокируется `prepublishOnly`.

## 1. Подготовка версии

Начни с чистого актуального `main` и проверь, что версия свободна:

```bash
git fetch origin --tags
git status --short
git tag --list 'vX.Y.Z'
npm view '@processengine/nominal-beneficiaries-rules@X.Y.Z' version
npm run version:set -- X.Y.Z
```

`version:set` синхронно обновляет package, lock и manifest. После него нельзя
редактировать `dist/*` вручную.

## 2. Проверка содержимого

```bash
npm ci
npm test
npm audit --omit=dev
npm pack --dry-run --ignore-scripts
git diff --check
git status --short
```

`dist/` генерируется CLI и игнорируется Git, но включается в npm-пакет через
`package.json.files`. Ревьюируется исходный проект и результат локальной сборки;
sourceHash из `dist/snapshot.json` должен совпадать с выводом `npm test`.

## 3. Release commit и tag

```bash
git add <только проверенные файлы>
git commit -m 'rules: release X.Y.Z'
git status --short
git tag -a vX.Y.Z -m 'vX.Y.Z'
npm run release:check
```

`release:check` требует чистый HEAD и exact tag `v<package.json version>`. Tag
нельзя переставлять после отправки. Исправление опубликованной версии всегда
выходит новым patch-релизом.

## 4. Публикация

```bash
git push --atomic origin main vX.Y.Z
```

Release workflow проверяет принадлежность commit ветке `origin/main`, повторяет
тесты, проверяет уникальность npm-версии и публикует с provenance attestation.
Trusted publisher для пакета должен указывать этот GitHub-репозиторий и файл
`.github/workflows/release.yml`; постоянный `NPM_TOKEN` не используется.

## 5. Проверка registry

```bash
release_commit="$(git rev-list -n 1 vX.Y.Z)"
npm view '@processengine/nominal-beneficiaries-rules@X.Y.Z' version gitHead dist.integrity
```

Workflow дополнительно сравнивает опубликованные `snapshot.json`,
`build-info.json` и `operators/node/index.js` с файлами, созданными в release
job. Поле `build-info.json.builtAt` в сравнении не участвует:
`prepublishOnly` повторно собирает пакет непосредственно перед публикацией и
закономерно меняет время сборки. Все остальные поля должны совпасть.
Downstream-сервис фиксирует точную версию пакета, а не диапазон или tag.
