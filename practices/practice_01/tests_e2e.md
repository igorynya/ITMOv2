# E2E-проверки

| Сценарий пользователя | Предусловия | Действие | Наблюдаемый результат | Evidence |
|---|---|---|---|---|
| Позитивный | Сервис запущен | POST /api/reviews с `{"diff": "diff --git a/x b/x\n..."}` | 200 OK и `{"comment": "..."}` | TRAINING_PR.diff: app/api.py, 35–38; app/review_service.py, 19–22 |
| Негативный | Сервис запущен | POST /api/reviews с `{}` | (AS IS) 500 из‑за KeyError; (TO BE) 422/400 | TRAINING_PR.diff: app/api.py, 35–38 |
| Граничный | Сервис запущен | POST /api/reviews с очень большим diff | (TO BE) отказ/усечение по лимиту | TRAINING_PR.diff: app/review_service.py, 19–22 |

## Как использовали AI

- Строка в [`prompts.md`](prompts.md): P1-01.
- Что проверили и исправили сами: привязали проверки к конкретным строкам diff.
