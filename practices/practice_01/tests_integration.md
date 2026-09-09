# Integration-проверки

| Связь компонентов | Что может сломаться | Как воспроизводим | Ожидаемый результат | Evidence |
|---|---|---|---|---|
| FastAPI → ReviewService → LLM | Нет `diff` в payload | POST /api/reviews с `{}` | (AS IS) 500; (TO BE) 422/400 | TRAINING_PR.diff: app/api.py, 35–38 |
| FastAPI → ReviewService → LLM | Исключение в LLM | Мок LLM, который бросает исключение | (AS IS) 5xx без маппинга; (TO BE) 502/503 с сообщением | app/review_service.py, 19–22; app/api.py, 35–38 |
| FastAPI → ReviewService → LLM | Большой/вредоносный diff | Отправить очень длинный diff или с инъекцией | (TO BE) отказ по размеру или безопасная обработка | app/review_service.py, 19–22 |

## Как использовали AI

- Строка в [`prompts.md`](prompts.md): P1-02.
- Что проверили и исправили сами: сценарии соотносятся с точками риска из diff.
