# Правила для агента: интерфейс «Подборки ВкусВилла»

- Стек: React + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui (new-york). Тесты: Vitest + React Testing Library.
- Поведение описано в `../spec.md` (правила 1-19, состояния S1-S10). Внешний вид: `../mockup/REPORT.md`. Сначала читай их.
- Переиспользуй компоненты из `src/components/ui` (button, input, label, card, badge, tabs, skeleton, alert). Новый примитив добавляй туда в стиле shadcn, а не пиши разметку вручную.
- Цвета, радиусы и отступы берутся из токенов в `src/index.css` (`@theme`). Не вписывай цвета и радиусы в компоненты числами.
- Бэкенд (Go, `practices/practice_04/collections`) и контракт API не менять. Запросы идут на `/api/...`, в dev их проксирует Vite на `localhost:8080`.
- Эталонные скриншоты и тесты не править ради зелёного результата: сначала найди причину падения.
- После правок запускай `npm run typecheck` и `npm test`. Коммиты только по просьбе пользователя.
