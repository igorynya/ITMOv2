import { expect, test, type Page } from "@playwright/test";

import { cartUrl, collectionsFor } from "../src/test/fixtures";

// Скриншотные тесты (лекция 8): сравнение внешнего вида состояний с эталонами.
// Эталоны создаются командой `npm run e2e:visual:update` и лежат в e2e/visual.spec.ts-snapshots/.
test.use({ locale: "ru-RU", colorScheme: "light", viewport: { width: 1280, height: 900 } });

async function mockApi(page: Page, options: { gate?: Promise<void>; failList?: boolean } = {}) {
  await page.route("**/api/collections?**", async (route) => {
    const tag = new URL(route.request().url()).searchParams.get("tag");
    if (options.failList) {
      return route.fulfill({ status: 500, json: { error: "cannot load collections" } });
    }
    return route.fulfill({ json: collectionsFor(tag) });
  });
  await page.route("**/api/collections", async (route) => {
    if (options.gate) await options.gate;
    return route.fulfill({ json: collectionsFor(null) });
  });
  await page.route("**/api/collections/*/cart", (route) => route.fulfill({ json: { url: cartUrl } }));
}

const main = (page: Page) => page.locator("main");

test.beforeEach(async ({ context }) => {
  await context.route("https://vkusvill.ru/**", (route) =>
    route.fulfill({ body: "ok", contentType: "text/html" }),
  );
});

test("S1: загрузка (скелетоны)", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await mockApi(page, { gate });
  await page.goto("/");
  await expect(page.getByText("Загружаем подборки…")).toBeVisible();
  await expect(main(page)).toHaveScreenshot("s1-loading.png");
  release();
});

test("S2: список подборок", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByText("Ужин на двоих")).toBeVisible();
  await expect(main(page)).toHaveScreenshot("s2-list.png");
});

test("S3: пусто по тегу", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByLabel("Тег", { exact: true }).fill("несуществующий");
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page.getByText("По тегу «несуществующий» ничего не найдено")).toBeVisible();
  await expect(main(page)).toHaveScreenshot("s3-empty.png");
});

test("S6: ошибка загрузки", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByText("Ужин на двоих")).toBeVisible();
  await page.unroute("**/api/collections?**");
  await mockApi(page, { failList: true });
  await page.getByLabel("Тег", { exact: true }).fill("ужин");
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page.getByText(/Не удалось загрузить подборки по тегу/)).toBeVisible();
  await expect(main(page)).toHaveScreenshot("s6-error.png");
});

test("Валидация: пустой ввод", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByText("Ужин на двоих")).toBeVisible();
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page.getByText("Введите тег")).toBeVisible();
  await expect(page.getByRole("form", { name: "Поиск по тегу" })).toHaveScreenshot("validation-empty.png");
});

test("S10: корзина готова", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByLabel("Тег", { exact: true }).fill("ужин");
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page.getByText("Показаны подборки по тегу «ужин»", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "В корзину" }).click();
  await expect(page.getByText("Корзина готова")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Ужин на двоих" }).first()).toHaveScreenshot(
    "s10-cart-ready.png",
  );
});

test("Мобильная ширина 320 px: список", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByText("Ужин на двоих")).toBeVisible();
  await expect(main(page)).toHaveScreenshot("mobile-320-list.png");
});
