# nominal-beneficiaries-rules

Пакет правил проверок заявок бенефициаров номинальных счетов для `jsonspecs`.

## Статус

Первый слайс миграции: пакет отделен от процессора, но содержит только
`FL_RESIDENT` validate-application и пока сохраняет смысл текущего
`rules.snapshot.json` из `processor-preprod`.

Цель слайса - доказать parity между старым исполнением через
`@processengine/rules` и новым `jsonspecs-snapshot`, не меняя бизнес-поведение
за исключением явно помеченных guard-улучшений.

## Точки входа

| Entrypoint | Сценарий |
|---|---|
| `entrypoints.fl_resident.full_validation` | Валидация заявки ФЛ-резидента |

## Runtime Context

Entrypoint требует контекст:

| Поле | Назначение |
|---|---|
| `currentDate` | Дата заявки для проверок сроков действия документов и сравнений с текущей датой |

## Команды

```bash
npm install
npm run sync:fl-resident
npm test
```

`sync:fl-resident` раскладывает текущий processor snapshot по каталогу
`rules/`, пересобирает samples и применяет только нейтральную нормализацию
известных legacy-дублей. Ручные правки в сгенерированных rules-файлах до
отдельного design slice не делать: сначала нужно пройти parity.

Samples лежат прямо в `samples/*.json` в Studio-совместимом формате:
`context.pipelineId`, `payload`, `expect.status` и `expect.issues`.
Если sample фиксирует намеренное отличие от legacy snapshot, он помечается
`legacyParity: false`; такой sample всё равно проверяется `jsonspecs test` и
локальным `test:parity` по `expect`.

## Доменные операторы

`is_boolean` проверяет, что поле передано как настоящий JSON boolean:
`true` или `false`. Он заменяет legacy-подход через технический справочник
`true_false`, потому что проверка типа не является бизнес-справочником и не
должна отображаться в Studio как отдельный справочник значений.

Для налоговых флагов сценарий разложен на три слоя:

1. поле обязательно;
2. если поле передано, проверяется тип `true/false`;
3. если тип корректный, проверяется бизнес-запрет значения `true`.

## Структура

```text
manifest.json             метаданные пакета и catalog для Studio/UI
rules/                    jsonspecs artifacts, один artifact на файл
rules/internal/           внутренние блоки legacy snapshot с id internal.*
operators/node/           доменные операторы бенефициаров
samples/                  parity samples для entrypoint
scripts/build.mjs         сборка dist/snapshot.json
scripts/parity.mjs        сравнение legacy vs jsonspecs
dist/snapshot.json        собранный jsonspecs snapshot
```

## Следующие слайсы

1. Подключить package к processor через `rulesetRef` без удаления local fallback.
2. Перенести следующий validate-application contour.
3. После parity вынести общие проверки в library pipelines и убрать
   физическое дублирование между FL/IP/UL.
