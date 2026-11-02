# Данные и хранилище

## 1. Общее

Хранилище — SQLite через pure-Go драйвер `modernc.org/sqlite`.
Файл по умолчанию: `./data/collections.db` (переменная `DB_PATH`).

При открытии:

```text
file:<path>?_pragma=busy_timeout(5000)
            &_pragma=journal_mode(WAL)
            &_pragma=foreign_keys(1)
```

Дополнительно:

- каталог файла создаётся автоматически (`os.MkdirAll`);
- пул соединений: максимум 4 открытых и 4 свободных;
- при старте выполняется `Ping`.

## 2. Схема

```sql
CREATE TABLE IF NOT EXISTS collections (
    id          TEXT PRIMARY KEY,
    slug        TEXT NOT NULL,
    title       TEXT NOT NULL,
    subtitle    TEXT NOT NULL,
    template    TEXT NOT NULL,
    budget      INTEGER NOT NULL,
    total       INTEGER NOT NULL,
    items       TEXT NOT NULL,
    tags        TEXT NOT NULL,
    cart_url    TEXT NOT NULL DEFAULT '',
    cart_set_at INTEGER NOT NULL DEFAULT 0,
    generation  INTEGER NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collections_active
    ON collections(active, generation);
CREATE INDEX IF NOT EXISTS idx_collections_created
    ON collections(created_at);

CREATE TABLE IF NOT EXISTS favorites (
    visitor_id    TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    PRIMARY KEY (visitor_id, collection_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_favorites_visitor
    ON favorites(visitor_id, created_at);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

Миграции не версионируются: `Migrate` просто выполняет этот идемпотентный
скрипт. Схема фичей practice_05 не менялась.

## 3. Таблица `collections`

Одна строка — одна подборка поколения.

| Поле | Назначение |
| --- | --- |
| `id` | `slug-generation`, например `dinner-500-1792666479` |
| `slug`, `title`, `subtitle`, `template` | Данные шаблона |
| `budget` | Лимит шаблона, `0` — без лимита |
| `total` | Сумма товаров подборки |
| `items` | JSON-массив `domain.Product` |
| `tags` | JSON-массив строк |
| `cart_url`, `cart_set_at` | Кэш ссылки на корзину и время сохранения |
| `generation` | Unix-время генерации |
| `active` | `1` — текущее поколение, `0` — старое |
| `created_at` | Unix-время создания подборки |

`items` и `tags` при записи всегда массивы, `null` не сохраняется.
`tags` читается как `[]string`; исходные значения не переписываются при
фильтрации.

### Поколения

- Номер поколения — `time.Now().UTC().Unix()` на момент генерации.
- `SaveGeneration` в одной транзакции:
  1. ставит `active = 0` всем текущим активным строкам;
  2. вставляет новые подборки с `active = 1`;
  3. обновляет `meta.last_generation`.
- Старые строки не удаляются. Это нужно, чтобы избранное на них
  продолжало работать.
- `ActivePool` читает только `WHERE active = 1`; порядок строк не задан,
  поэтому HTTP-слой перемешивает выборку.
- `Get(ctx, id)` находит подборку любого поколения, включая неактивную.
  Это используется корзиной и избранным.
- Если при старте генерация не удалась, сервис проверяет `HasActive` и
  может работать на прошлом поколении.
- `Cleanup(ctx, before)` умеет удалять старые неактивные подборки, кроме
  тех, что есть в избранном, но в текущем коде нигде не вызывается.
  Автоматической очистки нет.

## 4. Таблица `favorites`

Связь посетителя с подборкой.

- Первичный ключ `(visitor_id, collection_id)` не даёт дублей.
- `visitor_id` — значение cookie `vv_visitor` (32 hex-символа).
- `ON DELETE CASCADE`: при удалении подборки связь исчезает. На практике
  подборки не удаляются, поэтому каскад почти не срабатывает.
- `ListFavorites` соединяет `favorites` с `collections` без фильтра
  `active`, поэтому избранное переживает смену поколения.
- Порядок выдачи — `favorites.created_at DESC`.
- `AddFavorite` при нарушении внешнего ключа возвращает `store.ErrNotFound`,
  и API отдаёт `404`. Проверка идёт по тексту ошибки `FOREIGN KEY`.
- `RemoveFavorite` не проверяет существование связи: удаление
  идемпотентно.

## 5. Кэш ссылки на корзину

Кэш хранится прямо в `collections`:

- `cart_url` — ссылка;
- `cart_set_at` — Unix-время сохранения.

Правило чтения: если `cart_url != ''` и
`now.Sub(cart_set_at) < CART_LINK_TTL`, ссылка возвращается без MCP.
`CART_LINK_TTL` по умолчанию `24h`, должен быть положительным.

Ссылка общая для всех посетителей: она не привязана к аккаунту и не
зависит от cookie.

## 6. Таблица `meta`

Сейчас используется одна запись:

| key | value |
| --- | --- |
| `last_generation` | номер последнего сохранённого поколения |

`LastGeneration` читает значение и возвращает `0`, если записи нет.
`HasActive` отдельно проверяет наличие строк с `active = 1`.

## 7. Согласованность и конкурентность

- SQLite работает в WAL-режиме, `busy_timeout` 5 секунд.
- Запись поколения идёт одной транзакцией: промежуточное состояние без
  активного поколения наружу не попадает.
- Чтение активного пула и избранного — отдельные запросы. В ответе
  `/api/collections` `tags` и `collections` строятся из одного среза
  `ActivePool`, поэтому относятся к одному поколению. `favorites` может
  быть прочитан в момент смены поколения, но это не влияет на фильтр.
- Максимум 4 соединения; при интенсивной записи возможны ожидания до
  `busy_timeout`.

## 8. Резервное копирование и сброс

- Для локального сброса достаточно остановить сервис и удалить
  `data/collections.db` (при следующем запуске схема создастся заново).
- При удалении БД пропадут избранное и кэш корзины.
- Файл `data/collections.db` — локальные данные, а не исходники.
