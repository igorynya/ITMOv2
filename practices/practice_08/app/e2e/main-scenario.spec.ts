import { expect, test, type Page } from "@playwright/test";

import { cartUrl, collectionsFor, lunch } from "../src/test/fixtures";

async function mockApi(page: Page) {
  await page.route("**/api/collections?**", (route) => {
    const tag = new URL(route.request().url()).searchParams.get("tag");
    return route.fulfill({ json: collectionsFor(tag) });
  });
  await page.route("**/api/collections", (route) => route.fulfill({ json: collectionsFor(null) }));
  await page.route("**/api/collections/*/cart", (route) => route.fulfill({ json: { url: cartUrl } }));
  await page.route("**/api/favorites", (route) => route.fulfill({ json: { collections: [lunch] } }));
}

test.beforeEach(async ({ page, context }) => {
  await mockApi(page);
  // Сайт ВкусВилла в тесте не нужен: отвечаем заглушкой на открытие корзины.
  await context.route("https://vkusvill.ru/**", (route) => route.fulfill({ body: "ok", contentType: "text/html" }));
});

test("основной сценарий: тег → карточки → «В корзину» → корзина открыта в новой вкладке", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Подборки ВкусВилла" })).toBeVisible();
  await expect(page.getByText("Показаны все подборки", { exact: false })).toBeVisible();

  await page.getByLabel("Тег", { exact: true }).fill("Ужин");
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page.getByText("Показаны подборки по тегу «ужин»", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Тег", { exact: true })).toHaveValue("ужин");
  await expect(page.getByText("Ужин на двоих")).toBeVisible();
  await expect(page.getByText("Быстрый завтрак")).toHaveCount(0);

  const popup = context.waitForEvent("page");
  await page.getByRole("button", { name: "В корзину" }).click();
  await expect(page.getByText("Корзина готова")).toBeVisible();
  const opened = await popup;
  await opened.waitForLoadState();
  expect(opened.url()).toBe(cartUrl);
  await expect(page.getByRole("link", { name: "Открыть корзину во ВкусВилле" })).toHaveAttribute("href", cartUrl);
});

test("правило 16: основной сценарий только с клавиатуры", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Показаны все подборки", { exact: false })).toBeVisible();
  await page.getByLabel("Тег", { exact: true }).focus();
  await page.keyboard.type("завтрак");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Показаны подборки по тегу «завтрак»", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "В корзину" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Корзина готова")).toBeVisible();
});

test("правило 18: на ширине 320 px нет горизонтальной прокрутки, кнопки не меньше 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await expect(page.getByText("Ужин на двоих")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const button of await page.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("S6: ошибка 500 — текст остаётся, «Повторить» восстанавливает список", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Показаны все подборки", { exact: false })).toBeVisible();
  let fail = true;
  await page.route("**/api/collections?**", (route) => {
    if (fail) {
      fail = false;
      return route.fulfill({ status: 500, json: { error: "cannot load collections" } });
    }
    const tag = new URL(route.request().url()).searchParams.get("tag");
    return route.fulfill({ json: collectionsFor(tag) });
  });
  await page.getByLabel("Тег", { exact: true }).fill("ужин");
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page.getByText("Не удалось загрузить подборки по тегу «ужин». Попробуйте ещё раз.")).toBeVisible();
  await expect(page.getByLabel("Тег", { exact: true })).toHaveValue("ужин");
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByText("Ужин на двоих")).toBeVisible();
});
