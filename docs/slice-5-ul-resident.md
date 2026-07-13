# Slice 5: UL_RESIDENT validate-application

## Scope

Пятый слайс добавляет в пакет контур `UL_RESIDENT` validate-application.

Точка входа:

```text
entrypoints.ul_resident.full_validation
```

Источник синхронизации:

```text
../processor-preprod/artifacts/ul-resident.registration/subflows/validate-application-v1/rules.snapshot.json
```

Слайс переносит только RULES-контур валидации заявки. Root-flow,
registry-reconcile, CFT create/bind и guard-функции остаются в processor.

## Merge Model

`UL_RESIDENT` validation использует юридическое лицо как отдельную payload
family:

- `beneficiary.inn`;
- `beneficiary.contacts`;
- `beneficiary.address.legal`;
- `beneficiary.tax`;
- `beneficiary.status`;
- `beneficiary.groundForParticipation`;
- `beneficiary.account.number`.

Модель сборки:

- идентичные artifacts остаются общими;
- UL-specific проверки получают `library.ul.*`;
- конфликтующие с уже перенесенными правилами common status checks получают
  `library.ul_resident.*`;
- внутренние блоки получают собственное пространство
  `internal.ul_resident.*`.

## Code Namespace

Если UL resident-specific check физически отличается от уже существующего
check с тем же legacy-кодом, package code получает префикс:

```text
UL_RESIDENT.<legacy-code>
```

Исходный processor-код сохраняется в `meta.legacyCode`. Parity harness и
processor runtime используют `legacyCode` для публичного результата, чтобы
переезд в пакет не менял merchant-facing коды ошибок.

## Verification

Обязательный локальный прогон:

```bash
npm run sync
npm test
npm pack --dry-run
```

Текущий parity-набор:

- 6 samples для `FL_RESIDENT`;
- 4 samples для `FL_NONRESIDENT`;
- 5 samples для `IP_RESIDENT`;
- 5 samples для `IP_NONRESIDENT`;
- 4 samples для `UL_RESIDENT`.

## Not Done In This Slice

- Processor artifact `ul_resident.validate_application` переключается
  отдельным processor slice после публикации пакета.
- `UL_NONRESIDENT` не переносится этим изменением.
- Общие UL resident/nonresident проверки не выделяются вручную до parity
  `UL_NONRESIDENT`.
