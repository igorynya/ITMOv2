# Статус задач фичи

Источник задач: `practices/practice_05/spec_review/tasks.md`.
Сверка сделана по коду и тестам в `practices/practice_04/collections`.
Чекбоксы `tasks.md` обновлены: закрыто 54 задачи, открыт только T053
(выполнен частично).

## 1. Сводка

| Блок | Задачи | Статус кода |
| --- | --- | --- |
| Setup | T001–T003 | Готово |
| Foundational | T004–T007 | Готово |
| US1: выбор тега | T008–T018 | Готово |
| US1: ручной E2E | T019 | Подтверждено (evidence) |
| US2: сброс | T020–T022 | Готово |
| US2: ручной E2E | T023 | Подтверждено (evidence) |
| US3: состояния | T024–T029 | Готово |
| US3: ручной E2E | T030 | Подтверждено (evidence) |
| US4: границы API | T031–T034 | Готово |
| US4: ручной E2E | T035 | Подтверждено (evidence) |
| US5: избранное | T036, T038–T039b | Готово |
| US5: T037 | T037 | Заменено на T049 |
| US5: ручной E2E | T039 | Подтверждено (evidence) |
| US6: доступность | T040–T043 | Готово |
| US6: ручной E2E | T044 | Подтверждено (evidence) |
| Polish | T045–T046, T048 | Готово |
| Полный E2E | T047 | Подтверждено (evidence) |
| Convergence | T049, T051, T052 | Готово в коде |
| Convergence | T050 | Готово (evidence) |
| Convergence | T053 | Частично |

## 2. По фазам

### Phase 1–2 (T001–T007) — готово

- `internal/domain/tags.go` и `tags_test.go` созданы.
- `SampleActive` заменён на `ActivePool`; интерфейс `Store` обновлён.
- `sampleCollections` вынесен в HTTP-слой.
- Тесты store и domain обновлены.
- `go test ./...` и `go vet ./...` проходят.

### US1 (T008–T019)

- T008, T011: тесты API и выборки внутри тега есть.
- T009–T010, T012: разбор `tag`, `tags`, `active_tag`, фильтрация и
  выборка реализованы.
- T013–T018: `#tag-bar`, состояние, чипы, успешный рендер и стили есть.
- T019: подтверждено прогоном 4.1, см.
  `practices/practice_05/evidence/e2e/report.md`.

### US2 (T020–T023)

- Повторный чип, «Все» и сброс из пустого состояния реализованы.
- Фокус после сброса переводится на «Все».
- T023: подтверждено прогоном 4.1/4.2, см.
  `practices/practice_05/evidence/e2e/report.md`.

### US3 (T024–T030)

- `#feedback`, `#notice`, загрузка, успех, пустота, ошибки `400`/`500`,
  «Повторить» и «Сбросить фильтр» реализованы.
- Технические тексты фильтра не выводятся.
- T030: подтверждено прогоном 4.3, см.
  `practices/practice_05/evidence/e2e/report.md`.

### US4 (T031–T035)

- Покрыты: пустой тег, известный, неизвестный, регистр, повторный
  параметр, 64/65, битый query, невалидный UTF-8, валидация до store,
  массивы не `null`, `500`, один вызов `ActivePool`.
- T035: curl-матрица подтверждена прогонами API и UI, см.
  `practices/practice_05/evidence/e2e/report.md`.

### US5 (T036–T039)

- Чипы скрываются на «Избранном», `activeTag` сохраняется и
  восстанавливается.
- `requestSeq` и `requestMode` защищают от поздних ответов.
- Автосброс исчезнувшего тега и уведомление на 5 секунд реализованы.
- T037 в исходной формулировке («оставить `loadCollections` на
  избранном») противоречит FR-043. Код использует `loadFavorites`;
  это закрывает T049, но формально расходится с T037.
- T039: подтверждено прогоном 4.4, см.
  `practices/practice_05/evidence/e2e/report.md`.

### US6 (T040–T044)

- `:focus-visible`, контраст, 44×44 px, одна строка с `overflow-x`,
  `min-width: 0`, `scrollIntoView`, `aria-disabled` реализованы.
- Чипы — нативные `button`, Enter/Space работают без отдельного
  `keydown`.
- T044: проверка клавиатуры и 320 px подтверждена прогонами 4.5 и 4.6,
  см. `practices/practice_05/evidence/e2e/report.md`.

### Phase 9 (T045–T048)

- T045: `README.md` обновлён.
- T046: `go test ./...` и `go vet ./...` проходят.
- T047: полный `quickstart.md` подтверждён прогонами API и UI, см.
  `practices/practice_05/evidence/e2e/report.md`.
- T048: сверка выполнялась (`converge.md`, `analysis.md`), но
  `converge.md` уже устарел относительно кода.

## 3. Convergence (T049–T053)

| Задача | Статус | Комментарий |
| --- | --- | --- |
| T049 | Готово | `refresh` на «Избранном» вызывает `loadFavorites` (`web/app.js:497-506`), полный список сохраняется |
| T050 | Готово | Evidence ручных E2E 4.1–4.9: `practices/practice_05/evidence/e2e/` |
| T051 | Готово | Добавлены тесты на внутренние пробелы, NUL, echo обрезанного тега, пробелы в данных, отсутствие `collections` в `400`, один `ActivePool`, стабильный порядок `tags` |
| T052 | Готово | `.empty` отсутствует, `#tag-bar` имеет `min-width: 0` (`web/styles.css:134`) |
| T053 | Частично | 64/65 и echo проверены, но нет HTTP-теста на Unicode-пробелы (`\u00a0`) в теге данных и на пустой/длинный тег данных именно в `tags` |

### T049

Было: на «Избранном» кнопка «Ещё подборки» вызывала
`loadCollections("")` и заменяла полный список избранного случайной
выборкой `/api/collections`.

Сейчас:

```js
if (state.mode === "favorites") {
  loadFavorites();
} else {
  loadCollections(state.activeTag);
}
```

Это соответствует FR-043 и US5/AC1. T037 в старом виде больше не
актуален.

### T051

Покрытие подтверждено тестами:

- `TestCollectionsTreatsInnerWhitespaceAsSignificant`;
- `TestCollectionsMatchesDataTagWithOuterSpaces`;
- `TestCollectionsUnknownTagEchoesTrimmedValue`;
- `TestCollectionsAllowsNULAndControlCharacters`;
- `TestCollectionsBadRequestOmitsCollections`;
- `TestCollectionsBuildsTagsAndCollectionsFromSingleActivePool`;
- `TestCollectionsTagsOrderIsStable`.

### T053

Есть:

- `TestCollectionsTagLengthBoundary` — 64 и 65 символов;
- `TestCollectionsUnknownTagEchoesTrimmedValue` — echo обрезанного
  значения;
- `TestAvailableTagsSkipsEmptyAndTooLong` — пустые и длинные теги
  данных отбрасываются на уровне domain.

Нет именно HTTP-проверки:

- тег данных с `\u00a0` по краям попадает в `tags` обрезанным;
- пустой и длинный тег данных через HTTP не попадают в `tags`;
- неизвестный тег ровно из 64 символов даёт `200` и обрезанный
  `active_tag` (сейчас проверяется только код `200`).

## 4. Что осталось

1. Добавить HTTP-тесты из T053.
2. Обновить `converge.md`, чтобы он отражал текущий код.

Полный прогон `quickstart.md` выполнен, evidence лежит в
`practices/practice_05/evidence/e2e/`.
