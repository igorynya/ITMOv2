# Практика 7.2 — Классификация GitHub Issues + еженедельный отчёт (n8n)

Автор: Атрошкин Игорь. Тестовый репозиторий: https://github.com/igorynya/n8n-review-test

## Состав сдачи

| Файл | Что это |
|---|---|
| `workflows/issues_classifier.json` | основной сценарий: GitHub Trigger (issues) → If (`opened`) → Edit Fields → вызов Sub-workflow → If confidence ≥ 0.8 → Switch → лейбл + комментарий |
| `workflows/classifier_subworkflow.json` | Sub-workflow: Execute Workflow Trigger → AI Agent (+ Structured Output Parser, JSON `type`, `confidence`) → Edit Fields |
| `workflows/weekly_report.json` | еженедельный отчёт: Schedule Trigger `0 9 * * MON` → 4 HTTP Request (GitHub API) → Merge → Code → Get row(s) → Code (Δ) → Upsert row(s) → AI Agent → Send Email |
| `evidence/` | скриншоты Executions, Issues, Data Table, письма |

## Соответствие критериям

| № | Критерий | Реализация | Доказательство |
|---|---|---|---|
| 1 | Классификация Issue (bug / task / feature), лейбл + шаблонный комментарий | Switch по `type`, ветки `label-bug`/`label-task`/`label-future` + Create comment | `evidence/07_exec_main_task.png`, `evidence/08_exec_main_feature.png`; Executions для bug — **TODO** |
| 2 | Уверенность < 0.8 → `needs-triage`, без комментария | If `confidence >= 0.8`, ветка false → только `label-needs-triage` | Execution #1925, Issue #30 — **TODO положить файл** |
| 3 | Классификатор вынесен в Sub-workflow | `classifier_subworkflow`, вызов нодой Execute Workflow | скриншот холста Sub-workflow — **TODO** |
| 4 | Еженедельный отчёт по расписанию | Schedule Trigger, cron `0 9 * * MON`, Europe/Moscow | скриншот триггера с корректным cron — **TODO** |
| 5 | 4 запроса к GitHub API, группировка в Code по типу и автору | created, closed, open (backlog), pull requests; `byType`, `byAuthor` | вывод Code node — **TODO** |
| 6 | HTML-письмо | Send Email (SMTP, пароль приложения) | скриншот письма — **TODO** |
| ★ | История в Data Table `weekly_stats`, Δ к прошлой неделе, AI-комментарий | Upsert по `week` (ключ вида `2026-W47`), блок Δ в таблице письма, поле «AI-комментарий недели» | Data Table и письмо — **TODO** |

## Описание сценариев

**Основной.** Триггер срабатывает на событие `issues`; If пропускает только `action = opened`. В Sub-workflow уходят заголовок и текст Issue, модель возвращает JSON `{type, confidence}`. При `confidence >= 0.8` Switch выбирает ветку: ставится лейбл и пишется комментарий-шаблон под тип. Иначе ставится только `needs-triage`, комментарий не пишется.

**Sub-workflow.** Изолирует классификатор: промпт и модель меняются в одном месте, основной сценарий не трогается. Вход: `title`, `body`. Выход: `type` (`bug`, `task`, `feature`, `unknown`) и `confidence` (0–1). Для расплывчатых обращений промпт требует `unknown` и confidence ниже 0.5, поэтому они уходят в `needs-triage`.

**Еженедельный отчёт.** Четыре запроса к GitHub API за последние 7 дней (созданные и закрытые Issues, открытый бэклог, PR). PR из выдачи `/issues` отфильтрованы по полю `pull_request`. Code-нода группирует по типу (лейблам) и автору и собирает HTML. Результат недели записывается в Data Table через Upsert (ключ `week`, повторный запуск не плодит дубли). Вторая Code-нода берёт строку предыдущей недели и считает Δ. LLM пишет короткий комментарий, который попадает в письмо.

## Замечания

- Неделя `2026-W46` внесена вручную как базовая (активности в репозитории не было / значения посчитаны по списку Issues — **уточнить**). Неделя `2026-W47` записана сценарием автоматически.
- Лейбл для идей назван `future` (в задании `feature`) — осознанное решение, сценарий и репозиторий согласованы.
