# Slice 7: beneficiary.unbind

## Scope

Седьмой слайс добавляет в пакет локальный RULES-контур отвязки
`beneficiary.unbind`.

Точки входа:

```text
entrypoints.beneficiary.unbind.type_supported
entrypoints.beneficiary.unbind.field_validation
```

Исходная parity-база миграционного слайса:

```text
test-fixtures/legacy-snapshots/beneficiary-unbind.rules.snapshot.json
```

Слайс переносит только правила валидации отвязки. Сам flow отвязки, команды
`FIND_CLIENT`, `GET_CLIENT`, `UNBIND_CLIENT`, классификация найденной карточки и
runtime-обработка эффектов остаются в processor-preprod.

## Payload

Контур проверяет данные заявки на отвязку:

- `beneficiary.type` - категория бенефициара;
- `beneficiary.participationId` - идентификатор участия;
- `beneficiary.inn` - ИНН бенефициара;
- `beneficiary.account.number` - номер номинального счета;
- `beneficiary.status.startDate` - дата присоединения;
- `beneficiary.status.endDate` - дата выбытия.

## Merge Model

Legacy snapshot использует id вида `beneficiary.unbind.*`. В jsonspecs такие
id не видны из entrypoint pipeline, поэтому при синхронизации правила
перекладываются в scope соответствующего entrypoint:

```text
entrypoints.beneficiary.unbind.type_supported.*
entrypoints.beneficiary.unbind.field_validation.*
```

Публичные `code`, `message`, `field`, `level` не меняются. Это важно для
processor parity и merchant-facing ошибок.

## Verification

Обязательный локальный прогон:

```bash
npm test
npm pack --dry-run
```

Текущий parity-набор:

- 6 samples для `FL_RESIDENT`;
- 7 samples для `FL_NONRESIDENT`;
- 5 samples для `IP_RESIDENT`;
- 8 samples для `IP_NONRESIDENT`;
- 4 samples для `UL_RESIDENT`;
- 6 samples для `UL_NONRESIDENT`;
- 5 samples для `beneficiary.unbind`.

После первого FL/IP dedupe slice parity-набор дополнен negative samples для
веток, которые были схлопнуты в общие rules:

- неподдержанный тип дополнительного документа нерезидента;
- отсутствие органа выдачи дополнительного документа;
- российский адрес без обязательного кода региона ФИАС.

## Processor Switch

После публикации package-backed слайса processor artifact `beneficiary.unbind` переключен с
локального `rules.snapshot.json` на package-backed `rulesetRef`.
Оба `artefactId` в flow остаются прежними, потому что package snapshot содержит
те же entrypoint ids.

## Not Done In This Slice

- Processor-local `rules.snapshot.json` больше не является parity-source.
- Не меняется бизнес-текст legacy errors, даже если в них есть технические
  подсказки в скобках.
- Не выполняется дедупликация FL/IP library pipelines.
