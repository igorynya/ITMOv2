# Документация сервиса «Подборки ВкусВилла»

Документация описывает микросервис в `practices/practice_04/collections`
и фичу «фильтр подборок по тегу», спецификации которой лежат в
`practices/practice_05/spec_review`.

Код сервиса при подготовке документации не изменялся. Текущие проверки:

```sh
cd practices/practice_04/collections
go test ./...
go vet ./...
```

На 2026-10-23 обе команды проходят. Подробности — в
[07-testing.md](07-testing.md).

## Карта документов

| Документ | О чём |
| --- | --- |
| [01-architecture.md](01-architecture.md) | Назначение, компоненты, слои, запуск и остановка, потоки запросов |
| [02-api.md](02-api.md) | HTTP API, коды ответов, cookie, корзина, health/ready |
| [03-data-storage.md](03-data-storage.md) | Схема SQLite, поколения, избранное, кэш ссылок, миграции |
| [04-generation-and-mcp.md](04-generation-and-mcp.md) | MCP-клиент, парсинг, шаблоны, бюджет, повторы и лимитер |
| [05-frontend.md](05-frontend.md) | Устройство страницы, состояние, загрузка, избранное и корзина |
| [06-configuration-and-operations.md](06-configuration-and-operations.md) | Переменные окружения, запуск, логи, отказоустойчивость |
| [07-testing.md](07-testing.md) | Автотесты, интеграционный тест, ручные проверки |
| [feature-tag-filter.md](feature-tag-filter.md) | Новая фича: что делает, как реализована, какие были трудности |
| [feature-tag-filter-status.md](feature-tag-filter-status.md) | Сверка `tasks.md` с фактическим кодом: что сделано и что не подтверждено |
| [discrepancies.md](discrepancies.md) | Несостыковки между кодом, спеками, планом, задачами и README |

## Кратко о сервисе

- Учебный локальный веб-сервис на Go 1.27.3.
- Показывает 18 шаблонов подборок продуктов, сгенерированных через
  официальный MCP ВкусВилла.
- Хранит активное поколение, избранное посетителя и кэш ссылок на
  корзину в SQLite.
- Отдаёт HTML/CSS/JS из бинарника через `embed`.
- Не требует авторизации: посетитель определяется анонимным cookie.
- Первая генерация выполняется до старта HTTP-сервера и может занимать
  около минуты.

## Источники истины

Для кода источник истины — файлы в `practices/practice_04/collections`.
Для фичи — `spec_review/spec.md`, `contracts/` и `contract.md`; при
расхождениях это отдельно отмечено в [discrepancies.md](discrepancies.md).

## Быстрые ссылки

- README сервиса: `../collections/README.md`
- Спека фичи: `../../practice_05/spec_review/spec.md`
- План фичи: `../../practice_05/spec_review/plan.md`
- Задачи фичи: `../../practice_05/spec_review/tasks.md`
- Контракт HTTP API фичи: `../../practice_05/spec_review/contracts/http-api.md`
- Контракт UI фичи: `../../practice_05/spec_review/contracts/ui-state.md`
- Отчёт о сходимости: `../../practice_05/spec_review/converge.md`
