# Agent entrypoint

Этот файл обязателен для любого AI-агента, работающего в репозитории пакета
правил.

Перед нетривиальной задачей прочитай:

```text
README.md
docs/README.md
docs/release-procedure.md
релевантный docs/slice-*.md или docs/dedupe-audit-fl-ip.md
```

Начинай работу с короткого Task Packet: цель, затрагиваемые контуры,
проверяемые бизнес-инварианты, ожидаемые артефакты и явные Assumptions.

## Приоритет источников

```text
rules + samples + тесты
> manifest.json + field-contracts
> актуальная документация
> dist (генерируемый результат)
```

`dist/snapshot.json` и `dist/build-info.json` нельзя редактировать вручную.
Они пересобираются командой `npm test` и должны остаться детерминированными.
Канонический builder — `scripts/build.mjs`; generic `jsonspecs build` и
сторонние validators разрешены только в disposable copy, поскольку могут
использовать несовместимую hash/engine семантику.

## Граница пакета

- Этот репозиторий является source of truth для активных RULES-контуров.
- Не синхронизируй правила из processor и не восстанавливай processor-local
  snapshots или vendored bundle как источник истины.
- Сохраняй стабильные entrypoint id, публичные error codes и package/runtime
  provenance. Изменение бизнес-семантики требует samples и проверки ожидаемых
  issues; `legacyParity: false` допустим только как явное документированное
  решение.
- Новые или изменённые поля должны быть согласованы с `manifest.json`,
  соответствующим `field-contracts/*` и slice-документацией.
- Не смешивай бизнес-правила с processor flow/FUNC, transport, effect/wait или
  orchestrator lifecycle.

## Обязательная проверка

После содержательных изменений выполни:

```bash
npm test
npm pack --dry-run --ignore-scripts
```

Проверь, что повторный `npm test` не меняет tracked files. Перед передачей
результата покажи `git status --short` и явно перечисли непроверенные пункты.

## Релизы

Для любого релиза полностью следуй `docs/release-procedure.md`.

Запрещено:

- выполнять `npm publish` из локального checkout;
- публиковать из dirty worktree, без отдельного release commit или без exact
  tag `v<package.json version>`;
- запускать release с ветки или через ручной `workflow_dispatch`;
- переиспользовать опубликованную версию, переставлять или перезаписывать tag;
- обходить lifecycle guards через `--ignore-scripts`;
- включать токены, registry credentials или внутренние endpoints в файлы и
  логи.

Публикацию выполняет только tag-triggered GitHub Actions workflow. Он проверяет
clean commit/tag, принадлежность commit ветке `origin/main`, тесты, содержимое
tarball, уникальность версии и публикует npm provenance attestation.
