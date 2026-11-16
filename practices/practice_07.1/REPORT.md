# Практика 7.1: ассистент для код-ревью в n8n. Отчёт

- Тестовый репозиторий: https://github.com/igorynya/n8n-review-test
- Тестовый PR: https://github.com/igorynya/n8n-review-test/pull/16
- Экспорт сценария: [workflow.json](workflow.json) (секретов нет, credentials указаны только именами и id)
- Подтверждения запусков: папка [evidence/](evidence/)

## Как устроен сценарий

Один `Github Trigger` слушает события `pull_request` и `issue_comment`. Дальше `Switch` направляет событие по `action`:

| Событие | Путь |
|---|---|
| `action = opened` (открыт PR) | проверка в Data Table → запись `PR_number` → получение diff → AI Agent (gpt-5) → комментарий в PR |
| `action = created` (комментарий) | получение PR по `issue.number` → второй `Switch1` по тексту комментария |
| `/make_ai_review` | проверка в Data Table: если номер PR уже есть, запуск останавливается; иначе запись номера → diff → AI Agent (gpt-5) → комментарий |
| `/make_other_ai_review` | diff → AI Agent1 (**gpt-4o**, вторая модель) → комментарий, без проверки таблицы |

Состояние хранится в Data Table `PR_numbers` (колонка `PR_number`, тип number). Решение «запускать ревью или нет» принимает нода `If row does not exist` (для команды `/make_ai_review` это `If row does not exist1`): если строка с номером PR уже есть, цепочка на ней заканчивается и AI Agent не вызывается.

## Подтверждения по критериям

| # | Критерий | Статус | Чем подтверждено |
|---|---|---|---|
| 1 | `/make_other_ai_review` запускает ревью второй моделью, результат в PR | выполнено | Execution #1350 (16:54:03): ветка `Switch1` → `Get a pull request diff1` → `AI Agent1` (gpt-4o) → `Create a comment on a pull request1`. Скриншоты `evidence/03_make_other_ai_review_execution.png` и `evidence/07_pr16_commands_and_other_model_review.jpg` (комментарий второй модели в PR #16 сразу после команды) |
| 2 | Data Table создана, id PR сохраняется | выполнено | Таблица `PR_numbers`, строки с номерами 15 и 16, скриншот `evidence/04_data_table_pr_numbers.png`. Запись номера 16 создана в 16:52:13, это запуск #1346 (`evidence/01_pr_opened_auto_review_execution.png`), ревью при открытии в PR: `evidence/06_pr16_review_on_open_gpt5.jpg` |
| 3 | Повторный `/make_ai_review` не запускает ревью | выполнено | Execution #1347 (16:53:26): `Get a pull request` → `Switch1` → `If row does not exist1`; дальше `Insert row1`, получение diff, AI Agent и публикация комментария **не выполнялись**. Скриншоты `evidence/02_make_ai_review_duplicate_skipped_execution.png` и `evidence/07_pr16_commands_and_other_model_review.jpg`: после комментария `/make_ai_review` в PR нового ревью нет, следующее сообщение бота появляется только после `/make_other_ai_review` |
| 4 | Точечные комментарии к блокам кода (звёздочка) | не выполнено | в этой версии сценария комментарии публикуются одним общим комментарием к PR |

## Что отличается между моделями

Основная модель: gpt-5 (ветки `AI Agent` и `AI Agent2`). Вторая модель: gpt-4o (`AI Agent1`). Промпт ревьюера одинаковый. Тексты обоих ревью из PR #16 приведены в [evidence/pr16_comments.md](evidence/pr16_comments.md), скриншоты: `evidence/05_pr16_header_and_commits.jpg`, `evidence/06_pr16_review_on_open_gpt5.jpg`, `evidence/07_pr16_commands_and_other_model_review.jpg`.

## Известные ограничения

- Номер PR записывается в Data Table **до** публикации ревью (нода `Insert row` стоит перед `AI Agent`). Если ревью упадёт после записи, повторная команда `/make_ai_review` для этого PR будет пропущена. Запись после публикации комментария была бы надёжнее.
- Команда `/make_other_ai_review` не проверяет таблицу и не пишет в неё: вторую модель можно запускать повторно.
