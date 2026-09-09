# Unit-проверки

| Требование или правило | Что проверяем изолированно | Вход | Ожидаемый результат | Evidence |
|---|---|---|---|---|
| Формирование промпта | `ReviewService.review` вызывает `llm.generate` с промптом, содержащим diff | diff: строка | Возврат `{"comment": answer}` и один вызов LLM | TRAINING_PR.diff: app/review_service.py, 19–22 |
| API принимает diff | Эндпоинт `create_review` передаёт payload["diff"] в сервис | payload: {diff: str} | 200 и словарь `{"comment": str}` | TRAINING_PR.diff: app/api.py, 35–38 |
| Отсутствие ключа diff (AS IS) | Индексация `payload["diff"]` без проверки | payload: {} | Исключение `KeyError` → 500 | TRAINING_PR.diff: app/api.py, 35–38 |
| Исключение из LLM (AS IS) | Проброс исключения из `llm.generate` | llm.generate бросает | Исключение поднимается до API → 5xx | TRAINING_PR.diff: app/review_service.py, 19–22 |

## Как использовали AI

- Строка в [`prompts.md`](prompts.md): P1-01.
- Что проверили и исправили сами: все пункты подтверждены строками diff; негативные сценарии описаны как AS IS.
