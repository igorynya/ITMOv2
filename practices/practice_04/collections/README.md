# Подборки ВкусВилла

Учебный сервис для проверки официального MCP ВкусВилла. Показывает готовые
подборки продуктов, позволяет сохранить их в избранное и собрать корзину
по публичной ссылке.

## Что умеет

- 18 шаблонов подборок («Обед с друзьями», «Романтический ужин» и т.п.).
- При старте ищет товары через MCP и сохраняет поколение в SQLite.
- Отдаёт 12 случайных карточек на страницу.
- Фильтрует активные подборки по одному тегу; на вкладке «Все» есть строка
  чипов с доступными тегами.
- Избранное на анонимном cookie, хранится в SQLite.
- Кнопка «В корзину» создаёт ссылку `vkusvill.ru/mobile?basket&share=...`
  и кэширует её на 24 часа.
- Если MCP недоступен при старте, сервис использует последнее сохранённое
  поколение.

## Запуск

Требуется Go 1.27+.

```sh
make run
```

Откройте `http://localhost:8080`. Первая генерация занимает около минуты:
сервер стартует, когда подборки готовы.

Проверки:

```sh
make test
make vet
go test -tags=integration ./internal/mcp   # живой запрос к MCP
```

## Конфигурация

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `PORT` | `8080` | HTTP-порт |
| `DB_PATH` | `./data/collections.db` | файл SQLite |
| `VV_MCP_URL` | `https://mcp.vkusvill.ru/mcp` | endpoint MCP |
| `VV_ACCESS_TOKEN` | пусто | OAuth-токен для персонализированных инструментов; не обязателен |
| `COLLECTIONS_PER_PAGE` | `12` | карточек на страницу (10–15) |
| `CART_LINK_TTL` | `24h` | кэш ссылки на корзину |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

## API

| Метод | Путь | Ответ |
| --- | --- | --- |
| `GET` | `/api/collections` | `{"collections": [...], "favorites": ["id"], "tags": ["тег"], "active_tag": ""}` |
| `GET` | `/api/collections?tag=ужин` | то же, но `collections` только с тегом, `active_tag` — канонический тег |
| `GET` | `/api/favorites` | `{"collections": [...]}` |
| `PUT` | `/api/favorites/{id}` | `{"favorite": true, "id": "..."}` |
| `DELETE` | `/api/favorites/{id}` | `{"favorite": false, "id": "..."}` |
| `POST` | `/api/collections/{id}/cart` | `{"url": "https://vkusvill.ru/..."}` |
| `GET` | `/healthz` | `ok` |
| `GET` | `/readyz` | `ready` или `503` |

`GET /api/collections` принимает необязательный параметр `tag` —

- отсутствует, пуст или состоит из пробелов — фильтра нет, `active_tag: ""`;
- известный тег — только подборки с ним, `active_tag` в каноническом
  написании из `tags`;
- неизвестный тег длиной до 64 символов Unicode — `200`, `collections: []`,
  полные `tags` и `favorites`, `active_tag` — обрезанный запрос;
- тег длиннее 64 символов, повторённый `tag`, битый percent-encoding или
  невалидный UTF-8 — `400` с полем `error`.

`tags` всегда содержит полный список доступных тегов активного пула
(отсортирован сервером), `collections`, `tags` и `favorites` — массивы, а не
`null`. Параметр действует только на `/api/collections`; избранное и корзина
от фильтра не зависят. Новых зависимостей нет.

Примеры:

```sh
curl -s 'http://localhost:8080/api/collections' | python3 -m json.tool
curl -s --get --data-urlencode 'tag=ужин' \
  'http://localhost:8080/api/collections' | python3 -m json.tool
curl -s 'http://localhost:8080/api/collections?tag=' | python3 -m json.tool
```

## Как устроено

```
cmd/server        wiring, генерация при старте, graceful shutdown
internal/config   env-конфиг
internal/domain   Product, Collection
internal/store    SQLite: поколения, избранное, кэш ссылок
internal/mcp      клиент MCP ВкусВилла + парсинг ответов
internal/generator шаблоны и сборка подборок
internal/httpapi  HTTP API, cookie посетителя, статика
web               HTML/CSS/JS, встроены через embed
```

Генератор последовательно ищет товары (лимитер 2 запроса/с), берёт первый
товар с рейтингом ≥ 4.5 и применяет бюджет, если он задан шаблоном.
Если собрано меньше 10 подборок, поколение не сохраняется.

## Ограничения

- Корзина публичная: ссылка не привязана к аккаунту, OAuth не используется.
- Цены и наличие зависят от ответов MCP и могут меняться.
- Нет авторизации, оформления заказа, деплоя и очистки старых поколений.
- Проект учебный и не связан с ВкусВиллом.
