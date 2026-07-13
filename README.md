# nominal-beneficiaries-rules

Пакет правил проверок заявок бенефициаров номинальных счетов для `jsonspecs`.

## Статус

Седьмой слайс миграции: пакет отделен от процессора и содержит все активные
RULES-контуры процессора:

- `FL_RESIDENT`;
- `FL_NONRESIDENT`;
- `IP_RESIDENT`;
- `IP_NONRESIDENT`;
- `UL_RESIDENT`;
- `UL_NONRESIDENT`;
- `beneficiary.unbind`.

Цель текущего состояния - доказать parity между старым исполнением через
`@processengine/rules` и новым `jsonspecs-snapshot`, не меняя бизнес-поведение
за исключением явно помеченных guard-улучшений.

## Точки входа

| Entrypoint | Сценарий |
|---|---|
| `entrypoints.fl_resident.full_validation` | Валидация заявки ФЛ-резидента |
| `entrypoints.fl_nonresident.full_validation` | Валидация заявки ФЛ-нерезидента |
| `entrypoints.ip_resident.full_validation` | Валидация ФЛ-данных владельца ИП-резидента |
| `entrypoints.ip_nonresident.full_validation` | Валидация заявки ИП-нерезидента |
| `entrypoints.ul_resident.full_validation` | Валидация заявки ЮЛ-резидента |
| `entrypoints.ul_nonresident.full_validation` | Валидация заявки ЮЛ-нерезидента |
| `entrypoints.beneficiary.unbind.type_supported` | Проверка категории бенефициара для отвязки |
| `entrypoints.beneficiary.unbind.field_validation` | Валидация заявки на отвязку |

## Runtime Context

Entrypoint требует контекст:

| Поле | Назначение |
|---|---|
| `currentDate` | Дата заявки для проверок сроков действия документов и сравнений с текущей датой |

## Команды

```bash
npm install
npm run sync
npm test
```

`sync` раскладывает текущие processor snapshots по каталогу `rules/`,
пересобирает samples и применяет только нейтральную нормализацию известных
legacy-дублей. Ручные правки в сгенерированных rules-файлах до отдельного
design slice не делать: сначала нужно пройти parity.

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

## Общие и scoped правила

Одинаковые artifacts между контурами остаются общими `library.*`.

Если id совпадает, но тело правила отличается, контурный вариант генерируется
как `library.fl_nonresident.*`, `library.ip_resident.*`,
`library.ip_nonresident.*`, `library.ul_resident.*`,
`library.ul_nonresident.*` или
`internal.<contour>.*`. Это не новый payload namespace, а техническая область
пакета правил: она нужна, чтобы не смешивать разные проверки под одним
`library.*` / `internal.*` id.

`jsonspecs` требует уникальные `code` для всех check-правил внутри snapshot.
Если старые processor snapshots используют одинаковый код в разных контурах,
пакет namespace-ит код контурного правила префиксом `FL_NONRESIDENT.*` или
`IP_RESIDENT.*` / `IP_NONRESIDENT.*` / `UL_RESIDENT.*` /
`UL_NONRESIDENT.*` и сохраняет старое значение в
`meta.legacyCode`. Parity harness сравнивает с legacy по `legacyCode`.
Processor при подключении package-backed rules возвращает наружу `legacyCode`,
чтобы merchant-facing коды ошибок не менялись из-за технического ограничения
jsonspecs snapshot.

При синхронизации конфликтов сравнение выполняется по исполняемой части
artifact. `description` не считается runtime-поведением и сам по себе не
создает scoped-копию. `code`, `level`, `message`, поля, справочники и состав
steps остаются значимыми: если они отличаются, правило не схлопывается без
отдельного решения.

## Релизный цикл

Пакет публикуется в npm как
`@processengine/nominal-beneficiaries-rules`.

Обычный порядок релиза:

```bash
npm version patch   # или minor / major
git push origin main --follow-tags
```

GitHub Actions запускает `Release` на tag вида `vX.Y.Z`, проверяет совпадение
tag с `package.json`, прогоняет `npm test`, проверяет, что такая версия еще не
опубликована, и выполняет `npm publish --access public`.

Для ручного запуска есть `workflow_dispatch` в workflow `Release`; он публикует
текущую версию из `package.json`.

Секрет публикации:

```text
NPM_TOKEN
```

Он хранится в GitHub Actions secrets репозитория и не должен попадать в
исходники, README, issue или логи.

## Структура

```text
manifest.json             метаданные пакета и catalog для Studio/UI
field-contracts/          контракты полей Rules UI для processor compatibility
rules/                    jsonspecs artifacts, один artifact на файл
rules/internal/           внутренние блоки legacy snapshot с id internal.*
operators/node/           доменные операторы бенефициаров
samples/                  parity samples для entrypoint
scripts/build.mjs         сборка dist/snapshot.json
scripts/parity.mjs        сравнение legacy vs jsonspecs
dist/snapshot.json        собранный jsonspecs snapshot
docs/sync-report.json     отчет о shared/scoped artifacts и code aliases
```

## Текущее состояние миграции

Все active RULES contours processor-preprod перенесены в package snapshot
`@processengine/nominal-beneficiaries-rules@0.7.0`:

- `fl_resident.validate_application`;
- `fl_nonresident.validate_application`;
- `ip_resident.validate_application`;
- `ip_nonresident.validate_application`;
- `ul_resident.validate_application`;
- `ul_nonresident.validate_application`;
- `beneficiary.unbind`:
  - `entrypoints.beneficiary.unbind.type_supported`;
  - `entrypoints.beneficiary.unbind.field_validation`.

Processor switch для `beneficiary.unbind` выполнен в `processor-preprod` после
публикации версии `0.7.0`.

Первый design slice FL/IP-дедупликации выполнен: конфликты, вызванные только
описаниями artifacts или одинаковыми nonresident add-doc checks, схлопнуты без
изменения публичных `legacyCode`. Оставшиеся FL/IP scoped conflicts описаны в
`docs/dedupe-audit-fl-ip.md`; следующий безопасный шаг - нейтральные
resident-person library pipelines и отдельная проверка `any_filled`/`paths`.
