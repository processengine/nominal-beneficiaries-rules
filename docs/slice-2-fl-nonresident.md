# Slice 2: FL_NONRESIDENT validate-application

Status: historical migration slice; current instructions are in
[`docs/README.md`](./README.md).

## Scope

Второй слайс добавляет в пакет контур `FL_NONRESIDENT`
validate-application рядом с уже перенесенным `FL_RESIDENT`.

Точка входа:

```text
entrypoints.fl_nonresident.full_validation
```

Исходная parity-база миграционного слайса:

```text
test-fixtures/legacy-snapshots/fl-nonresident.validate-application.rules.snapshot.json
```

## Merge Model

Пакет собирается из собственных `rules/` artifacts. Frozen fixtures
используются только для регрессионного сравнения результата.

- Идентичные artifacts переиспользуются как общие `library.*`.
- Разные artifacts с одинаковым legacy-id не склеиваются молча.
- Вариант ФЛ-нерезидента получает scoped-id `library.fl_nonresident.*`.

## Code Namespace

Frozen parity fixtures допускают одинаковые `code` в разных контурах.
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
