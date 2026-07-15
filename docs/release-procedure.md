# Обязательная процедура релиза

Статус: текущая обязательная инструкция для людей и AI-агентов.

Цель процедуры — обеспечить однозначную цепочку:

```text
rules source -> deterministic dist -> clean release commit -> exact git tag
-> GitHub Actions -> npm version with matching gitHead and provenance
```

Ручная публикация из рабочего checkout запрещена. `prepublishOnly` блокирует
обычный локальный `npm publish`; release workflow не имеет `workflow_dispatch`
и запускается только pushed tag вида `vX.Y.Z`.

## 1. Подготовка версии

Начинай от актуального `main` без локальных изменений. Убедись, что целевая
версия ещё не существует ни в git, ни в npm:

```bash
git fetch origin --tags
git status --short
git tag --list 'vX.Y.Z'
npm view '@processengine/nominal-beneficiaries-rules@X.Y.Z' version
```

Для ещё не опубликованной версии последняя команда должна завершиться с
`E404`. Затем синхронно обнови package, lock и manifest:

```bash
npm run version:set -- X.Y.Z
```

Не используй `npm version` как shortcut: версия пакета хранится не только в
`package.json`, а tag разрешено создавать лишь после всех проверок и release
commit.

## 2. Проверка содержимого

Внеси изменения в source artifacts, samples, field contracts и документацию.
Не редактируй `dist/*` вручную. Затем выполни:

```bash
npm test
npm pack --dry-run --ignore-scripts
git diff --check
git status --short
```

`npm test` обязан:

- собрать snapshot;
- проверить parity и sample expectations;
- подтвердить синхронность версий, artifact count и source hash;
- оставить повторную сборку без нового diff.

Просмотри полный diff и список файлов tarball. В release commit не должно быть
посторонних файлов, секретов или локальных evidence dumps.

## 3. Clean commit и exact tag

Создай один осмысленный release commit, затем проверь чистоту:

```bash
git add <только проверенные файлы релиза>
git commit -m 'правила: выпустить пакет X.Y.Z'
git status --short
git tag -a vX.Y.Z -m 'vX.Y.Z'
npm run release:check
```

`git status --short` должен быть пустым. `release:check` повторяет тесты,
проверяет tarball и откажет без чистого worktree и exact tag
`v<package.json version>` на `HEAD`.

Tag нельзя передвигать после проверки. Если обнаружена ошибка, удали только
неотправленный локальный tag, исправь версию/commit и пройди процедуру заново.
Опубликованный tag и опубликованная npm-версия неизменяемы; исправление всегда
выходит новой patch-версией.

## 4. Публикация только через GitHub Actions

Отправь release commit и exact tag одной атомарной операцией:

```bash
git push --atomic origin main vX.Y.Z
```

Release workflow дополнительно проверяет, что tagged commit принадлежит
`origin/main`, версия ещё не опубликована, checkout чист, generated artifacts
закоммичены и tarball собирается. Публикация выполняется командой npm с
provenance attestation. Токен публикации хранится только в GitHub Actions.

## 5. Проверка опубликованного результата

Дождись успешного workflow и сравни npm metadata с release commit:

```bash
release_commit="$(git rev-list -n 1 vX.Y.Z)"
npm view '@processengine/nominal-beneficiaries-rules@X.Y.Z' version gitHead dist.integrity
```

Обязательные условия:

- `version` равен `X.Y.Z`;
- `gitHead` равен `$release_commit`;
- registry вернул `dist.integrity`;
- workflow post-publish check сравнил опубликованные `snapshot.json`,
  `build-info.json` и operator pack с release commit;
- downstream processor фиксирует точную версию, не `^`, `~`, `latest` или
  workspace path.

Только после этих проверок релиз считается завершённым и может подключаться в
processor.
