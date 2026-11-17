# Скриншоты работы интерфейса

Сняты с настоящим Go-сервисом `practices/practice_04/collections` (кроме S6 и S9: сервис остановлен специально).

## Основной сценарий: тег → карточки → «В корзину» → ссылка

| Шаг | Файл |
| --- | --- |
| Все подборки (S2) | `s2-list-desktop.png` |
| Фильтр по тегу «ужин» (S2) | `s2-filter-uzhin.png` |
| Фильтр чипом «десерт» | `s2-filter-desert-chip.png` |
| Корзина готова (S10) | `s10-cart-ready.png` |
| Корзина открыта на сайте ВкусВилла | `s10-vkusvill-basket-opened.png` |

## Состояния

| Код | Файл |
| --- | --- |
| S1 загрузка | `s1-loading.png` |
| S3 пусто по тегу | `s3-empty-tag-xyz.png` |
| S5 пустое избранное | `s5-empty-favorites.png` |
| S6 ошибка загрузки, «Повторить» | `s6-error-retry.png` |
| S8 «Собираем корзину…» | `s8-cart-loading.png` |
| S9 ошибка корзины | `s9-cart-error.png` |

S4 (пусто без фильтра) и S7 (ошибка 400) на живом сервисе не воспроизводятся (клиентская проверка длины срабатывает раньше сервера); они проверены компонентными тестами.

## Форма и избранное

| Что | Файл |
| --- | --- |
| Валидация: пустой ввод | `validation-empty.png` |
| Валидация: больше 64 символов | `validation-65-chars.png` |
| Сердце на карточке | `favorite-heart-on-card.png` |
| Вкладка «Избранное» | `favorites-tab-with-card.png` |

## Доступность и адаптивность

| Что | Файл |
| --- | --- |
| Фокус с клавиатуры | `keyboard-focus.png` |
| Ширина 320 px, верх страницы | `mobile-320-top.png` |
| Ширина 320 px, карточки и «Корзина готова» | `mobile-320-cards-cart-ready.png` |

## Результаты запусков тестов

| Команда | Файл |
| --- | --- |
| `npm run typecheck` | `terminal-typecheck.png` |
| `npm test` (38 тестов) | `terminal-npm-test.png` |
| `npm run e2e` (4 теста) | `terminal-e2e-full.png` |
| `npm run e2e:visual:update`, `e2e:visual`, `e2e` (7 + 11 тестов) | `terminal-e2e-visual.png` |
