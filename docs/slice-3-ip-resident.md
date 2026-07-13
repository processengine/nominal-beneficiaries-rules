# Slice 3: IP_RESIDENT validate-application

## Scope

Третий слайс добавляет в пакет контур `IP_RESIDENT` validate-application.

Точка входа:

```text
entrypoints.ip_resident.full_validation
```

Источник синхронизации:

```text
../processor-preprod/artifacts/ip-resident.registration/subflows/validate-application-v1/rules.snapshot.json
```

## Merge Model

`IP_RESIDENT` validation использует resident FL field family для проверки
ФЛ-данных владельца ИП, но остаётся отдельным entrypoint с типом
`IP_RESIDENT`.

Модель сборки:

- идентичные `library.*` artifacts переиспользуются;
- IP-специфичные варианты получают `library.ip_resident.*`;
- унаследованные из FL resident `internal.fl_resident.*` artifacts при переносе
  получают собственное пространство `internal.ip_resident.*`, чтобы не ломать
  visibility rules jsonspecs и не смешивать контурные внутренние блоки.

## Code Namespace

Если IP-specific check физически отличается от уже существующего check с тем
же legacy-кодом, package code получает префикс:

```text
IP_RESIDENT.<legacy-code>
```

Исходный processor-код сохраняется в:

```json
{
  "meta": {
    "legacyCode": "<legacy-code>"
  }
}
```

Parity harness сравнивает с legacy snapshot по `legacyCode`. Processor runtime
также возвращает наружу `legacyCode`, чтобы пакетизация не меняла коды ошибок
мерчантского контракта.

## Verification

Обязательный локальный прогон:

```bash
npm run sync
npm test
```

Текущий parity-набор:

- 6 samples для `FL_RESIDENT`;
- 4 samples для `FL_NONRESIDENT`;
- 5 samples для `IP_RESIDENT`.

## Not Done In This Slice

- Processor artifact `ip_resident.validate_application` переключается отдельным
  processor slice после публикации пакета.
- Общие resident FL/IP блоки пока не переписаны вручную в новые library
  pipelines. Этот слайс доказывает parity и фиксирует корректные границы
  package layout.
