const { chromium } = (() => {
  try {
    return require("playwright-core");
  } catch (_) {
    return require("playwright");
  }
})();
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:18081";
const OUT = process.env.OUT_DIR || path.join(__dirname);
const SHOTS = path.join(OUT, "screenshots");
const results = [];

function check(scenario, name, ok, detail) {
  results.push({ scenario, check: name, pass: Boolean(ok), detail: String(detail) });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${scenario} / ${name}: ${detail}`);
}

async function scenario(name, fn) {
  let ctx;
  try {
    ctx = await fn();
  } catch (error) {
    check(name, "сценарий завершился без исключения", false, error.message);
  } finally {
    if (ctx?.context) {
      await ctx.context.close();
    }
  }
}

async function openPage(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector(".chip");
  await page.waitForFunction(() => document.querySelectorAll(".card").length > 0);
  return { context, page, pageErrors };
}

async function idle(page) {
  await page.waitForFunction(() => document.querySelector("#grid").getAttribute("aria-busy") !== "true");
}

async function activeTag(page) {
  return page.locator('.chip[aria-pressed="true"]').first().getAttribute("data-tag");
}

async function chipCount(page) {
  return page.locator(".chip").count();
}

async function cardTags(page) {
  return page.$$eval(".card", (cards) =>
    cards.map((card) => Array.from(card.querySelectorAll(".tag")).map((tag) => tag.textContent)),
  );
}

async function cardCount(page) {
  return page.locator(".card").count();
}

async function feedbackText(page) {
  return (await page.locator("#feedback-text").textContent()) || "";
}

async function feedbackAction(page) {
  const action = page.locator("#feedback-action");
  if (await action.isHidden()) return "";
  return (await action.textContent()) || "";
}

async function waitTaggedSuccess(page, tag) {
  await idle(page);
  await page.waitForFunction(
    (value) => (document.querySelector("#status").textContent || "").includes(`по тегу «${value}»`),
    tag,
  );
}

async function fulfillCollections(route, body) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const base = await (await fetch(`${BASE}/api/collections`)).json();
  const known = base.tags.includes("ужин") ? "ужин" : base.tags[0];
  const other = base.tags.find((tag) => tag !== known) || "";

  const browser = await chromium.launch({ channel: "chrome", headless: true });

  await scenario("4.1 основной сценарий", async () => {
    const ctx = await openPage(browser);
    const { page } = ctx;
    const initialTags = await chipCount(page);
    check("4.1 основной сценарий", "строка чипов видна, «Все» первый", await page.locator("#tag-bar").isVisible() && (await page.locator(".chip").first().textContent()) === "Все", "tag-bar visible");
    check("4.1 основной сценарий", "изначально активен только «Все»", (await page.locator('.chip[aria-pressed="true"]').count()) === 1 && (await activeTag(page)) === "", `active=${await activeTag(page)}`);

    await page.route("**/api/collections*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/collections" && url.searchParams.get("tag")) {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
      await route.continue();
    });

    await page.locator(`.chip[data-tag="${known}"]`).click();
    await page.waitForFunction(() => document.querySelector("#grid").getAttribute("aria-busy") === "true");
    const disabled = await page.$$eval(".chip", (chips) => chips.every((chip) => chip.getAttribute("aria-disabled") === "true"));
    check("4.1 основной сценарий", "во время загрузки чипы недоступны", disabled && (await page.locator("#refresh").isDisabled()), "aria-disabled на всех чипах, refresh disabled");
    check("4.1 основной сценарий", "во время загрузки в статусе назван тег", ((await page.locator("#status").textContent()) || "").includes(known), await page.locator("#status").textContent());

    await waitTaggedSuccess(page, known);
    const tags = await cardTags(page);
    const count = await cardCount(page);
    check("4.1 основной сценарий", "после успеха только подборки с тегом", tags.length > 0 && tags.every((item) => item.includes(known)), `${count} карточек, все с «${known}»`);
    check("4.1 основной сценарий", "активен ровно один чип", (await page.locator('.chip[aria-pressed="true"]').count()) === 1 && (await activeTag(page)) === known, `active=${await activeTag(page)}`);
    check("4.1 основной сценарий", "карточек не больше 12", count <= 12, `${count} карточек`);
    check("4.1 основной сценарий", "список тегов не сужен фильтром", (await chipCount(page)) === initialTags, `${initialTags} -> ${await chipCount(page)}`);

    const taggedRequests = [];
    const onRequest = (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/collections" && url.searchParams.get("tag") === known) taggedRequests.push(url.toString());
    };
    page.on("request", onRequest);
    await page.locator("#refresh").click();
    await idle(page);
    check("4.1 основной сценарий", "«Ещё подборки» сохраняет фильтр", (await activeTag(page)) === known && taggedRequests.length >= 1, `active=${await activeTag(page)}, tagged requests=${taggedRequests.length}`);
    page.off("request", onRequest);

    await page.locator(`.chip[data-tag="${known}"]`).click();
    await idle(page);
    check("4.1 основной сценарий", "повторный клик по активному чипу сбрасывает фильтр", (await activeTag(page)) === "", `active=${await activeTag(page)}`);

    await page.locator(`.chip[data-tag="${known}"]`).click();
    await waitTaggedSuccess(page, known);
    await page.locator('.chip[data-tag=""]').click();
    await idle(page);
    check("4.1 основной сценарий", "кнопка «Все» сбрасывает фильтр", (await activeTag(page)) === "", `active=${await activeTag(page)}`);

    await page.screenshot({ path: path.join(SHOTS, "4.1-filter.png"), fullPage: true });
    check("4.1 основной сценарий", "нет ошибок страницы", ctx.pageErrors.length === 0, ctx.pageErrors.join("; ") || "none");
    return ctx;
  });

  await scenario("4.2 пустота", async () => {
    const ctx = await openPage(browser);
    const { page } = ctx;
    let intercepted = 0;
    await page.route("**/api/collections*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/collections" && url.searchParams.get("tag") === known && intercepted === 0) {
        intercepted++;
        await fulfillCollections(route, { collections: [], tags: base.tags, favorites: [], active_tag: known });
        return;
      }
      await route.continue();
    });

    await page.locator(`.chip[data-tag="${known}"]`).click();
    await idle(page);
    const text = await feedbackText(page);
    const action = await feedbackAction(page);
    check("4.2 пустота", "пустое состояние с названием тега", text.includes(known) && text.includes("ничего не найдено"), text);
    check("4.2 пустота", "есть кнопка «Сбросить фильтр»", action === "Сбросить фильтр", action);
    await page.screenshot({ path: path.join(SHOTS, "4.2-empty.png"), fullPage: true });

    await page.locator("#feedback-action").click();
    await idle(page);
    const focused = await page.evaluate(() => document.activeElement?.dataset?.tag ?? null);
    check("4.2 пустота", "сброс возвращает «Все» и фокус на «Все»", (await activeTag(page)) === "" && focused === "", `active=${await activeTag(page)}, focus=${focused}`);
    check("4.2 пустота", "после сброса показаны подборки", (await cardCount(page)) > 0, `${await cardCount(page)} карточек`);
    check("4.2 пустота", "нет ошибок страницы", ctx.pageErrors.length === 0, ctx.pageErrors.join("; ") || "none");
    return ctx;
  });

  await scenario("4.3 ошибка и повтор", async () => {
    const ctx = await openPage(browser);
    const { page } = ctx;
    const tagPattern = (route) => {
      const url = new URL(route.request().url());
      return url.pathname === "/api/collections" && url.searchParams.get("tag") === known;
    };

    let mode = "network";
    await page.route("**/api/collections*", async (route) => {
      if (!tagPattern(route)) {
        await route.continue();
        return;
      }
      if (mode === "network") {
        mode = "pass";
        await route.abort("failed");
        return;
      }
      if (mode === "400") {
        mode = "pass";
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "tag is too long" }) });
        return;
      }
      await route.continue();
    });

    await page.locator(`.chip[data-tag="${known}"]`).click();
    await idle(page);
    const errorText = await feedbackText(page);
    const errorAction = await feedbackAction(page);
    check("4.3 ошибка и повтор", "сетевая ошибка: сообщение с тегом и «Повторить»", errorText.includes(known) && errorAction === "Повторить", `${errorText} / ${errorAction}`);
    const disabledAfterError = await page.$$eval(".chip", (chips) => chips.some((chip) => chip.getAttribute("aria-disabled") === "true"));
    check("4.3 ошибка и повтор", "после ошибки чипы снова доступны", !disabledAfterError, `aria-disabled=${disabledAfterError}`);
    check("4.3 ошибка и повтор", "выбранный чип остаётся активным", (await activeTag(page)) === known, `active=${await activeTag(page)}`);
    await page.screenshot({ path: path.join(SHOTS, "4.3-network-error.png"), fullPage: true });

    mode = "pass";
    await page.locator("#feedback-action").click();
    await waitTaggedSuccess(page, known);
    check("4.3 ошибка и повтор", "«Повторить» возвращает успех", (await activeTag(page)) === known && (await cardCount(page)) > 0, `active=${await activeTag(page)}`);

    await page.locator('.chip[data-tag=""]').click();
    await idle(page);
    mode = "400";
    await page.locator(`.chip[data-tag="${known}"]`).click();
    await idle(page);
    const badText = await feedbackText(page);
    const badAction = await feedbackAction(page);
    check("4.3 ошибка и повтор", "400: текст без кода и поля, действие «Сбросить фильтр»", badText === "Не удалось применить фильтр." && badAction === "Сбросить фильтр" && !/400|error/i.test(badText), `${badText} / ${badAction}`);
    await page.screenshot({ path: path.join(SHOTS, "4.3-400.png"), fullPage: true });

    await page.locator("#feedback-action").click();
    await idle(page);
    check("4.3 ошибка и повтор", "после 400 сброс загружает все подборки", (await activeTag(page)) === "" && (await cardCount(page)) > 0, `active=${await activeTag(page)}`);
    check("4.3 ошибка и повтор", "нет ошибок страницы", ctx.pageErrors.length === 0, ctx.pageErrors.join("; ") || "none");
    return ctx;
  });

  await scenario("4.4 избранное", async () => {
    const ctx = await openPage(browser);
    const { page } = ctx;
    await page.locator(`.chip[data-tag="${known}"]`).click();
    await waitTaggedSuccess(page, known);

    await page.locator(".card .fav").first().click();
    await page.waitForFunction(() => document.querySelector("#fav-count").textContent === "1");
    check("4.4 избранное", "добавление в избранное под фильтром не сбрасывает фильтр", (await activeTag(page)) === known, `active=${await activeTag(page)}`);

    await page.locator('.tabs button[data-mode="favorites"]').click();
    await page.waitForFunction(() => document.querySelector("#tag-bar").hidden === true);
    await idle(page);
    const favCount = await cardCount(page);
    check("4.4 избранное", "на «Избранном» чипы скрыты, показаны все избранные", favCount === 1 && (await page.locator("#tag-bar").isHidden()), `${favCount} карточек`);
    check("4.4 избранное", "счётчик избранного не изменился", (await page.locator("#fav-count").textContent()) === "1", await page.locator("#fav-count").textContent());
    await page.screenshot({ path: path.join(SHOTS, "4.4-favorites.png"), fullPage: true });

    await page.locator('.tabs button[data-mode="all"]').click();
    await waitTaggedSuccess(page, known);
    check("4.4 избранное", "при возврате тег восстановлен", (await activeTag(page)) === known, `active=${await activeTag(page)}`);

    await page.locator('.tabs button[data-mode="favorites"]').click();
    await idle(page);
    await page.locator("#refresh").click();
    await idle(page);
    await page.locator('.tabs button[data-mode="all"]').click();
    await waitTaggedSuccess(page, known);
    check("4.4 избранное", "после «Ещё подборки» на избранном тег сохранён", (await activeTag(page)) === known, `active=${await activeTag(page)}`);
    check("4.4 избранное", "нет ошибок страницы", ctx.pageErrors.length === 0, ctx.pageErrors.join("; ") || "none");
    return ctx;
  });

  await scenario("4.5 клавиатура", async () => {
    const ctx = await openPage(browser);
    const { page } = ctx;
    const order = await page.$$eval(".chip", (chips) => chips.map((chip) => chip.dataset.tag));
    await page.locator('.chip[data-tag=""]').focus();
    const tabbed = [];
    for (let i = 1; i < order.length; i++) {
      await page.keyboard.press("Tab");
      tabbed.push(await page.evaluate(() => document.activeElement?.dataset?.tag ?? null));
    }
    check("4.5 клавиатура", "Tab идёт по чипам в визуальном порядке", JSON.stringify(tabbed) === JSON.stringify(order.slice(1)), tabbed.join(" -> "));
    await page.keyboard.press("Shift+Tab");
    const back = await page.evaluate(() => document.activeElement?.dataset?.tag ?? null);
    check("4.5 клавиатура", "Shift+Tab возвращает назад", back === order[order.length - 2], `focus=${back}`);

    const pressed = await page.$$eval(".chip", (chips) => chips.map((chip) => chip.getAttribute("aria-pressed")));
    check("4.5 клавиатура", "у всех чипов aria-pressed true/false", pressed.every((value) => value === "true" || value === "false"), pressed.join(","));

    await page.locator(`.chip[data-tag="${known}"]`).focus();
    const outline = await page.locator(`.chip[data-tag="${known}"]`).evaluate((chip) => {
      const style = getComputedStyle(chip);
      return `${style.outlineStyle} ${style.outlineWidth}`;
    });
    check("4.5 клавиатура", "у чипа видимая рамка фокуса", outline.includes("solid") && !outline.includes("0px"), outline);

    await page.keyboard.press("Enter");
    await waitTaggedSuccess(page, known);
    check("4.5 клавиатура", "Enter активирует чип", (await activeTag(page)) === known, `active=${await activeTag(page)}`);

    await page.locator('.chip[data-tag=""]').focus();
    await page.keyboard.press("Space");
    await idle(page);
    check("4.5 клавиатура", "Space активирует чип", (await activeTag(page)) === "", `active=${await activeTag(page)}`);

    let requests = 0;
    await page.route("**/api/collections*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/collections" && url.searchParams.get("tag")) {
        requests++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await route.continue();
    });
    await page.locator(`.chip[data-tag="${known}"]`).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#grid").getAttribute("aria-busy") === "true");
    const during = await page.$$eval(".chip", (chips) => chips.map((chip) => ({ disabled: chip.getAttribute("aria-disabled"), tabIndex: chip.tabIndex })));
    check("4.5 клавиатура", "во время загрузки чипы недоступны и остаются в Tab-порядке", during.every((chip) => chip.disabled === "true" && chip.tabIndex === 0), JSON.stringify(during));
    await page.locator(`.chip[data-tag="${other}"]`).click({ force: true });
    check("4.5 клавиатура", "повторное нажатие во время загрузки не запускает запрос", requests === 1, `requests=${requests}`);
    await idle(page);
    await page.screenshot({ path: path.join(SHOTS, "4.5-keyboard.png"), fullPage: true });
    check("4.5 клавиатура", "нет ошибок страницы", ctx.pageErrors.length === 0, ctx.pageErrors.join("; ") || "none");
    return ctx;
  });

  await scenario("4.6 мобильная ширина", async () => {
    const ctx = await openPage(browser, { viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true });
    const { page } = ctx;
    const metrics = await page.evaluate(() => {
      const bar = document.querySelector("#tag-bar");
      return {
        scrollWidth: bar.scrollWidth,
        clientWidth: bar.clientWidth,
        flexWrap: getComputedStyle(bar).flexWrap,
        docScrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    });
    check("4.6 мобильная ширина", "строка чипов в одну строку с прокруткой", metrics.flexWrap === "nowrap" && metrics.scrollWidth > metrics.clientWidth, JSON.stringify(metrics));
    check("4.6 мобильная ширина", "страница без горизонтальной прокрутки", metrics.docScrollWidth <= metrics.innerWidth, `doc=${metrics.docScrollWidth}, viewport=${metrics.innerWidth}`);

    const first = await page.locator(".chip").first().textContent();
    check("4.6 мобильная ширина", "«Все» остаётся первым", first === "Все", first);

    await page.locator(".chip").last().scrollIntoViewIfNeeded();
    const scrolled = await page.evaluate(() => document.querySelector("#tag-bar").scrollLeft);
    check("4.6 мобильная ширина", "последний чип достижим прокруткой", scrolled > 0, `scrollLeft=${scrolled}`);

    await page.evaluate(() => { document.querySelector("#tag-bar").scrollLeft = 0; });
    await page.locator(".chip").last().focus();
    const focusedScroll = await page.evaluate(() => document.querySelector("#tag-bar").scrollLeft);
    check("4.6 мобильная ширина", "фокус прокручивает строку к чипу", focusedScroll > 0, `scrollLeft=${focusedScroll}`);

    const before = await activeTag(page);
    const box = await page.locator("#tag-bar").boundingBox();
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    const after = await activeTag(page);
    check("4.6 мобильная ширина", "свайп по строке не меняет фильтр", before === after, `${before} -> ${after}`);
    await page.screenshot({ path: path.join(SHOTS, "4.6-mobile.png"), fullPage: true });
    check("4.6 мобильная ширина", "нет ошибок страницы", ctx.pageErrors.length === 0, ctx.pageErrors.join("; ") || "none");
    return ctx;
  });

  await scenario("4.7 карточки, избранное и корзина", async () => {
    const ctx = await openPage(browser);
    const { page } = ctx;
    await ctx.context.route("https://vkusvill.ru/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>cart</title>ok" }));
    await page.locator(`.chip[data-tag="${known}"]`).click();
    await waitTaggedSuccess(page, known);

    await page.locator(".card .fav").first().click();
    await page.waitForFunction(() => document.querySelector("#fav-count").textContent === "1");
    check("4.7 карточки, избранное и корзина", "избранное обновилось, фильтр не сброшен", (await activeTag(page)) === known && (await page.locator("#fav-count").textContent()) === "1", `active=${await activeTag(page)}, count=1`);

    const popupPromise = page.waitForEvent("popup");
    await page.locator(".card .cart").first().click();
    const popup = await popupPromise;
    await popup.waitForURL(/vkusvill\.ru/, { timeout: 10000 }).catch(() => {});
    const cartUrl = popup.url();
    check("4.7 карточки, избранное и корзина", "корзина открывается по прежней ссылке", cartUrl.includes("vkusvill.ru/mobile") && cartUrl.includes("basket"), cartUrl);
    await popup.close();
    check("4.7 карточки, избранное и корзина", "фильтр не сломан после корзины", (await activeTag(page)) === known, `active=${await activeTag(page)}`);

    await page.locator('.tabs button[data-mode="favorites"]').click();
    await idle(page);
    await page.locator('.tabs button[data-mode="all"]').click();
    await waitTaggedSuccess(page, known);
    check("4.7 карточки, избранное и корзина", "после возврата фильтр восстановлен, избранное не потеряно", (await activeTag(page)) === known && (await page.locator("#fav-count").textContent()) === "1", `active=${await activeTag(page)}, count=${await page.locator("#fav-count").textContent()}`);
    await page.screenshot({ path: path.join(SHOTS, "4.7-cart.png"), fullPage: true });
    check("4.7 карточки, избранное и корзина", "нет ошибок страницы", ctx.pageErrors.length === 0, ctx.pageErrors.join("; ") || "none");
    return ctx;
  });

  await scenario("4.8 пустой список тегов", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    let intercepted = false;
    await page.route("**/api/collections*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/collections" && !url.searchParams.get("tag") && !intercepted) {
        intercepted = true;
        await fulfillCollections(route, { collections: base.collections, tags: [], favorites: [], active_tag: "" });
        return;
      }
      await route.continue();
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForSelector(".chip");
    await page.waitForFunction(() => document.querySelectorAll(".card").length > 0);

    check("4.8 пустой список тегов", "в строке остаётся только «Все»", (await chipCount(page)) === 1 && (await page.locator(".chip").first().textContent()) === "Все", `${await chipCount(page)} чипов`);
    check("4.8 пустой список тегов", "фильтр не применяется, подборки показаны", (await activeTag(page)) === "" && (await cardCount(page)) > 0, `active=${await activeTag(page)}, cards=${await cardCount(page)}`);
    await page.screenshot({ path: path.join(SHOTS, "4.8-empty-tags.png"), fullPage: true });
    check("4.8 пустой список тегов", "нет ошибок страницы", pageErrors.length === 0, pageErrors.join("; ") || "none");
    await context.close();
    return { context, page, pageErrors };
  });

  await scenario("4.9 автосброс устаревшего тега", async () => {
    const ctx = await openPage(browser);
    const { page } = ctx;
    await page.locator(`.chip[data-tag="${known}"]`).click();
    await waitTaggedSuccess(page, known);

    const staleTags = base.tags.filter((tag) => tag !== known);
    let intercepted = false;
    await page.route("**/api/collections*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/collections" && url.searchParams.get("tag") === known && !intercepted) {
        intercepted = true;
        await fulfillCollections(route, { collections: [], tags: staleTags, favorites: [], active_tag: known });
        return;
      }
      await route.continue();
    });

    await page.locator("#refresh").click();
    await page.waitForFunction(() => document.querySelector("#notice").hidden === false);
    const notice = (await page.locator("#notice").textContent()) || "";
    check("4.9 автосброс устаревшего тега", "показано уведомление об автосбросе", notice === "Тег больше недоступен, фильтр сброшен", notice);
    await idle(page);
    check("4.9 автосброс устаревшего тега", "фильтр сброшен на «Все»", (await activeTag(page)) === "" && (await cardCount(page)) > 0, `active=${await activeTag(page)}, cards=${await cardCount(page)}`);
    check("4.9 автосброс устаревшего тега", "пустота с именем исчезнувшего тега не показана", !(await feedbackText(page)).includes("ничего не найдено"), await feedbackText(page));
    await page.screenshot({ path: path.join(SHOTS, "4.9-notice.png"), fullPage: true });
    await page.waitForTimeout(5200);
    check("4.9 автосброс устаревшего тега", "уведомление скрывается примерно через 5 секунд", await page.locator("#notice").isHidden(), "notice hidden");
    check("4.9 автосброс устаревшего тега", "нет ошибок страницы", ctx.pageErrors.length === 0, ctx.pageErrors.join("; ") || "none");
    return ctx;
  });

  await browser.close();

  const summary = {
    generated_at: new Date().toISOString(),
    base: BASE,
    known_tag: known,
    checks: results,
    passed: results.filter((item) => item.pass).length,
    failed: results.filter((item) => !item.pass).length,
  };
  fs.writeFileSync(path.join(OUT, "ui-checks.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(`\n${summary.passed} passed, ${summary.failed} failed`);
  process.exit(summary.failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
