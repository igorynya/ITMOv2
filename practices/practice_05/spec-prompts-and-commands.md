# Промпты и порядок команд для ДЗ 5

Практическая памятка: как писать промпты для Spec Kit и какие команды
запускать после спек. Код на этапе спек не пишем.

## 0. Что важно знать про эту версию Spec Kit

- `/speckit.specify` не создаёт git-ветку. Команда создаёт
  `spec.md` в указанной директории и записывает путь в
  `.specify/feature.json`.
- `.specify/feature.json` уже в `.gitignore`, поэтому в каждом worktree
  он свой.
- Каждая команда кладёт результат в свою папку:
  `practices/practice_05/spec_ui` и
  `practices/practice_05/spec_logic`.
- Дальше все команды Spec Kit работают с одной feature-директорией:
  `practices/practice_05/spec_review`. Именно она должна быть записана в
  `.specify/feature.json`.
- Директорию задаём явно:
  `SPECIFY_FEATURE_DIRECTORY=practices/practice_05/spec_ui`.
- Если переменная не подхватилась, задай её в shell до запуска opencode:
  `export SPECIFY_FEATURE_DIRECTORY=practices/practice_05/spec_ui`.
- Если команды `/speckit.*` не видны, перезапусти opencode: они появились
  после старта текущей сессии.

## 1. Общая структура промпта для `/speckit.specify`

Любой промпт для спеки состоит из девяти блоков:

1. **Роль** — кто пишет: UI-команда или команда логики.
2. **Контекст** — какие файлы прочитать и что уже работает.
3. **Задача** — какую часть фичи описать.
4. **Границы** — что команда не решает и не описывает.
5. **Предположения по контракту** — что считаем известным, а что спорно.
6. **Критерии приёмки** — проверяемые сценарии.
7. **Ограничения** — не менять код, не запускать следующие команды.
8. **Формат вывода** — спека по шаблону Spec Kit, спорное — в Assumptions
   или `[NEEDS CLARIFICATION]`.
9. **Куда кладём результат** — точная папка команды
   `practices/practice_05/spec_<команда>` и путь к `spec.md`.

Главное правило: одна команда — одна спека. UI не проектирует API,
логика не рисует экран.

## 2. Промпт команды UI

```text
/speckit.specify

SPECIFY_FEATURE_DIRECTORY=practices/practice_05/spec_ui

Результат:
- создай спеку в practices/practice_05/spec_ui/spec.md;
- запиши этот путь в .specify/feature.json;
- больше никаких директорий спек не создавай.

Ты — команда UI. Опиши только пользовательское поведение интерфейса
фильтра подборок по тегу.

Контекст:
- прочитай practices/practice_05/feature-tag-filter.md;
- посмотри web/index.html, web/app.js, web/styles.css;
- посмотри internal/httpapi/server.go только чтобы понять текущий формат
  ответа API, не проектируй backend.

Задача:
- опиши сценарии: выбрать тег, сбросить фильтр, вернуться к «Все»;
- опиши состояния: загрузка, успех, пусто, ошибка с повтором;
- опиши поведение вкладки «Избранное» и возврата на «Все»;
- опиши доступность с клавиатуры и мобильную прокрутку чипов;
- сформулируй проверяемые критерии приёмки.

Границы:
- не меняй код;
- не выбирай endpoint, имя query-параметра и формат ответа;
- не описывай CSS-классы, функции и структуры данных;
- не запускай /speckit.plan, /speckit.tasks, /speckit.implement.

Предположения:
- список тегов приходит с сервера;
- фильтр применяется только к вкладке «Все»;
- максимум 12 карточек, меньше — показываем сколько есть.

Ограничения:
- только spec.md и автоматический checklist;
- спорные места — в Assumptions, максимум 3 [NEEDS CLARIFICATION];
- в конце перечисли, что должна подтвердить команда логики.

Остановись после создания спеки и покажи путь к spec.md.
```

## 3. Промпт команды логики

```text
/speckit.specify

SPECIFY_FEATURE_DIRECTORY=practices/practice_05/spec_logic

Результат:
- создай спеку в practices/practice_05/spec_logic/spec.md;
- запиши этот путь в .specify/feature.json;
- больше никаких директорий спек не создавай.

Ты — команда логики. Опиши только поведение фильтрации подборок по тегу.

Контекст:
- прочитай practices/practice_05/feature-tag-filter.md;
- посмотри internal/httpapi/server.go, internal/store и internal/domain;
- не меняй UI и не проектируй экран.

Задача:
- опиши фильтрацию активных подборок по одному тегу;
- опиши регистронезависимое сравнение и каноническое написание тега;
- опиши пустой тег, неизвестный тег и слишком длинный тег;
- опиши список доступных тегов и что он содержит;
- опиши, что происходит с избранным и корзиной;
- опиши случайную выборку внутри отфильтрованного набора;
- сформулируй проверяемые критерии приёмки.

Границы:
- не меняй код;
- не описывай чипы, состояния экрана и доступность;
- не запускай /speckit.plan, /speckit.tasks, /speckit.implement.

Предположения:
- фильтр — один тег за запрос;
- схема БД не меняется;
- если подходящих подборок меньше 12, возвращаем все.

Ограничения:
- только spec.md и автоматический checklist;
- точный HTTP-контракт предложи, но пометь как «на согласование»;
- спорные места — в Assumptions, максимум 3 [NEEDS CLARIFICATION];
- в конце перечисли, что должна подтвердить команда UI.

Остановись после создания спеки и покажи путь к spec.md.
```

## 4. Что делать после двух спек

Каждая команда коммитит только свою директорию
`practices/practice_05/spec_...` и останавливается. Дальше — отдельный
worktree ревью:

```bash
git checkout team-ui -- practices/practice_05/spec_ui
git checkout team-logic -- practices/practice_05/spec_logic
```

Таблица и правила заполнения уже лежат в
`practices/practice_05/contract.md`. Ревьюер заполняет её, а не создаёт
заново.

### 4.1. Промпт агента-ревьюера

Это отдельный промпт, не команда Spec Kit. Запускай его в worktree ревью.

```text
Ты — агент-ревьюер. Твоя задача — свести две частичные спеки в одну,
заполнить контракт и не писать код.

Вход:
- practices/practice_05/spec_ui/spec.md;
- practices/practice_05/spec_logic/spec.md;
- practices/practice_05/feature-tag-filter.md;
- practices/practice_05/contract.md;
- .specify/templates/spec-template.md;
- .specify/memory/constitution.md.

Результат:
- заполненная таблица в practices/practice_05/contract.md;
- итоговая спека в practices/practice_05/spec_review/spec.md;
- файл пробелов practices/practice_05/spec_review/gaps.md, если он нужен;
- путь practices/practice_05/spec_review записан в .specify/feature.json.

Шаги:
1. Прочитай обе спеки, бриф, шаблон спеки и конституцию.
2. Заполни в contract.md все строки таблицы: что ожидает UI, что обещает
   логика, какое решение принимаем. Пустых ячеек быть не должно.
3. Найди противоречия между UI и логикой. Если противоречие меняет
   поведение фичи, не выбирай молча: задай пользователю вопрос с 2–3
   вариантами и последствиями. Задавай не больше 3 вопросов за раз.
   После ответа обнови таблицу и итоговую спеку.
4. Если для реализации не хватает пунктов (валидация, состояния, формат
   ответа, проверки), создай practices/practice_05/spec_review/gaps.md.
   Для каждого пробела укажи: что не описано, почему это нужно, что
   предлагаешь по умолчанию и на что это влияет. Не выдавай предложение
   за требование.
5. Собери practices/practice_05/spec_review/spec.md по шаблону Spec Kit:
   user stories, edge cases, functional requirements, key entities,
   success criteria, assumptions. Решения из contract.md — источник
   истины. Не добавляй новые возможности.
6. Не меняй spec_ui и spec_logic, не пиши код, не запускай
   /speckit.plan, /speckit.tasks, /speckit.implement.

В конце покажи:
- путь к итоговой спеке;
- путь к gaps.md или сообщение, что пробелов нет;
- заполненную таблицу контракта;
- список вопросов и всё, что осталось открытым.
```

### 4.2. Куда кладём артефакты и откуда берём

Все команды Spec Kit читают путь к feature-директории из
`.specify/feature.json`. Для этапов ниже он должен указывать на
`practices/practice_05/spec_review`. Если там другой путь — исправь до
запуска команды.

| Этап | Берёт из | Кладёт в |
| --- | --- | --- |
| UI-спека | `practices/practice_05/feature-tag-filter.md`, `web/*`, `internal/httpapi/server.go` | `practices/practice_05/spec_ui/spec.md`, `spec_ui/checklists/requirements.md` |
| Спека логики | `feature-tag-filter.md`, `internal/store`, `internal/domain`, `internal/httpapi` | `practices/practice_05/spec_logic/spec.md`, `spec_logic/checklists/requirements.md` |
| Ревью | `spec_ui/spec.md`, `spec_logic/spec.md`, `feature-tag-filter.md`, `contract.md`, шаблон спеки, конституция | заполненный `practices/practice_05/contract.md`, `spec_review/spec.md`, `spec_review/gaps.md` при необходимости, путь `spec_review` в `.specify/feature.json` |
| Уточнение | `spec_review/spec.md`, `contract.md` | обновлённый `spec_review/spec.md`, `spec_review/checklists/requirements.md` |
| План | `spec_review/spec.md`, `contract.md`, `spec_review/gaps.md`, код сервиса | `spec_review/plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` |
| Чеклист | `spec_review/spec.md`, `spec_review/plan.md` | `spec_review/checklists/<имя>.md` |
| Задачи | `spec_review/spec.md`, `plan.md`, `contracts/`, `contract.md` | `spec_review/tasks.md` |
| Анализ | `spec_review/spec.md`, `plan.md`, `tasks.md`, `contract.md` | отчёт в чат; при необходимости `spec_review/analysis.md` |
| Реализация | `spec_review/tasks.md`, `plan.md`, `spec.md`, `contract.md` | код и тесты в `practices/practice_04/collections`; файлы `spec_review` не переписывать |
| Сверка | код в `practices/practice_04/collections`, `spec_review/spec.md`, `plan.md`, `tasks.md`, `contract.md` | обновлённый `spec_review/tasks.md`, отчёт в чат; при необходимости `spec_review/converge.md` |

Правило передачи: следующий этап читает файлы, а не историю прошлого
чата. Поэтому перед новым чатом закоммить артефакты и проверь
`cat .specify/feature.json`.

## 5. Дальше — команды реализации

Запускай строго по порядку. Все команды — в worktree реализации, не в
worktree команд UI и логики. Сначала перенеси туда результаты ревью:

```bash
git checkout review -- practices/practice_05/spec_review \
  practices/practice_05/contract.md
```

| Шаг | Команда | Берёт из | Кладёт в | Можно ли пропустить |
| --- | --- | --- | --- | --- |
| 1 | Промпт агента-ревьюера | `spec_ui/spec.md`, `spec_logic/spec.md`, `contract.md` | `spec_review/spec.md`, заполненный `contract.md`, при необходимости `gaps.md` | Нет |
| 2 | `/speckit.clarify` | `spec_review/spec.md`, `contract.md` | `spec_review/spec.md` | Да, если вопросов нет |
| 3 | `/speckit.plan` | `spec_review/spec.md`, `contract.md`, `gaps.md` | `spec_review/plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` | Нет |
| 4 | `/speckit.checklist` | `spec_review/spec.md`, `plan.md` | `spec_review/checklists/<имя>.md` | Да |
| 5 | `/speckit.tasks` | `spec_review/spec.md`, `plan.md`, `contracts/` | `spec_review/tasks.md` | Нет |
| 6 | `/speckit.analyze` | `spec_review/spec.md`, `plan.md`, `tasks.md`, `contract.md` | отчёт в чат; при необходимости `spec_review/analysis.md` | Нет |
| 7 | `/speckit.implement` | `spec_review/tasks.md`, `plan.md`, `spec.md`, `contract.md` | код и тесты в `practices/practice_04/collections` | Нет |
| 8 | `/speckit.converge` | код, `spec_review/spec.md`, `plan.md`, `tasks.md` | дополненный `spec_review/tasks.md`, отчёт в чат | Нет |
| 9 | `/speckit.implement` | обновлённый `spec_review/tasks.md` | код и тесты в `practices/practice_04/collections` | Если пробелов нет |

### 5.1. Уточнение спеки

```text
/speckit.clarify

Вход: practices/practice_05/spec_review/spec.md и
practices/practice_05/contract.md.
Результат: обновлённый practices/practice_05/spec_review/spec.md.

Проверь итоговую спеку против contract.md.
Спрашивай только то, что меняет поведение фичи.
Не расширяй scope и не добавляй новые функции.
Максимум 3 вопроса.
```

### 5.2. План

```text
/speckit.plan

Вход: practices/practice_05/spec_review/spec.md,
practices/practice_05/contract.md и, если есть,
practices/practice_05/spec_review/gaps.md.
Результат: practices/practice_05/spec_review/plan.md, research.md,
data-model.md, contracts/ и quickstart.md.

Планируй изменение в существующем Go-сервисе practices/practice_04/collections.
Используй текущий стек: Go stdlib, net/http, SQLite, embed.
Не добавляй новые зависимости и не меняй схему БД.
В план включи: изменение store/httpapi, состояние UI, тесты и ручные
сквозные проверки. Не трогай корзину и избранное без необходимости.
```

### 5.3. Чеклист (опционально)

```text
/speckit.checklist

Вход: practices/practice_05/spec_review/spec.md и plan.md.
Результат: practices/practice_05/spec_review/checklists/<имя>.md.

Сделай чеклист качества требований для фичи фильтра по тегу.
Проверь полноту, однозначность, границы и тестируемость.
Не переписывай спеку и не добавляй код.
```

### 5.4. Задачи

```text
/speckit.tasks

Вход: practices/practice_05/spec_review/spec.md, plan.md и contracts/.
Результат: practices/practice_05/spec_review/tasks.md.

Разбей план на задачи по user stories.
Отдельно выдели: API-фильтр, список тегов, UI-чипы, состояния
загрузки/пусто/ошибка, тесты store и httpapi, ручные сквозные проверки.
Одна задача — небольшой логический шаг.
```

### 5.5. Анализ перед кодом

```text
/speckit.analyze

Вход: practices/practice_05/spec_review/spec.md, plan.md, tasks.md и
practices/practice_05/contract.md.
Результат: отчёт в чат; при необходимости сохрани его в
practices/practice_05/spec_review/analysis.md.

Проверь согласованность spec.md, plan.md и tasks.md.
Ищи противоречия с contract.md, пропущенные границы и несоответствия
конституции проекта. Ничего не меняй, выдай отчёт и рекомендации.
```

### 5.6. Реализация

```text
/speckit.implement

Вход: practices/practice_05/spec_review/tasks.md, plan.md, spec.md и
practices/practice_05/contract.md.
Результат: код и тесты в practices/practice_04/collections; файлы
practices/practice_05/spec_review не переписывай.

Выполняй tasks.md по порядку.
После каждой группы задач запускай go test ./... и go vet ./... .
Не коммить изменения и не трогай файлы вне фичи.
Если задача противоречит contract.md — остановись и покажи противоречие.
```

### 5.7. Сверка после реализации

```text
/speckit.converge

Вход: код в practices/practice_04/collections,
practices/practice_05/spec_review/spec.md, plan.md, tasks.md и
practices/practice_05/contract.md.
Результат: обновлённый practices/practice_05/spec_review/tasks.md и
отчёт в чат; при необходимости
practices/practice_05/spec_review/converge.md.

Сравни реализацию со spec.md и tasks.md.
Найди невыполненные требования, расхождения с contract.md и пропущенные
проверки. Не меняй код: добавь задачи в tasks.md и покажи отчёт.
```

### 5.8. Повторная реализация задач converge

```text
/speckit.implement

Вход: practices/practice_05/spec_review/tasks.md (только Phase 10:
Convergence, задачи T049–T052), spec.md, plan.md, contracts/,
contract.md и код practices/practice_04/collections.
Результат: исправления и тесты в practices/practice_04/collections,
evidence ручных проверок. Файлы practices/practice_05/spec_review не
переписывай.

Выполни только T049–T052 из Phase 10:

- T049: на вкладке «Избранное» «Ещё подборки» не должен заменять полный
  список избранного случайной выборкой `/api/collections`; загружай
  полный список через `loadFavorites` или иначе сохраняй его. Тексты
  загрузки и ошибок должны соответствовать режиму избранного. Сверься с
  FR-043, FR-046, US5/AC1 и US5/AC5. Если plan.md D-05/T037 требует
  обратного, покажи противоречие и не меняй поведение молча.
- T050: пройди `quickstart.md` (4.1–4.9) и сохрани результаты в
  evidence; укажи, какие сценарии подтверждены, а какие нет.
- T051: добавь автотесты на границы: пробелы внутри тега значимы;
  NUL и управляющие символы допустимы; неизвестный тег с пробелами по
  краям возвращает обрезанный `active_tag`; тег данных с пробелами
  совпадает через HTTP; ответ `400` не содержит `collections`;
  `tags`/`collections` строятся из одного вызова `ActivePool`; порядок
  `tags` стабилен между запросами.
- T052: удали неиспользуемое правило `.empty` и добавь `min-width: 0`
  к `#tag-bar`; проверь отсутствие горизонтальной прокрутки страницы на
  ширине 320 px.

Ограничения:
- не меняй схему БД, генератор, API и поведение избранного/корзины сверх
  T049;
- не добавляй новые зависимости;
- не переписывай `tasks.md`, `spec.md`, `plan.md` и `contract.md`;
- не коммить изменения;
- после правок запусти `go test ./...` и `go vet ./...`; при падении
  исправь причину или откати свою правку.

Остановись после выполнения T049–T052 и покажи:
- что изменено по каждой задаче;
- результаты `go test` и `go vet`;
- путь к evidence ручных проверок;
- оставшиеся риски и противоречия.
```

Если converge добавил задачи — используй промпт 5.8, затем повтори
`/speckit.converge`.

## 6. Чего не делать

- Не запускать `/speckit.plan` в worktree команды UI или логики: план
  закрепит частичные предположения до согласования контракта.
- Не запускать `/speckit.implement` до `contract.md` и `analyze`.
- Не коммитить `opencode.json`: там локальный API-ключ.
- Не смешивать две спеки в одной директории: у Spec Kit одна активная
  фича на `.specify/feature.json`.
- Не добавлять в спеку код, CSS-классы, имена функций и схемы таблиц.
