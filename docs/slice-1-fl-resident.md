# Slice 1: FL_RESIDENT validate-application

## Scope

Первый слайс переносит `FL_RESIDENT` validate-application из
`processor-preprod` в отдельный jsonspecs package.

Точка входа:

```text
entrypoints.fl_resident.full_validation
```

Источник синхронизации:

```text
../processor-preprod/artifacts/fl-resident.registration/subflows/validate-application-v1/rules.snapshot.json
```

## Intentional Deltas

Слайс сохраняет результат legacy snapshot, кроме явно улучшенных guard-сценариев.

1. `library.documents.issue_date_not_future` больше не выполняется дважды.
   Legacy snapshot возвращал две одинаковые ошибки для будущей даты выдачи
   документа; новый пакет сохраняет одну ошибку.

2. Налоговые флаги разложены на guard-слои:
   - поле обязательно;
   - если поле передано, оно должно быть `true` или `false`;
   - если тип корректный, значение `true` проверяется бизнес-запретом.

3. Технический dictionary `true_false` удалён. Проверка типа выполняется
   оператором `is_boolean`, потому что boolean type check не является
   бизнес-справочником.

Samples с намеренным отличием от legacy помечаются:

```json
{ "legacyParity": false }
```

## Verification

Обязательный локальный прогон:

```bash
npm test
node /Users/vladimirtitskiy/Dev/jsonspecs-rule-author/scripts/validate-package.mjs .
```

`npm test` сравнивает legacy snapshot и jsonspecs snapshot по:

- `status`;
- `control`;
- issues: `level`, `code`, `field`, `message`.

## Next Slices

1. Второй validate-application contour перенесен в
   [slice-2-fl-nonresident.md](./slice-2-fl-nonresident.md).
2. После второго потребителя выделять общие pipelines вместо физического
   копирования блоков.
3. Подключить package в `processor-preprod` через `rulesEngine` как внешний
   rules package без удаления local fallback.
