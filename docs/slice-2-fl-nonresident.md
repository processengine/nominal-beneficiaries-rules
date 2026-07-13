# Slice 2: FL_NONRESIDENT validate-application

## Scope

Второй слайс добавляет в пакет контур `FL_NONRESIDENT`
validate-application рядом с уже перенесенным `FL_RESIDENT`.

Точка входа:

```text
entrypoints.fl_nonresident.full_validation
```

Источник синхронизации:

```text
../processor-preprod/artifacts/fl-nonresident.registration/subflows/validate-application-v1/rules.snapshot.json
```

## Merge Model

Пакет собирается из двух processor snapshots.

- Идентичные artifacts переиспользуются как общие `library.*`.
- Разные artifacts с одинаковым legacy-id не склеиваются молча.
- Вариант ФЛ-нерезидента получает scoped-id `library.fl_nonresident.*`.

Текущий отчет генерации лежит в:

```text
docs/sync-report.json
```

Он фиксирует:

- сколько artifacts переиспользовано;
- какие legacy-id стали scoped;
- какие check-коды получили namespace.

## Code Namespace

Legacy processor snapshots допускают одинаковые `code` в разных контурах.
`jsonspecs` требует уникальный `code` внутри одного compiled snapshot.

Поэтому только для физически разных нерезидентских check-правил с
дублирующимся кодом пакет генерирует:

```text
FL_NONRESIDENT.<legacy-code>
```

Исходный processor-код сохраняется в:

```json
{
  "meta": {
    "legacyCode": "<legacy-code>"
  }
}
```

Parity harness сравнивает результат с legacy snapshot по `legacyCode`.
Runtime-подключение processor маппит такие коды обратно в `legacyCode` перед
возвратом результата RULES наружу, чтобы не менять merchant-facing контракт.

## Verification

Обязательный локальный прогон:

```bash
npm run sync
npm test
```

Текущий parity-набор:

- 6 samples для `FL_RESIDENT`;
- 4 samples для `FL_NONRESIDENT`.

## Not Done In This Slice

- Processor runtime был переключен отдельными processor slices после подготовки
  пакета.
- NPM package был опубликован отдельным release slice.
- Общие FL-блоки пока не переписаны вручную в новые library pipelines.
  Слайс только отделяет реально разные legacy-варианты и доказывает parity.
