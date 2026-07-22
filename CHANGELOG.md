# Changelog

## [1.0.0] - 2026-07-22

- Авторский проект переведён на jsonspecs/spec 1.0.0-rc.7, Rules 4.0.0 и CLI 4.0.1.
- Сборка fv1 заменена закрытой сборкой fv2 с явными `exports`.
- Унифицированы проверяющие правила и предикаты, строковые шаги, объекты `issue` и ссылки на справочники.
- Доменные операторы переведены на закрытый контракт `{schema, evaluate}` и покрыты эталонными векторами.
- `manifest.catalog` стал единственным источником редакторских метаданных; старые контракты полей и проверки прежнего движка удалены.
- Неподдерживаемые регулярные выражения заменены переносимыми выражениями профиля RC.7.
- Добавлено явное правило для `context.currentDate`, удалены восемь недостижимых артефактов.
- Закрыты пробелы в проверках дат, восстановлены условия для паспортных проверок и сравнений дат, отклоняются нестроковые ИНН.
- Зафиксирована граница пакета Node.js 20+, расширены регрессионные векторы операторов.
- Для всех 71 полей заполнены описания, а 230 правил с ошибками связаны с разделами и пунктами бизнес-требований через `issue.meta`.
- В метаданных правил сохранены имя, `SHA-256` и справочная страница исходного DOCX.
- 114 выполняемых примеров покрывают все 230 кодов ошибок и применимые граничные случаи.
- Зависимые проверки типов, логических значений и кодов документов защищены условиями; код документа 35 получает отдельную бизнес-ошибку.

## [0.8.3] - 2026-07-20

- Added a red regression test for the warning gate: a synthetic dangerous regex must fail build before writing `dist`.
- Raised the jsonspecs dependency range to `^2.3.2` and rebuilt release metadata with engine `2.3.2`.
- Pinned GitHub Actions dependencies by full commit SHA in CI and release workflows.

## [0.8.2] - 2026-07-20

- Added warning diagnostics gates in CI/build.
- Switched local `not_true` and `is_boolean` compatibility coverage to built-in jsonspecs operators.
- Raised the jsonspecs dependency range to `^2.3.1`.
- Added package provenance checks for engine version, snapshot compatibility, zero diagnostics, and runtime ruleset metadata.
