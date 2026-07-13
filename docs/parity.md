# Parity contract

Package slice не меняет бизнес-смысл правил.

Для каждого sample выполняется два запуска:

1. legacy snapshot через `@processengine/rules`;
2. `dist/snapshot.json` через `jsonspecs`.

Сравниваются:

- `status`;
- `control`;
- список issues по `level`, `code`, `field`, `message`.

Trace не сравнивается и не должен быть частью parity-контракта.

Перед сравнением полностью одинаковые повторные issues схлопываются. Это нужно
для известного legacy-дубля `library.documents.issue_date_not_future`: старый
snapshot выполнял одно и то же правило два раза и возвращал два одинаковых
сообщения. Новый пакет сохраняет бизнес-результат, но не сохраняет повтор.

Samples с `legacyParity: false` не сравниваются с legacy snapshot. Это
допускается только для явно описанных guard-улучшений, когда новый пакет
разделяет отсутствие поля, неверный тип и бизнес-запрет значения. Такие samples
обязательно проверяются по собственному `expect`.

Для физически разных правил с одинаковым legacy-кодом применяется namespace
кода внутри jsonspecs snapshot. Пример:

```text
BEN.TAX.US_TAX_RESIDENT.NOT_TRUE
FL_NONRESIDENT.BEN.TAX.US_TAX_RESIDENT.NOT_TRUE
IP_RESIDENT.BEN.TAX.US_TAX_RESIDENT.NOT_TRUE
```

Старый код сохраняется в `rule.meta.legacyCode`. При сравнении с
`@processengine/rules` parity harness подставляет `legacyCode`, чтобы
проверять бизнес-эквивалентность, а не требовать невозможный для jsonspecs
дубль `code` внутри одного snapshot.

В `processor-preprod` package-backed execution также маппит такие коды обратно
в `legacyCode` перед возвратом результата RULES наружу. Это сохраняет
merchant-facing контракт при переходе на общий package snapshot.

Если parity падает, нельзя исправлять sample под новый результат. Сначала нужно
понять, где drift: в envelope, custom operator, jsonspecs runtime или в самих
артефактах.
