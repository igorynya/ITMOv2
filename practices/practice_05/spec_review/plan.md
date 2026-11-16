# Implementation Plan: фильтр подборок по тегу

**Branch**: N/A — работа идёт в `practices/practice_04/collections`

**Date**: 2026-10-23

**Spec**: `practices/practice_05/spec_review/spec.md`

**Contract**: `practices/practice_05/contract.md`

**Input**: `spec.md`, `contract.md`, `gaps.md`, код сервиса
`practices/practice_04/collections`.

## Summary

Добавить серверную фильтрацию активных подборок по одному тегу и строку
чипов на вкладке «Все». Сервер читает активный пул одним запросом,
строит из него `tags`, находит каноническое написание, фильтрует
подборки и только потом делает случайную выборку. UI показывает
загрузку, успех, пустоту и ошибку, сохраняет фильтр при переходе на
«Избранное», поддерживает клавиатуру и горизонтальную прокрутку чипов.

Стек не меняется: Go stdlib, `net/http`, существующий SQLite-драйвер,
`embed`. Новых зависимостей и миграций БД нет. Корзина и избранное не
переделываются.

## Technical Context

**Language/Version**: Go 1.27.3 (`practices/practice_04/collections/go.mod`).

**Primary Dependencies**: стандартная библиотека (`net/http`,
`database/sql`, `encoding/json`, `strings`, `sort`, `math/rand`,
`unicode/utf8`), существующий `modernc.org/sqlite`, существующий
`embed`. Новые зависимости не добавляются.

**Storage**: SQLite, существующие таблицы `collections`, `favorites`,
`meta`. Схема, формат `collections.tags` (JSON-массив) и миграции не
меняются.

**Testing**: `go test ./...`, `go vet ./...` в
`practices/practice_04/collections`. UI проверяется вручную по
`quickstart.md`; JS-тест-раннера в проекте нет, новый не добавляем.

**Target Platform**: локальный учебный веб-сервис, современные браузеры,
мобильная ширина от 320 px.

**Project Type**: single Go web service с встроенной статикой.

**Performance Goals**: активный пул — десятки подборок; фильтрация и
сортировка тегов укладываются в линейный проход по пулу. Отдельных
нагрузочных целей нет.

**Constraints**:

- не менять схему БД и формат хранения тегов;
- не добавлять зависимости;
- не менять коды и формат ошибок других эндпоинтов;
- `collections`, `tags`, `favorites` всегда массивы, не `null`;
- размер страницы берётся из `Config.PerPage` (10–15, по умолчанию 12);
- не трогать корзину и избранное без необходимости;
- фильтр не сохраняется в URL и на сервере.

**Scale/Scope**: один эндпоинт `GET /api/collections`, один экран
«Все», строка чипов; существующие 18 шаблонов подборок.

## Constitution Check

Файл `.specify/memory/constitution.md` пока является шаблоном без
ратифицированных принципов. Гейты ниже выведены из `AGENTS.md` и
ограничений задачи.

| Гейт | Статус | Как соблюдается |
| --- | --- | --- |
| Минимальный scope | PASS | меняются только store/httpapi, web и тесты; корзина/избранное не переделываются |
| Нет новых зависимостей | PASS | только stdlib и уже подключённые пакеты |
| Нет изменения схемы БД | PASS | используется существующая колонка `tags` |
| Тесты обязательны | PASS | unit-тесты domain/store/httpapi + ручной UI-чек-лист |
| Обратная совместимость API | PASS | существующие поля сохраняются, добавляются только `tags` и `active_tag` |
| Русский текст интерфейса | PASS | все новые сообщения UI на русском, без технических деталей |
| Согласованность документов | PASS | FR, SC, AC, план, задачи и контракты используют одни и те же коды `200/400/500`, состояния и границы |
| Проверяемость границ | PASS | percent-encoding/UTF-8, `TrimSpace`, 64 символа и один вызов `ActivePool` покрыты тестами |
| Никаких `git reset --hard`/чужих правок | PASS | план не требует деструктивных операций |

Нарушений нет; `Complexity Tracking` не заполняется.

## Project Structure

### Документация фичи

```text
practices/practice_05/spec_review/
├── plan.md                  # этот файл
├── research.md              # решения и альтернативы
├── data-model.md            # производные сущности и состояние UI
├── contracts/
│   ├── http-api.md          # контракт GET /api/collections
│   └── ui-state.md          # DOM, состояние и переходы UI
├── quickstart.md            # проверки и ручные сценарии
└── tasks.md                 # создаст /speckit.tasks, не этот этап
```

### Исходный код

```text
practices/practice_04/collections/
├── internal/domain/
│   ├── collection.go        # без изменений
│   ├── tags.go              # новый: нормализация, канонизация, фильтрация
│   └── tags_test.go         # новый
├── internal/store/
│   ├── store.go             # ActivePool вместо SampleActive
│   └── store_test.go        # тесты активного пула
├── internal/httpapi/
│   ├── server.go            # парсинг tag, tags/active_tag, фильтр, выборка
│   └── server_test.go       # fakeStore + табличные тесты API
├── web/
│   ├── index.html           # #tag-bar, #feedback, #notice
│   ├── app.js               # состояние фильтра, запросы, рендер
│   └── styles.css           # чипы, фокус, мобильная прокрутка
└── README.md                # описание нового параметра и полей ответа
```

**Structure Decision**: следуем существующему single-project layout.
Правила тегов живут в `internal/domain` как чистые функции; SQL и
чтение — в `internal/store`; оркестрация HTTP — в `internal/httpapi`;
UI — в `web`.

## Design Decisions

Полные обоснования — в `research.md`.

### D-01. Активный пул читается одним запросом

В `internal/store/store.go` добавить:

```go
func (s *Store) ActivePool(ctx context.Context) ([]domain.Collection, error)
```

Запрос:

```sql
SELECT ... FROM collections WHERE active = 1
```

`scanCollections` уже возвращает непустой срез `[]domain.Collection{}`.
`SampleActive` удалить: после фильтрации выборка делается в httpapi.
Метод `Get`, `ListFavorites`, `AddFavorite`, `RemoveFavorite`,
`SetCartURL`, `HasActive` не меняются.

В `internal/httpapi/server.go` заменить в интерфейсе `Store`:

```go
ActivePool(ctx context.Context) ([]domain.Collection, error)
```

на месте `SampleActive`. Fake store в тестах обновить так же.

### D-02. Чистые правила тегов в `internal/domain/tags.go`

```go
const MaxTagLength = 64

func TrimTag(raw string) string
func AvailableTags(cols []Collection) []string
func ResolveTag(available []string, requested string) (canonical string, ok bool)
func HasTag(col Collection, tag string) bool
```

Поведение:

- `TrimTag` — `strings.TrimSpace`.
- `AvailableTags`:
  - обходит `col.Tags` всех переданных подборок;
  - обрезает значения;
  - пропускает пустые и `utf8.RuneCountInString(t) > MaxTagLength`;
  - группирует варианты через `strings.EqualFold`;
  - каноническое значение — вариант с наименьшей последовательностью
    кодовых точек (`<` для строк в UTF-8);
  - возвращает `[]string{}`, если тегов нет;
  - сортирует `sort.Strings` (порядок кодовых точек для UTF-8);
  - не меняет `col.Tags`.
- `ResolveTag` — ищет `EqualFold` в `available`, возвращает каноническое
  значение и `true`; иначе `("", false)`.
- `HasTag` — сравнивает каждый обрезанный тег подборки с `tag` через
  `EqualFold`; пустые значения пропускает.

`domain.Collection` не меняется.

### D-03. HTTP-обработчик `GET /api/collections`

Порядок в `server.collections`:

```text
q, err := url.ParseQuery(r.URL.RawQuery)
if err != nil -> 400 "invalid query"
values := q["tag"]

if len(values) > 1 -> 400 "tag must be specified once"
raw := ""
if len(values) == 1 { raw = values[0] }
if !utf8.ValidString(raw) -> 400 "tag must be valid UTF-8"
requested := strings.TrimSpace(raw)

if requested != "" &&
   utf8.RuneCountInString(requested) > domain.MaxTagLength {
    -> 400 "tag is too long"
}

pool, err := store.ActivePool(ctx)    // один вызов на запрос
if err != nil -> 500 "cannot load collections"
tags := domain.AvailableTags(pool)

activeTag := ""
selectedTag := ""
unknown := false
if requested != "" {
    canonical, ok := domain.ResolveTag(tags, requested)
    if ok {
        activeTag = canonical
        selectedTag = canonical
    } else {
        activeTag = requested
        unknown = true
    }
}

filtered := pool
if selectedTag != "" {
    filtered = filter(pool, selectedTag) // domain.HasTag
}
if unknown {
    filtered = []domain.Collection{}
}
collections := sample(filtered, s.cfg.PerPage)

favorites, err := store.ListFavorites(ctx, visitor)
if err != nil -> 500 "cannot load favorites"
favoriteIDs := make([]string, 0, len(favorites))
for _, col := range favorites { favoriteIDs = append(favoriteIDs, col.ID) }

writeJSON(200, map[string]any{
    "collections": collections,
    "favorites":   favoriteIDs,
    "tags":        tags,
    "active_tag":  activeTag,
})
```

Важно: `ActivePool` вызывается ровно один раз на запрос; `tags` и
`collections` строятся из одного среза. Валидация выполняется до этого
вызова.

`sample` — новая unexported-функция в `httpapi`:

```go
func sampleCollections(cols []domain.Collection, limit int) []domain.Collection
```

Копирует срез, перемешивает `math/rand`, берёт
`min(limit, len(cols))`; при `limit <= 0` или пустом входе возвращает
`[]domain.Collection{}`. Дубликатов нет by construction.

`favoriteIDs` — существующий код, но не забыть инициализировать пустым
срезом.

### D-04. Ответ и ошибки

Добавляются только два поля верхнего уровня:

- `tags` — `[]string`;
- `active_tag` — `string`.

Ошибки:

- `400` — `{"error":"tag must be specified once"}`, `{"error":"tag is too long"}`,
  `{"error":"invalid query"}` для некорректного percent-encoding или
  `{"error":"tag must be valid UTF-8"}` для невалидного UTF-8;
- `500` — существующий `{"error":"cannot load collections"}`.

`writeJSON`, `writeError`, `fail`, cookie посетителя, `recoverer`,
логирование не меняются. Остальные маршруты не трогаются.

### D-05. UI: состояние и загрузка

В `web/app.js` расширить `state` полями из `data-model.md`:
`tags`, `activeTag`, `loading`, `error`, `requestSeq`,
`lastRequestTag`, `noticeTimer`.

Ключевые функции:

```text
loadCollections(tag)   // ++requestSeq, requestMode=state.mode; применяет последний ответ своей вкладки
loadFavorites()        // ++requestSeq; синхронизирует state.favorites; не применяет фильтр
render()               // чипы, карточки, состояния, фокус
selectTag(tag)         // повторный клик по активному -> ""
resetFilter()          // activeTag="", загрузка всех, фокус на «Все»
retry()                // lastRequestTag
showNotice(text)       // #notice, автоскрытие ~5 с
```

Правила:

- `loadCollections` добавляет `?tag=` только для непустого тега;
  значение кодируется через `URLSearchParams` (кириллица); cache-buster
  `t` можно сохранить.
- Каждый запрос запоминает `requestMode`. Ответ `loadCollections`
  применяется, только если `seq === state.requestSeq` и `requestMode ===
  state.mode`; `collections`/`favorites` обновляются всегда, а
  `tags`/`activeTag` — только если `requestMode === "all"`. Ответ
  `loadFavorites` — только если `seq` совпал и `state.mode ===
  "favorites"`.
- На успехе обновить `collections` и `favorites`; `tags` и `activeTag`
  обновлять только при `requestMode === "all"`. `loadFavorites` MUST
  синхронизировать `state.favorites` из ответа:
  `new Set(data.collections.map((c) => c.id))` (endpoint не меняется),
  включая пустой список.
- Если `requestMode === "all"`, запрошенный тег непустой и `active_tag`
  не найден в `tags` — автосброс: `activeTag=""`,
  `showNotice("Тег больше недоступен, фильтр сброшен")`, повторный
  запрос без тега. Уведомление живёт в `#notice` около 5 секунд,
  объявляется через живой регион и не блокирует интерфейс. Пустоту по
  исчезнувшему тегу не показывать.
- На ошибке сохранить `lastRequestTag`. Для `500` показать
  пользовательский текст и «Повторить»; для `400` показать сообщение о
  невозможности применить фильтр и «Сбросить фильтр», без «Повторить».
  Чипы снова доступны.
- При переходе на «Избранное» `activeTag` сохраняется, чипы скрываются,
  `loadFavorites` не фильтрует. При возврате на «Все» — загрузка с
  сохранённым тегом.
- «Ещё подборки» на «Все» использует текущий `activeTag`. На
  «Избранном» кнопка сохраняет текущее поведение и вызывает
  `loadCollections`; ответ не перезаписывает `activeTag` и `tags`, пока
  активна вкладка «Избранное». Остальное поведение избранного не
  меняется.
- Во время загрузки чипы получают `aria-disabled="true"`, но не
  нативный `disabled`; обработчик активации сразу выходит, если
  `state.loading`.
- «Ещё подборки» можно блокировать нативно (`disabled`).
- Тексты ошибок — только русские, без `error.message` и HTTP-кодов.

### D-06. UI: рендер и доступность

`render()`:

- при `mode="all"` строит `#tag-bar` с `role="group"` и доступным
  именем «Фильтр по тегам»: «Все» + `state.tags` в порядке сервера;
  `aria-pressed="true"` у активного и `aria-pressed="false"` у остальных;
  текст тегов вставляется через `textContent`, без HTML; UI не
  сортирует, не дедуплицирует и не меняет регистр тегов;
- при `mode="favorites"` скрывает `#tag-bar`;
- в загрузке показывает индикатор в `#grid`, скрывает `#feedback`;
- в успехе показывает карточки, скрывает `#feedback`;
- в пустоте с фильтром — текст с тегом и «Сбросить фильтр»;
- в пустоте без фильтра — «Подборок пока нет» и «Обновить»;
- в пустоте на «Избранном» сохраняет существующий текст и действие;
- в ошибке `500` — текст и «Повторить»; при ошибке с тегом текст
  называет тег;
- в ошибке `400` — текст о невозможности применить фильтр и «Сбросить
  фильтр», без «Повторить»;
- `#empty` удаляется: все пустые состояния и ошибки показывает один
  `#feedback`;
- сохраняет существующую отрисовку карточек, избранного и корзины.

Фокус:

- `resetFilter` после рендера фокусирует чип «Все»;
- если сфокусированная кнопка действия исчезла после успеха, фокус
  переходит на активный чип или «Все»;
- на `focus` чипа вызывать
  `scrollIntoView({block:"nearest", inline:"nearest"})`.

Живые регионы: текст загрузки/успеха/пустоты/ошибки пишется в
единственный `#status` с `role="status"`; у `#grid` атрибут `aria-live`
убирается. Элемент `#notice` с `role="status"` добавляется в T024;
уведомление об исчезнувшем теге пишется в него.

### D-07. UI: стили

В `web/styles.css`:

- `#tag-bar` — flex-строка, `flex-wrap: nowrap`, `overflow-x: auto`,
  `min-width: 0`, `overscroll-behavior-x: contain`;
- `.chip` — `min-height: 44px`, `min-width: 44px`, `white-space:
  nowrap`, заметная рамка/заливка активного, `:focus-visible` с
  контрастным outline;
- контраст текста и фона чипов/подписей — не ниже WCAG AA;
- активный чип отличается заливкой, рамкой/внутренней тенью и жирным
  начертанием, не только цветом;
- `#feedback` — панель с текстом и кнопкой;
- `#grid[aria-busy="true"]` / `.loading` — индикатор загрузки;
- на мобильной ширине строка остаётся одной, страница не получает
  горизонтальную прокрутку.

### D-08. Что не меняется

- API избранного: `GET /api/favorites`, `PUT`/`DELETE
  /api/favorites/{id}`, состав и счётчик избранного;
- `POST /api/collections/{id}/cart`;
- кэш `cart_url`, `CartLinkTTL`, cookie посетителя;
- схема БД и `SaveGeneration`/`Cleanup`;
- генератор и шаблоны подборок;
- коды и тексты ошибок остальных эндпоинтов.

На «Избранном» кнопка «Ещё подборки» сохраняет текущее поведение
(`loadCollections`), но её ответ не перезаписывает сохранённый
`activeTag` и `tags`, пока активна вкладка «Избранное». Это следствие
FR-045, а не новая функция избранного.

### Покрытие требований

| Требования `spec.md` | Где в плане |
| --- | --- |
| FR-001–FR-013 (API, фильтр, выборка) | D-01, D-03, D-04 |
| FR-014–FR-020 (`tags`, канонизация, порядок) | D-02, D-03, D-06 |
| FR-021–FR-037 (чипы, состояния, ошибки) | D-05, D-06, D-07 |
| FR-038–FR-042 (сброс, «Ещё подборки», карточки) | D-05 |
| FR-043–FR-047 (вкладка «Избранное») | D-05, D-08 |
| FR-048–FR-055 (клавиатура, мобильная строка) | D-06, D-07 |
| FR-056–FR-059 (совместимость и границы) | D-08, Out of Scope |

## Implementation Phases

### Phase 0. Research

Выполнено: `research.md` фиксирует решения R-01–R-13 и риски.

### Phase 1. Contracts and data model

Выполнено: `data-model.md`, `contracts/http-api.md`,
`contracts/ui-state.md`.

### Phase 2. Domain

1. Написать `internal/domain/tags_test.go` по списку тестов ниже.
2. Убедиться, что тесты падают.
3. Реализовать `internal/domain/tags.go` с `MaxTagLength`, `TrimTag`,
   `AvailableTags`, `ResolveTag`, `HasTag`.
4. `go test ./internal/domain`.

### Phase 3. Store

1. Обновить `store_test.go`: `TestActivePoolReturnsOnlyLatestGeneration`,
   `TestActivePoolEmptyReturnsEmptySlice`.
2. Заменить `SampleActive` на `ActivePool` в `store.go`.
3. `go test ./internal/store`.

### Phase 4. HTTP API

1. Обновить `fakeStore` и `Store`-интерфейс.
2. Написать табличные тесты `collections` по списку ниже.
3. Реализовать парсинг `tag`, `AvailableTags`, `ResolveTag`,
   фильтрацию, `sampleCollections`, поля `tags`/`active_tag`.
4. `go test ./internal/httpapi`.

### Phase 5. UI

1. `index.html`: добавить `#tag-bar`, `#feedback` с
   `#feedback-text`/`#feedback-action`, `#notice`; сохранить шаблон
   карточки.
2. `app.js`: расширить состояние, добавить `loadCollections(tag)`,
   `loadFavorites`, `selectTag`, `resetFilter`, `retry`, `showNotice`,
   обновить `render` и обработчики вкладок/«Ещё подборки».
3. `styles.css`: стили чипов, фокуса, `#feedback`, загрузки и
   мобильной строки.
4. Проверить, что избранное и корзина работают как раньше.

### Phase 6. Documentation and verification

1. Обновить `README.md`: параметр `tag`, поля `tags`/`active_tag`,
   примеры `curl`.
2. Запустить `go test ./...` и `go vet ./...`.
3. Пройти ручные сценарии из `quickstart.md`.
4. Зафиксировать результаты в отчёте; при отклонении от `gaps.md`
   обновить `contract.md` и `spec.md` (в этом плане отклонений нет).

## Test Plan

### `internal/domain/tags_test.go`

- `TestTrimTag` — пробелы по краям, внутренние пробелы значимы.
- `TestAvailableTagsTrimsSortsAndDedupes` — порядок кодовых точек, нет
  дублей, пустые пропущены.
- `TestAvailableTagsPicksCanonicalCaseVariant` — `["Ужин","ужин"]` дают
  одно значение, `active_tag`/`tags` используют его.
- `TestAvailableTagsSkipsEmptyAndTooLong` — 64 символа включены, 65 —
  нет; проверка на кириллице (символы, не байты).
- `TestAvailableTagsEmptyInput` — `[]string{}`, не `nil`.
- `TestResolveTagCaseInsensitive` — `УЖИН` → каноническое `ужин`; эхо
  для неизвестного.
- `TestHasTagMatchesAnyTag` — подборка с несколькими тегами; пустой
  массив тегов не совпадает.
- `TestHasTagTrimsDataTags` — тег в данных с пробелами совпадает.

### `internal/store/store_test.go`

- `TestActivePoolReturnsOnlyLatestGeneration` — после двух поколений
  возвращает только активное, старые `Get` остаются доступны.
- `TestActivePoolEmptyReturnsEmptySlice` — пустая БД даёт `[]`, не
  `nil`.
- Существующие тесты избранного/корзины/поколений остаются зелёными.

### `internal/httpapi/server_test.go`

- `TestCollectionsWithoutTag` — `200`, `active_tag: ""`, `tags` есть,
  `favorites` полный.
- `TestCollectionsFiltersKnownTag` — только подборки с тегом; `tags`
  остаётся полным и не сужается до результата.
- `TestCollectionsCanonicalizesCase` — `УЖИН`/` ужин ` дают один набор
  и канонический `active_tag`.
- `TestCollectionsUnknownTagIsEmpty200` — `200`, `collections: []`,
  `tags`/`favorites` полные, `active_tag` — эхо.
- `TestCollectionsEmptyTagMeansNoFilter` — `tag=`, `tag=+++` → без
  фильтра.
- `TestCollectionsRejectsRepeatedTagBeforeStore` — `tag=a&tag=b` → `400`,
  fake store не вызван.
- `TestCollectionsTagLengthBoundary` — 64 символа `200`, 65 → `400`,
  store не вызван.
- `TestCollectionsRejectsInvalidQueryBeforeStore` — битый
  percent-encoding → `400`, fake store не вызван.
- `TestCollectionsRejectsInvalidUTF8BeforeStore` — невалидный UTF-8 →
  `400`, fake store не вызван.
- `TestCollectionsCallsActivePoolOnce` — один вызов на запрос; `tags` и
  `collections` из одного результата.
- `TestCollectionsSamplesWithinTag` — больше `PerPage` подходящих →
  ровно `PerPage`, все с тегом, без дублей; меньше — все; ноль — `[]`.
- `TestCollectionsKeepsFavoritesIndependent` — `favorites` одинаковый
  с фильтром и без.
- `TestCollectionsStoreError` — `500`, поле `error`.
- `TestCollectionsArraysAreNotNull` — в JSON `collections`, `tags`,
  `favorites` не `null`.
- `TestCollectionsLateGeneration` — не требуется на уровне HTTP; store
  отдаёт один пул.

### Проверки

```sh
cd practices/practice_04/collections
go test ./...
go vet ./...
```

## Manual End-to-End Checks

Полный сценарий — в `quickstart.md`. Обязательный минимум:

1. Запустить сервис, открыть `http://localhost:8080`.
2. Выбрать тег «ужин»: только подборки с тегом, один активный чип,
   карточек не больше `COLLECTIONS_PER_PAGE`.
3. Повторно нажать активный тег и «Все»: фильтр снимается.
4. Выбрать тег без результатов (если есть в данных) или временно
   ограничить данные: пустое состояние с названием тега и «Сбросить
   фильтр», фокус на «Все».
5. Нажать «Ещё подборки» при фильтре: новая выборка внутри тега,
   фильтр сохраняется.
6. Перейти на «Избранное»: чипы скрыты, избранное полное, счётчик не
   меняется; вернуться — фильтр восстановлен.
7. Проверить клавиатуру: Tab/Shift+Tab, Enter/Space, видимый фокус,
   недоступные чипы в загрузке.
8. Проверить ширину 320 px: одна строка чипов с горизонтальной
   прокруткой, страница без горизонтальной прокрутки, последний чип
   достижим.
9. Симулировать ошибку (DevTools → Offline): сообщение без технических
   деталей и «Повторить»; после восстановления сети повтор возвращает
   успех/пустоту.
10. На отфильтрованной карточке добавить в избранное и открыть корзину:
    фильтр и счётчик не ломаются.
11. Получить `400` подменой ответа в DevTools: сообщение и «Сбросить
    фильтр», без «Повторить».
12. Смоделировать исчезновение выбранного тега из `tags`: автосброс на
    «Все», уведомление около 5 секунд, пустота по старому тегу не
    показывается.
13. Проверить пустой `tags`: остаётся только «Все», фильтр не
    применяется.

## Risks and Mitigations

| Риск | Смягчение |
| --- | --- |
| Полный активный пул в памяти | сейчас десятки строк; при росте — отдельная задача с выборкой только `id/tags` |
| `strings.EqualFold` — simple folding, не полный | зафиксировать поведение тестами; не добавлять `x/text` |
| Случайная выборка делает тесты нестабильными | проверять размер/состав/уникальность, не порядок |
| Поздний ответ при переключении вкладок | `requestSeq` + `requestMode`/`mode` |
| `disabled` ломает фокус | `aria-disabled` + программная блокировка активации |
| Нет автотестов UI | ручной чек-лист `quickstart.md` |
| `tags` и `collections` из разных пулов | один вызов `ActivePool` на запрос |

## Out of Scope

- миграции и изменения схемы БД;
- новые зависимости и JS-тест-раннер;
- отдельный `/api/tags`;
- выбор нескольких тегов, поиск, сортировка, счётчики на чипах;
- сохранение фильтра в URL или на сервере;
- изменения API и поведения корзины и избранного (кроме перезагрузки
  списка избранного кнопкой «Ещё подборки» ради сохранения
  `activeTag`);
- изменения генератора и шаблонов;
- переработка карточек и вкладок сверх строки чипов и состояний.
