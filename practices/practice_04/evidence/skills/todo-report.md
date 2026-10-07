# Отчёт: сбор TODO/FIXME/NOTE

Дата: 2026-10-07

Результат
- Найдены TODO:
  - [TODO] practices/practice_04/README.md:46 — Сделать лабу :)
  - [TODO] practices/practice_04/README.md:47 — Проверка скилла

Исключено из поиска
- .opencode/skills/** (описания скилов)
- AGENTS.md (упоминания паттернов в правилах)

Метод
- Поиск по файлам текста и кода: md, mdx, txt, js, jsx, ts, tsx, py, sh
- Паттерн: \b(TODO|FIXME|NOTE)\b
- Исключены каталоги: .git, node_modules, dist, build

Примечание
- Для демонстрации позитивного кейса можно добавить строку вида `# TODO: пример` в любой файл и повторно запустить сбор.
