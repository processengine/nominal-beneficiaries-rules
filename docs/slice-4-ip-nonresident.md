# Slice 4: IP_NONRESIDENT validate-application

## Scope

Четвертый слайс добавляет в пакет контур `IP_NONRESIDENT`
validate-application.

Точка входа:

```text
entrypoints.ip_nonresident.full_validation
```

Источник синхронизации:

```text
../processor-preprod/artifacts/ip-nonresident.registration/subflows/validate-application-v1/rules.snapshot.json
```

Root-процесс `ip-nonresident.registration` в processor остается временно
замороженным по продуктовому решению. Этот slice переносит только
самостоятельный validation artifact, который уже покрыт локальными тестами.

## Merge Model

`IP_NONRESIDENT` validation использует nonresident FL field family и добавляет
merchant-provided registration fields для ИП:

- `beneficiary.ip.fullName`;
- `beneficiary.ip.shortName`;
- `beneficiary.ip.registration.number`;
- `beneficiary.ip.registration.date`;
- `beneficiary.ip.registration.agency`;
- `beneficiary.ip.registration.agencyCode`;
- `beneficiary.ip.registration.agencyAddress`.

Модель сборки:

- идентичные `library.*` artifacts переиспользуются;
- IP nonresident-specific варианты получают `library.ip_nonresident.*`;
- внутренние блоки получают собственное пространство
  `internal.ip_nonresident.*`;
- FL nonresident addDoc/tax/address behavior сохраняется в режиме parity.

## Code Namespace

Если IP nonresident-specific check физически отличается от уже существующего
check с тем же legacy-кодом, package code получает префикс:

```text
IP_NONRESIDENT.<legacy-code>
```

Исходный processor-код сохраняется в `meta.legacyCode`. Parity harness и
processor runtime используют `legacyCode` для публичного результата, чтобы
переезд в пакет не менял merchant-facing коды ошибок.

## Verification

Обязательный локальный прогон:

```bash
npm run sync
npm test
```

Текущий parity-набор:

- 6 samples для `FL_RESIDENT`;
- 4 samples для `FL_NONRESIDENT`;
- 5 samples для `IP_RESIDENT`;
- 5 samples для `IP_NONRESIDENT`.

## Not Done In This Slice

- Processor artifact `ip_nonresident.validate_application` переключается
  отдельным processor slice после публикации пакета.
- Root `ip-nonresident.registration` не размораживается этим изменением.
- Общие nonresident FL/IP блоки пока не переписаны вручную в новые library
  pipelines. Этот слайс доказывает parity и фиксирует корректные границы
  package layout.
