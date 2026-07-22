# Agent entrypoint

Перед нетривиальной задачей прочитай `README.md`, `docs/architecture.md`,
`docs/testing.md` и `docs/release-procedure.md`.

## Приоритет источников

```text
rules + samples + tests
> manifest.json
> актуальная документация
> dist (генерируемый результат)
```

`jsonspecs-cli` является единственным сборщиком. `dist/*` нельзя редактировать
вручную или использовать как источник правил.

## Граница изменений

- сохраняй стабильные `exports` и публичные issue codes без явного решения о breaking change;
- любое изменение бизнес-результата подтверждай sample;
- новые поля и артефакты синхронизируй с `manifest.catalog`;
- доменные операторы держи чистыми, синхронными и покрывай golden-векторами;
- не добавляй transport, process orchestration, сеть или системное время в DSL и операторы.

## Обязательная проверка

```bash
npm test
npm audit --omit=dev
npm pack --dry-run --ignore-scripts
git diff --check
```

Публикация выполняется только tag-triggered GitHub Actions по процедуре релиза.
