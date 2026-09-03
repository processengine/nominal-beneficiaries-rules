# nominal-beneficiaries-rules

Пакет правил проверки бенефициаров номинальных счетов для
`@jsonspecs/rules` **4.0.1** и спецификации `jsonspecs/spec` **1.0.0-rc.7**.

Версия пакета: **2.0.0**.

## Состав пакета

- 13 экспортируемых сценариев для регистрации, обновления и отвязки бенефициара;
- 531 исполняемый артефакт в полном замыкании `exports`;
- справочники и переиспользуемые условия;
- пять доменных операторов с закрытыми схемами и эталонными тестами;
- 152 исполняемых примера с покрытием всех 242 кодов ошибок;
- воспроизводимый `snapshot.json` формата fv2.

## Быстрый старт

Требуется Node.js 20 или новее.

```bash
npm ci
npm test
```

Канонические команды проекта предоставляет `jsonspecs-cli` 4:

```bash
jsonspecs validate --fail-on-warning
jsonspecs test
jsonspecs build --fail-on-warning
jsonspecs sandbox
```

`npm test` последовательно запускает эти проверки, эталонные векторы операторов,
собирает `dist/` и проверяет согласованность готового пакета.

## Экспортируемые сценарии

| `pipelineId` | Сценарий |
| --- | --- |
| `entrypoints.fl_resident.full_validation` | ФЛ-резидент |
| `entrypoints.fl_nonresident.full_validation` | ФЛ-нерезидент |
| `entrypoints.ip_resident.full_validation` | ИП-резидент |
| `entrypoints.ip_nonresident.full_validation` | ИП-нерезидент |
| `entrypoints.ul_resident.full_validation` | ЮЛ-резидент |
| `entrypoints.ul_nonresident.full_validation` | ЮЛ-нерезидент |
| `entrypoints.beneficiary.unbind.type_supported` | допустимость типа при отвязке |
| `entrypoints.beneficiary.unbind.field_validation` | поля заявки на отвязку |
| `entrypoints.fl_resident.update_validation` | частичное обновление ФЛ-резидента |
| `entrypoints.fl_nonresident.update_validation` | частичное обновление ФЛ-нерезидента |
| `entrypoints.ip_resident.update_validation` | частичное обновление ИП-резидента |
| `entrypoints.ul_resident.update_validation` | частичное обновление ЮЛ-резидента |
| `entrypoints.ul_nonresident.update_validation` | частичное обновление ЮЛ-нерезидента |

Все сценарии `*.full_validation` и `*.update_validation` требуют
`context.currentDate`. Отсутствие даты возвращает структурированную ошибку
бизнес-проверки уровня `EXCEPTION` с кодом `CONTEXT.CURRENT_DATE.REQUIRED`.

Сценарии `*.update_validation` проверяют только присланные на обновление поля.
Для `FL_NONRESIDENT` адрес регистрации всегда считается российским:
`countryCode` не требуется и не влияет на результат, `fullAddress` необязателен,
а структурные поля российского адреса обязательны. Один `countryCode` не
считается переданным адресом. Для `FL_RESIDENT` и `IP_RESIDENT` код страны
сохраняет прежнее значение в контракте, а полную строку российского адреса
собирает процессор после нормализации. Для этих типов также проверяются оба
варианта телефона: российский `phone` и международный `foreignPhone`. Для
`UL_NONRESIDENT` частично проверяются переданные сведения об организации,
регистрации и иностранном налоговом резидентстве.

## Юридический адрес при регистрации UL_RESIDENT

С версии 2.0.0 `entrypoints.ul_resident.full_validation` требует в
`beneficiary.address.legal` код страны `RU`, `regionCode`, `postalCode`,
`city` или `locality`, `streetType`, `street`, `house`. `fullAddress`
необязателен; одной строки недостаточно. Значения составных полей должны
быть строками с непробельными символами. Адреса без улицы не входят в этот
контракт. Идентификаторы ФИАС от мерчанта не требуются.

Проверки расположены в `internal.ul_resident.address.*` и вызываются только
регистрационным блоком ЮЛ-резидента. Общая библиотека адресов, обновление
ЮЛ-резидента и остальные 12 экспортов не меняются. Обновление ЮЛ по-прежнему
требует полную строку при передаче адресного блока.

Отсутствующие поля дают `UL.ADDRESS.LEGAL.FIAS.<PART>.REQUIRED` уровня `ERROR`.
Нестрочные значения и строки из пробелов дают `.FORMAT`. У общей ошибки
`CITY_OR_LOCALITY.REQUIRED` поле `field` равно `null`; сервис может опускать
его в мерчантском ответе. Эта проверка полноты не заменяет проверку адреса ЦФТ.

Это несовместимое изменение: ранее принятая заявка только с `countryCode`
и `fullAddress` теперь отклоняется. Потребитель должен явно обновить точную
версию зависимости и согласовать переход для незавершённых заявок.

## Использование в сервисе

```js
const { createEngine } = require("@jsonspecs/rules");
const snapshot = require("@processengine/nominal-beneficiaries-rules/dist/snapshot.json");
const operators = require("@processengine/nominal-beneficiaries-rules/operators/node");

const engine = createEngine({ operators });
const prepared = engine.compileSnapshot(snapshot);

const result = engine.runPipeline(prepared, {
  pipelineId: "entrypoints.fl_resident.full_validation",
  payload,
  context: { currentDate: "2026-07-22" },
});
```

Сервис компилирует snapshot один раз при старте. `pipelineId` всегда передаётся
явно на верхнем уровне. Ограничение транспортного размера, аутентификация,
авторизация и доставка одобренной версии пакета остаются обязанностью сервиса.

## Авторская модель

```text
manifest.json          версия спеки, exports, пути и единый UI-каталог
rules/                 один JSON-артефакт на файл
operators/node/        доменные операторы Rules v4
tests/                 эталонные векторы операторов
samples/               входы и ожидаемые бизнес-результаты
scripts/               проверки пакета и релизного состояния
dist/                  результат jsonspecs build, не источник истины
```

`manifest.catalog` является единственным источником редакторских метаданных.
Исполняемые артефакты не содержат `description`, а отдельные контракты полей,
привязанные к конкретному обработчику, в пакете не поддерживаются.

Правила, создающие ошибки, содержат `issue.meta` со ссылками на разделы и
пункты бизнес-требований, справочной страницей и `SHA-256` исходного DOCX.
Этот блок входит в `sourceHash` и возвращается Rules v4 вместе с ошибкой.

У правила нет роли `check|predicate`: оператор возвращает `PASS`, `FAIL` или
`SKIP`. Объект `issue` определяет последствия `FAIL` в исполняемом шаге и
игнорируется при использовании правила внутри `when`.

## Доменные операторы

- `valid_inn` проверяет контрольные разряды ИНН ФЛ и ЮЛ;
- `inn_not_repeated` запрещает 12-значный ИНН из одной повторяющейся цифры;
- `is_iso_date` проверяет существующую календарную дату в формате `YYYY-MM-DD`;
- `passport_rf_issued_at_or_after_age` проверяет минимальный возраст выдачи;
- `passport_rf_valid_after_replacement_age` проверяет возраст замены и льготный период.

Операторы экспортируются напрямую как карта `{schema, evaluate}`. Ядро разрешает
пути из `field` и `inputs`; оператор получает только значения и постоянные
`params`, не видит payload, context или текущий pipeline.

## Документация

- [архитектура пакета](docs/architecture.md);
- [контракт тестирования](docs/testing.md);
- [связь правил с бизнес-требованиями](docs/requirements-traceability.md);
- [процедура релиза](docs/release-procedure.md).

История миграции с прежнего движка остаётся в Git. Начиная с версии 1.0.0
регрессионным контрактом являются актуальные правила, примеры и эталонные векторы.
