# HTTP API

## 1. Общие правила

- Формат успешных ответов — JSON, если не указано иное.
- Ошибки API — JSON `{"error":"..."}` с корректным HTTP-кодом.
- Все маршруты зарегистрированы через `net/http.ServeMux` с методами
  (`GET`, `PUT`, `DELETE`, `POST`).
- Middleware `visitor` выдаёт cookie `vv_visitor` при первом запросе.
  Cookie: 32 hex-символа (16 случайных байт), `HttpOnly`, `SameSite=Lax`,
  `Path=/`, срок 365 дней. Флаг `Secure` не ставится, потому что сервис
  локальный и работает по HTTP.
- Статика отдаётся `http.FileServerFS` из `embed`; запросы к `/` и
  неизвестным путям попадают в файловый сервер.
- Ответы `400` и `500` не содержат поля `collections`.
- В успешном ответе `/api/collections` поля `collections`, `tags` и
  `favorites` всегда массивы, не `null`.

## 2. Маршруты

| Метод | Путь | Назначение |
| --- | --- | --- |
| `GET` | `/api/collections` | Активные подборки, избранное, доступные теги |
| `GET` | `/api/favorites` | Полный список избранного посетителя |
| `PUT` | `/api/favorites/{id}` | Добавить подборку в избранное |
| `DELETE` | `/api/favorites/{id}` | Убрать подборку из избранного |
| `POST` | `/api/collections/{id}/cart` | Получить или создать ссылку на корзину |
| `GET` | `/healthz` | Проверка живости процесса |
| `GET` | `/readyz` | Проверка наличия активного поколения |

## 3. `GET /api/collections`

### 3.1. Параметры

| Параметр | Обязательность | Правило |
| --- | --- | --- |
| `tag` | Нет | Не более одного значения. Отсутствует, пуст или только Unicode whitespace — без фильтра |

Полные правила валидации, канонизации и коды ошибок — в
[feature-tag-filter.md](feature-tag-filter.md) и
`../../practice_05/spec_review/contracts/http-api.md`.

### 3.2. Успешный ответ `200`

```json
{
  "collections": [
    {
      "id": "dinner-500-1792666479",
      "slug": "dinner-500",
      "title": "Ужин на двоих",
      "subtitle": "Простой ужин без лишних трат",
      "template": "dinner-500",
      "budget": 500,
      "total": 480,
      "items": [
        {
          "id": 123,
          "name": "Куриное филе",
          "price": 250,
          "unit": "кг",
          "rating": 4.8,
          "quantity": 1,
          "url": "https://vkusvill.ru/..."
        }
      ],
      "tags": ["ужин", "бюджет"],
      "created_at": "2026-10-23T12:00:00Z",
      "generation": 1792666479
    }
  ],
  "favorites": ["friends-lunch-1792666479"],
  "tags": ["бюджет", "завтрак", "перекус", "ужин"],
  "active_tag": "ужин"
}
```

Поля подборки — существующая структура `domain.Collection`.
`cart_url` появляется только при непустом значении (`omitempty`).
`active` и `cart_set_at` в JSON не отдаются.

| Поле | Смысл |
| --- | --- |
| `collections` | Не больше `COLLECTIONS_PER_PAGE` (по умолчанию 12) активных подборок |
| `favorites` | Полный список id избранного посетителя, не зависит от фильтра |
| `tags` | Все доступные теги активного пула, отсортированы сервером |
| `active_tag` | Канонический тег, эхо обрезанного запроса или `""` |

### 3.3. Ошибки

| Код | `error` | Когда |
| --- | --- | --- |
| `400` | `invalid query` | Некорректное percent-encoding |
| `400` | `tag must be specified once` | Параметр `tag` передан несколько раз |
| `400` | `tag must be valid UTF-8` | Значение `tag` не является валидным UTF-8 |
| `400` | `tag is too long` | После обрезки больше 64 Unicode-символов |
| `500` | `cannot load collections` | Ошибка чтения активного пула |
| `500` | `cannot load favorites` | Ошибка чтения избранного |

Валидация `tag` выполняется до обращения к хранилищу. Внутренняя ошибка
не маскируется под пустой результат.

## 4. `GET /api/favorites`

Возвращает полный список избранных подборок посетителя в порядке
`favorites.created_at DESC`:

```json
{
  "collections": [
    {
      "id": "romantic-dinner-1792666479",
      "title": "Романтический ужин",
      "tags": ["ужин", "свидание"],
      "items": []
    }
  ]
}
```

Избранные подборки прошлых поколений остаются доступными, потому что
`ListFavorites` не фильтрует по `active`. При ошибке — `500
{"error":"cannot load favorites"}`.

## 5. `PUT /api/favorites/{id}`

Добавляет подборку в избранное посетителя.

- Успех: `200 {"favorite":true,"id":"..."}`.
- Несуществующая подборка: `404 {"error":"collection not found"}`.
- Повторное добавление: `200`, дубль не создаётся.
- Пустой `id` не совпадает с шаблоном маршрута и даёт `404` от
  `ServeMux`; проверка `400` в handler для этого случая недостижима.

## 6. `DELETE /api/favorites/{id}`

Удаляет подборку из избранного.

- Успех: `200 {"favorite":false,"id":"..."}`.
- Если связи не было, всё равно `200` — операция идемпотентна.
- Пустой `id` не совпадает с шаблоном маршрута и даёт `404` от
  `ServeMux`; проверка `400` в handler для этого случая недостижима.

## 7. `POST /api/collections/{id}/cart`

Возвращает ссылку на публичную корзину ВкусВилла с товарами подборки.

Успех `200`:

```json
{"url":"https://vkusvill.ru/mobile?basket&share=..."}
```

Логика:

1. Подборка загружается по `id`; если её нет — `404`.
2. Если `cart_url` непустой и `now - cart_set_at < CART_LINK_TTL`,
   возвращается кэш без вызова MCP.
3. Иначе вызывается MCP `vkusvill_cart_link_create`.
4. Ссылка должна начинаться с `https://vkusvill.ru/`, иначе `502`.
5. Ссылка сохраняется в `collections.cart_url` и `cart_set_at`.
   Ошибка сохранения только логируется; ответ пользователю не меняется.

Ошибки:

- `404 {"error":"collection not found"}`;
- `502 {"error":"cannot create cart link"}` при ошибке MCP;
- `502 {"error":"unexpected cart link"}` при чужом домене.

## 8. `GET /healthz`

Всегда `200` и текст `ok\n`. Проверяет только то, что процесс отвечает.

## 9. `GET /readyz`

- `200` и `ready\n`, если в БД есть хотя бы одна активная подборка.
- `503 {"error":"not ready"}`, если активного поколения нет или БД
  недоступна.

## 10. Примеры

```sh
curl -s 'http://localhost:8080/api/collections' | python3 -m json.tool
curl -s --get --data-urlencode 'tag=ужин' \
  'http://localhost:8080/api/collections' | python3 -m json.tool
curl -s 'http://localhost:8080/api/favorites' | python3 -m json.tool
curl -s -X PUT 'http://localhost:8080/api/favorites/dinner-500-1792666479'
curl -s -X DELETE 'http://localhost:8080/api/favorites/dinner-500-1792666479'
curl -s -X POST 'http://localhost:8080/api/collections/dinner-500-1792666479/cart'
```

Для запросов с cookie используйте `curl -c cookies.txt -b cookies.txt`,
иначе каждый запрос получит нового посетителя.
