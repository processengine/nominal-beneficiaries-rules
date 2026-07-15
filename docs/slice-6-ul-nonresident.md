# Slice 6: UL_NONRESIDENT validate-application

Status: historical migration slice; current instructions are in
[`docs/README.md`](./README.md).

## Scope

Шестой слайс добавляет в пакет контур `UL_NONRESIDENT`
validate-application.

Точка входа:

```text
entrypoints.ul_nonresident.full_validation
```

Исходная parity-база миграционного слайса:

```text
test-fixtures/legacy-snapshots/ul-nonresident.validate-application.rules.snapshot.json
```

Слайс переносит только RULES-контур валидации заявки. Root-flow, CFT
create/bind, classify, guard-функции и stand-tested processor behavior остаются
в processor.

## Merge Model

`UL_NONRESIDENT` validation использует юридическое лицо-нерезидента как
отдельную payload family:

- `beneficiary.inn` или `beneficiary.ul.kio`;
- `beneficiary.contacts`;
- `beneficiary.ul`;
- `beneficiary.ul.registration`;
- `beneficiary.address.legal`;
- `beneficiary.tax`;
- `beneficiary.status`;
- `beneficiary.participationId`;
- `beneficiary.account.number`.

Модель сборки:

- идентичные artifacts остаются общими;
- отличающиеся UL nonresident проверки получают `library.ul_nonresident.*`;
- конфликтующие common status checks получают `library.ul_nonresident.*`;
- внутренние блоки получают собственное пространство
  `internal.ul_nonresident.*`.

## Code Namespace

Если UL nonresident-specific check физически отличается от уже существующего
check с тем же legacy-кодом, package code получает префикс:

```text
UL_NONRESIDENT.<legacy-code>
```

Исходный processor-код сохраняется в `meta.legacyCode`. Parity harness и
processor runtime используют `legacyCode` для публичного результата, чтобы
переезд в пакет не менял merchant-facing коды ошибок.

## Verification

Обязательный локальный прогон:

```bash
npm test
npm pack --dry-run
```

Текущий parity-набор:

- 6 samples для `FL_RESIDENT`;
- 4 samples для `FL_NONRESIDENT`;
- 5 samples для `IP_RESIDENT`;
- 5 samples для `IP_NONRESIDENT`;
- 4 samples для `UL_RESIDENT`;
- 6 samples для `UL_NONRESIDENT`.

## Processor Switch

После публикации `0.6.0` processor artifact
`ul_nonresident.validate_application` был переключен на package-backed
`rulesetRef`. Тем самым package-backed миграция active
`validate_application` contours закрыта для FL/IP/UL resident/nonresident.

## Not Done In This Slice

- `beneficiary.unbind` перенесен в package-backed rules отдельным слайсом.
- Физическая дедупликация общих FL/IP/UL library pipelines остается отдельным
  design slice после завершения package-backed миграции активных validation
  contours.
