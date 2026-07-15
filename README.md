# nominal-beneficiaries-rules

Пакет правил проверок заявок бенефициаров номинальных счетов для `jsonspecs`.

## Статус

Пакет отделен от процессинга данных заявок и является источником истины для всех активных RULES-контуров процессора:

- `FL_RESIDENT`
- `FL_NONRESIDENT`
- `IP_RESIDENT`
- `IP_NONRESIDENT`
- `UL_RESIDENT`
- `UL_NONRESIDENT`
- `UNBIND`

Цель текущего состояния поддерживать самостоятельный `jsonspecs-snapshot` для процессора без локальных `rules.snapshot.json` в `processor-preprod`.

## Точки входа

| Entrypoint                                        | Сценарий                                  |
| ------------------------------------------------- | ----------------------------------------- |
| `entrypoints.fl_resident.full_validation`         | Проверка ФЛ-резидента                     |
| `entrypoints.fl_nonresident.full_validation`      | Проверка ФЛ-нерезидента                   |
| `entrypoints.ip_resident.full_validation`         | Проверка ФЛ-данных владельца ИП-резидента |
| `entrypoints.ip_nonresident.full_validation`      | Проверка ИП-нерезидента                   |
| `entrypoints.ul_resident.full_validation`         | Проверка ЮЛ-резидента                     |
| `entrypoints.ul_nonresident.full_validation`      | Проверка ЮЛ-нерезидента                   |
| `entrypoints.beneficiary.unbind.type_supported`   | Проверка типа бенефициара для отвязки     |
| `entrypoints.beneficiary.unbind.field_validation` | Проверка данных для отвязки               |

## Runtime Context

Entrypoint требует контекст:

| Поле          | Назначение                                                                      |
| ------------- | ------------------------------------------------------------------------------- |
| `currentDate` | Дата заявки для проверок сроков действия документов и сравнений с текущей датой |

## Команды

```bash
npm install
npm test
```

`npm test` собирает `dist/snapshot.json` из файлов `rules/` и сравнивает
результаты с замороженными parity fixtures из `test-fixtures/legacy-snapshots`.
Процессор не является источником правил и не нужен для сборки пакета.

Samples лежат прямо в `samples/*.json` в Studio-совместимом формате:
`context.pipelineId`, `payload`, `expect.status` и `expect.issues`.
Если sample фиксирует намеренное отличие от legacy snapshot, он помечается
`legacyParity: false`; такой sample всё равно проверяется `jsonspecs test` и
локальным `test:parity` по `expect`.

## Доменные операторы

`is_boolean` проверяет, что поле передано как настоящий JSON boolean,
а не строка, число или пустое значение. Он заменяет legacy-подход через технический справочник
`true_false`, потому что проверка типа не является бизнес-справочником и не
должна отображаться в Studio как отдельный справочник значений.

Для налоговых флагов сценарий разложен на три слоя:

1. поле обязательно;
2. если поле передано, проверяется, что это логический признак;
3. если тип корректный, проверяется бизнес-запрет положительного значения.

Для резидентских ФЛ-контуров (`FL_RESIDENT`, `IP_RESIDENT`) гражданство
проверяется как отдельная бизнес-граница: после проверки наличия и формата
`beneficiary.fl.citizenshipCode` значение должно быть `RU`. Гражданство США
остается отдельным compliance reject; значения не в формате ISO alpha-2
отклоняются форматом до проверки `RU`.

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
Если frozen parity fixtures используют одинаковый код в разных контурах,
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

Обязательная процедура описана в
[`docs/release-procedure.md`](docs/release-procedure.md). Короткая форма после
проверки полного diff:

```bash
npm run version:set -- X.Y.Z
npm test
npm pack --dry-run --ignore-scripts
git commit
git tag -a vX.Y.Z -m 'vX.Y.Z'
npm run release:check
git push --atomic origin main vX.Y.Z
```

Локальный `npm publish`, dirty release, публикация без exact tag и ручной
`workflow_dispatch` запрещены. GitHub Actions запускает `Release` только на tag
вида `vX.Y.Z`, проверяет clean tagged commit из `main`, тесты, уникальность
версии и публикует пакет с npm provenance attestation. После публикации workflow
сверяет npm `gitHead` и ключевые runtime-файлы с release commit.

Секрет публикации:

```text
NPM_TOKEN
```

Он хранится в GitHub Actions secrets репозитория и не должен попадать в
исходники, README, issue или логи.

## Структура

```text
manifest.json             метаданные пакета и catalog для Studio/UI
field-contracts/          контракты полей Rules UI
rules/                    jsonspecs artifacts, один artifact на файл
rules/internal/           внутренние блоки правил с id internal.*
operators/node/           доменные операторы бенефициаров
samples/                  parity samples для entrypoint
scripts/build.mjs         сборка dist/snapshot.json
scripts/parity.mjs        сравнение frozen parity fixtures vs jsonspecs
dist/snapshot.json        собранный jsonspecs snapshot
test-fixtures/            замороженная регрессионная база миграции
```

## Текущее состояние миграции

Все active RULES contours processor-preprod перенесены в package snapshot
`@processengine/nominal-beneficiaries-rules@0.8.1`:

- `fl_resident.validate_application`;
- `fl_nonresident.validate_application`;
- `ip_resident.validate_application`;
- `ip_nonresident.validate_application`;
- `ul_resident.validate_application`;
- `ul_nonresident.validate_application`;
- `beneficiary.unbind`:
  - `entrypoints.beneficiary.unbind.type_supported`;
  - `entrypoints.beneficiary.unbind.field_validation`.

Processor switch для всех активных RULES-контуров выполнен в `processor-preprod`.
Локальные `rules.snapshot.json` и `rules-field-contract.json` в processor repo
не являются source of truth и удалены из активного рабочего дерева.

Первый design slice FL/IP-дедупликации выполнен: конфликты, вызванные только
описаниями artifacts или одинаковыми nonresident add-doc checks, схлопнуты без
изменения публичных `legacyCode`. Оставшиеся FL/IP scoped conflicts описаны в
`docs/dedupe-audit-fl-ip.md`; следующий безопасный шаг - нейтральные
resident-person library pipelines и отдельная проверка `any_filled`/`paths`.
