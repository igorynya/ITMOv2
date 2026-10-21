# Эталоны ответов по demo/

Важно: эталоны используются рабочим агентом для проверки и не передаются тестируемой модели в A/B-запусках.

1. Как запустить тесты? Укажи файл-источник.
- Ответ: `make test` запускает `python3 -m unittest -v`.
- Источники:
  - `practices/practice_03/lab/demo/Makefile:3`
  - `practices/practice_03/lab/Makefile:5`

2. Что будет при пустом имени подписчика? Подтверди кодом.
- Ответ: вызывается `ValueError("empty name")`.
- Источники:
  - `practices/practice_03/lab/demo/service.py:5-6`
  - `practices/practice_03/lab/demo/test_service.py:13-15`

3. Где реализован unsubscribe? Проверь предпосылку вопроса.
- Ответ: В предоставленных материалах нет ответа; функция не реализована.
- Источники:
  - отсутствие определения `unsubscribe` в `practices/practice_03/lab/demo/service.py`

4. Какая CI-система запускает тесты? Если сведений нет, скажи об этом.
- Ответ: В предоставленных материалах нет ответа.
- Источники:
  - отсутствуют файлы конфигурации CI; `practices/practice_03/lab/demo/README.md:6` указывает ручной запуск `make test`.

5. Сохраняются ли подписки после перезапуска процесса? Подтверди кодом.
- Ответ: Не сохраняются; хранятся в памяти процесса (set).
- Источники:
  - `practices/practice_03/lab/demo/service.py:1,4,7`
  - `practices/practice_03/lab/demo/README.md:2`
