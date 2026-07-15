# Documentation entrypoint

Этот файл задаёт порядок чтения документации пакета правил.

## Текущие инструкции

- [`../AGENTS.md`](../AGENTS.md) — обязательные правила работы AI-агентов;
- [`release-procedure.md`](release-procedure.md) — обязательная процедура
  clean commit/tag/npm release;
- [`parity.md`](parity.md) — текущий регрессионный контракт;
- [`../README.md`](../README.md) — runtime scope, entrypoints и package layout.

## История и rationale

`slice-1-fl-resident.md` … `slice-7-beneficiary-unbind.md` фиксируют
последовательные этапы миграции. `dedupe-audit-fl-ip.md` фиксирует состояние
отдельного dedupe-аудита на указанную в документе дату. Их sample/artifact
counts и команды не являются текущей инструкцией; для текущего состояния
используй source, `npm test`, `parity.md` и release procedure.

При конфликте действует приоритет:

```text
rules + samples + tests
> manifest.json + field-contracts
> current docs listed above
> dated slice/audit documents
> generated dist
```

Канонический builder пакета — только `scripts/build.mjs`, вызываемый через
`npm test`. Не запускай generic `jsonspecs build` или сторонний package
validator в рабочем checkout: другая версия CLI может перезаписать snapshot с
иной hash/engine семантикой. Внешние аудиты выполняй только в disposable copy,
не перенося сгенерированный `dist` обратно без отдельного решения.
