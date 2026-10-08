# Отчёт по hook: pre-commit

Дата: 2026-10-07

Цель
- Автоматически проверять артефакты Практики 4 перед коммитом с помощью MCP `practice04.checklist` в строгом режиме и блокировать коммит при наличии FAIL.

Что сделано
- Добавлен pre-commit hook: `.githooks/pre-commit`.
- Настроен путь к хукам: `git config core.hooksPath .githooks`.
- Создан runner `scripts/check.sh`, который запускает MCP checklist, сохраняет JSON-вывод и возвращает код 0/1.
- Логи проверок сохраняются в `practices/practice_04/evidence/checks/`.

Как работает
- Git вызывает `.githooks/pre-commit` перед созданием коммита.
- Hook запускает `scripts/check.sh`.
- Скрипт вызывает CLI MCP:
  - `python3 tools/practice-04-checklist/main.py --input '{"strict": true}'`
- Вывод JSON сохраняется в файл вида `check_strict_YYYYMMDD_HHMMSS.json` и анализируется по полю `ok`.
  - `ok: true` -> exit 0 (коммит разрешён)
  - `ok: false` -> exit 1 (коммит отклонён)

Настройка
```
chmod +x .githooks/pre-commit scripts/check.sh
git config core.hooksPath .githooks
```

Файлы
- Hook: `.githooks/pre-commit`
- Runner: `scripts/check.sh`
- MCP: `tools/practice-04-checklist/main.py`
- Логи: `practices/practice_04/evidence/checks/*.json`

Примеры запусков (evidence)
- Успешные прогоны strict=true:
  - [check_strict_20261007_234428.json](./check_strict_20261007_234428.json)
  - [check_strict_20261007_235415.json](./check_strict_20261007_235415.json)

Пример работы
- Коммит при корректных артефактах:
```
$ git commit -m "example"
Saved output to practices/practice_04/evidence/checks/check_strict_YYYYMMDD_HHMMSS.json
Checklist OK
[branch abc1234] example
 1 file changed, ...
```
- Коммит при отсутствии обязательного файла (пример): временно переименовать `practices/practice_04/reflection.md` -> `reflection.tmp`:
```
$ git commit -m "should fail"
Saved output to practices/practice_04/evidence/checks/check_strict_YYYYMMDD_HHMMSS.json
Checklist FAIL
pre-commit hook declined
```
Верните файл на место и повторите коммит.

Примечания
- Hook не исправляет проблемы автоматически, он только останавливает коммит и сохраняет отчёт.
- MCP SDK не обязателен: используется CLI-режим Python-скрипта.
- Для CI можно вызывать `scripts/check.sh` напрямую.
