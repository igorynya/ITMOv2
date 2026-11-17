# Прототип из Replit (исходники без изменений)

Это экспорт проекта Replit с прототипом интерфейса «Подборки продуктов».
**Прототип создан инструментом Replit (Agent) по промпту из
[`../prompt.md`](../prompt.md). Мы его не меняли: в приложении
(`practices/practice_08/app`) исходники используются только как образец
вёрстки, компонентов и темы.** Отчёт о том, что сделал Replit и что мы
исправляли: [`../REPORT.md`](../REPORT.md), оригинал отчёта Replit:
[`food-collections-prototype-report.md`](food-collections-prototype-report.md).

Служебная папка git-истории экспорта переименована в `.git-replit`, чтобы она
не превращалась во вложенный репозиторий. Больше в этой папке ничего не
менялось, кроме добавления этого README.

Нужные файлы:

- `artifacts/mockup-sandbox/src/components/mockups/food-collections/FoodCollections.tsx`
  и `_group.css` — основной прототип (поиск по тегу, состояния, карточки);
- `.../MenuJourney.*`, `.../MobileFoodCollections.*`, `mobilefoodcollections.css` —
  дополнительные варианты Replit, в основной сценарий не входят;
- `artifacts/mockup-sandbox/src/components/ui/` — компоненты shadcn/ui
  (стиль `new-york`, `components.json`);
- `api-server`, `lib/*`, `scripts` — шаблон Replit, к нашему сервису отношения
  не имеют.

## Как запустить прототип локально

Нужны Node.js 20+ и [pnpm](https://pnpm.io) (`npm i -g pnpm`).

```sh
cd practices/practice_08/mockup/source
pnpm install
PORT=8081 BASE_PATH=/__mockup pnpm --filter @workspace/mockup-sandbox run dev
```

Откройте в браузере:

```
http://localhost:8081/__mockup/preview/food-collections/FoodCollections
```

В правом верхнем углу есть переключатель «Состояние · только для прототипа»:
успех, загрузка, ошибки валидации, отправка, нет результатов, ошибка 400,
пустое избранное, ошибка загрузки, состояния корзины. Прототип не делает сетевых
запросов, все данные локальные.

Примечания:

- `PORT` и `BASE_PATH` обязательны (иначе `vite.config.ts` завершится с ошибкой);
- pnpm по настройке воркспейса не ставит пакеты моложе суток
  (`minimumReleaseAge` в `pnpm-workspace.yaml`);
- публичной ссылки нет: публикация Replit отдаёт 404, потому что холст
  (`kind = "design"`) работает только в режиме разработки.
- Команды запуска не проверялись в среде без доступа к npm; если адрес не
  открывается, смотрите вывод консоли `vite`.
