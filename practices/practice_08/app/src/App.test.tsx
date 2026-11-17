import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";

import App from "./App";
import { cartUrl, collectionsFor } from "./test/fixtures";
import { server } from "./test/server";

/** Считает запросы к API и запоминает их адреса. */
function recordRequests() {
  const urls: string[] = [];
  server.events.on("request:start", ({ request }) => {
    urls.push(`${request.method} ${new URL(request.url).pathname}${new URL(request.url).search}`);
  });
  return urls;
}

async function renderLoaded() {
  const user = userEvent.setup();
  const view = render(<App />);
  await screen.findByText("Показаны все подборки", { exact: false });
  return { user, ...view };
}

const field = () => screen.getByLabelText("Тег");
const findButton = () => screen.getByRole("button", { name: "Найти" });

describe("состояния списка", () => {
  it("S1: показывает загрузку, затем список (S2)", async () => {
    server.use(http.get("/api/collections", async () => {
      await delay(50);
      return HttpResponse.json(collectionsFor(null));
    }));
    render(<App />);
    expect(screen.getByText("Загружаем подборки…")).toBeInTheDocument();
    expect(findButton()).toBeDisabled();
    expect(await screen.findByText("Ужин на двоих")).toBeInTheDocument();
    expect(screen.getByText(/Показаны все подборки/)).toBeInTheDocument();
    expect(screen.getByText(/3 подборки/)).toBeInTheDocument();
    expect(findButton()).toBeEnabled();
  });

  it("S4: пустой ответ без фильтра", async () => {
    server.use(http.get("/api/collections", () => HttpResponse.json({ collections: [], favorites: [], tags: [], active_tag: "" })));
    render(<App />);
    expect(await screen.findByText("Подборок пока нет")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Обновить" })).toBeInTheDocument();
  });

  it("S3: 200 с пустым списком — не ошибка, есть «Сбросить фильтр»", async () => {
    const { user } = await renderLoaded();
    await user.type(field(), "несуществующий");
    await user.click(findButton());
    expect(await screen.findByText("По тегу «несуществующий» ничего не найдено")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Сбросить фильтр" }));
    expect(await screen.findByText("Ужин на двоих")).toBeInTheDocument();
  });

  it("S6: при 500 текст остаётся, «Повторить» отправляет тот же тег", async () => {
    const { user } = await renderLoaded();
    server.use(http.get("/api/collections", () => HttpResponse.json({ error: "cannot load collections" }, { status: 500 }), { once: true }));
    await user.type(field(), "ужин");
    await user.click(findButton());
    expect(await screen.findByText("Не удалось загрузить подборки по тегу «ужин». Попробуйте ещё раз.")).toBeInTheDocument();
    expect(field()).toHaveValue("ужин");
    await user.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText(/Показаны подборки по тегу «ужин»/)).toBeInTheDocument();
  });

  it("S7: при 400 текст остаётся, «Сбросить фильтр» очищает поле и возвращает фокус", async () => {
    const { user } = await renderLoaded();
    server.use(http.get("/api/collections", ({ request }) =>
      new URL(request.url).searchParams.has("tag")
        ? HttpResponse.json({ error: "tag is too long" }, { status: 400 })
        : HttpResponse.json(collectionsFor(null)),
    ));
    await user.type(field(), "ужин");
    await user.click(findButton());
    expect(await screen.findByText("Не удалось применить фильтр.")).toBeInTheDocument();
    expect(field()).toHaveValue("ужин");
    await user.click(screen.getByRole("button", { name: "Сбросить фильтр" }));
    expect(await screen.findByText("Ужин на двоих")).toBeInTheDocument();
    expect(field()).toHaveValue("");
    expect(field()).toHaveFocus();
  });
});

describe("форма поиска", () => {
  it("правило 1: пустой ввод не отправляется, есть сообщение, aria-invalid и фокус", async () => {
    const { user } = await renderLoaded();
    const urls = recordRequests();
    await user.type(field(), "   ");
    await user.click(findButton());
    expect(screen.getByText("Введите тег")).toBeInTheDocument();
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveAccessibleDescription("Введите тег");
    expect(field()).toHaveFocus();
    expect(urls).toHaveLength(0);
  });

  it("правило 2: 65 символов не отправляются", async () => {
    const { user } = await renderLoaded();
    const urls = recordRequests();
    await user.click(field());
    await user.paste("я".repeat(65));
    await user.click(findButton());
    expect(screen.getByText("Тег не длиннее 64 символов")).toBeInTheDocument();
    expect(urls).toHaveLength(0);
  });

  it("правила 3 и 5: отправка по Enter, тег обрезается, в поле канонический active_tag", async () => {
    const { user } = await renderLoaded();
    const urls = recordRequests();
    await user.type(field(), "  Ужин {Enter}");
    expect(await screen.findByText(/Показаны подборки по тегу «ужин»/)).toBeInTheDocument();
    expect(urls).toEqual(["GET /api/collections?tag=%D0%A3%D0%B6%D0%B8%D0%BD"]);
    expect(field()).toHaveValue("ужин");
    expect(screen.queryByText("Быстрый завтрак")).not.toBeInTheDocument();
  });

  it("правило 4: двойной клик и Enter во время ожидания дают один запрос", async () => {
    const { user } = await renderLoaded();
    server.use(http.get("/api/collections", async ({ request }) => {
      await delay(100);
      return HttpResponse.json(collectionsFor(new URL(request.url).searchParams.get("tag")));
    }));
    const urls = recordRequests();
    await user.type(field(), "ужин");
    await user.dblClick(findButton());
    await user.keyboard("{Enter}{Enter}");
    expect(findButton()).toBeDisabled();
    await screen.findByText(/Показаны подборки по тегу «ужин»/);
    expect(urls).toHaveLength(1);
    expect(findButton()).toBeEnabled();
  });

  it("правило 4: два submit в один тик (до перерисовки) дают один запрос", async () => {
    const { user } = await renderLoaded();
    const urls = recordRequests();
    await user.type(field(), "ужин");
    const form = screen.getByRole("form", { name: "Поиск по тегу" });
    // Кнопка ещё не успела стать disabled: защищает только замок в TagSearchForm.
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    await screen.findByText(/Показаны подборки по тегу «ужин»/);
    expect(urls).toHaveLength(1);
  });

  it("правило 9: «Сбросить» очищает поле, ошибки и возвращает фокус", async () => {
    const { user } = await renderLoaded();
    await user.type(field(), "   ");
    await user.click(findButton());
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    expect(field()).toHaveValue("");
    expect(screen.queryByText("Введите тег")).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
  });

  it("правило 10: чип вписывает тег и отправляет форму, повторное нажатие снимает фильтр", async () => {
    const { user } = await renderLoaded();
    const chips = within(screen.getByRole("list", { name: "Популярные теги" }));
    await user.click(chips.getByRole("button", { name: "завтрак" }));
    expect(await screen.findByText(/Показаны подборки по тегу «завтрак»/)).toBeInTheDocument();
    expect(field()).toHaveValue("завтрак");
    expect(chips.getByRole("button", { name: "завтрак" })).toHaveAttribute("aria-pressed", "true");
    await user.click(chips.getByRole("button", { name: "завтрак" }));
    expect(await screen.findByText(/Показаны все подборки/)).toBeInTheDocument();
    expect(field()).toHaveValue("");
  });

  it("правило 11: поздний ответ на устаревший запрос игнорируется", async () => {
    const { user } = await renderLoaded();
    server.use(http.get("/api/collections", async ({ request }) => {
      const tag = new URL(request.url).searchParams.get("tag");
      if (tag === "медленно") await delay(200);
      return HttpResponse.json(collectionsFor(tag === "медленно" ? "ужин" : tag));
    }));
    await user.type(field(), "медленно");
    await user.click(findButton());
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    await screen.findByText(/Показаны все подборки/);
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(screen.getByText(/Показаны все подборки/)).toBeInTheDocument();
    expect(screen.getByText("Быстрый завтрак")).toBeInTheDocument();
    expect(field()).toHaveValue("");
  });
});

describe("избранное", () => {
  it("правило 12: сердце переключает aria-pressed и недоступно на время запроса", async () => {
    const { user } = await renderLoaded();
    server.use(http.put("/api/favorites/:id", async ({ params }) => {
      await delay(80);
      return HttpResponse.json({ favorite: true, id: params.id });
    }));
    const heart = screen.getByRole("button", { name: "В избранное: Ужин на двоих" });
    expect(heart).toHaveAttribute("aria-pressed", "false");
    await user.click(heart);
    expect(heart).toBeDisabled();
    await waitFor(() => expect(heart).toHaveAttribute("aria-pressed", "true"));
    expect(heart).toBeEnabled();
  });

  it("правило 12: при ошибке состояние не меняется, показано сообщение", async () => {
    const { user } = await renderLoaded();
    server.use(http.put("/api/favorites/:id", () => HttpResponse.json({ error: "collection not found" }, { status: 404 })));
    const heart = screen.getByRole("button", { name: "В избранное: Ужин на двоих" });
    await user.click(heart);
    expect(await screen.findByText("Не удалось изменить избранное. Попробуйте ещё раз.")).toBeInTheDocument();
    expect(heart).toHaveAttribute("aria-pressed", "false");
  });

  it("правило 13: вкладка «Избранное» показывает список, удаление убирает карточку и ведёт к S5", async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole("tab", { name: "Избранное" }));
    expect(await screen.findByText("Обед с друзьями")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "В избранное: Обед с друзьями" }));
    expect(await screen.findByText("Пока пусто. Добавьте подборку в избранное — она останется здесь.")).toBeInTheDocument();
    expect(screen.queryByText("Обед с друзьями")).not.toBeInTheDocument();
  });

  it("S5: пустое избранное", async () => {
    const { user } = await renderLoaded();
    server.use(http.get("/api/favorites", () => HttpResponse.json({ collections: [] })));
    await user.click(screen.getByRole("tab", { name: "Избранное" }));
    expect(await screen.findByText("Пока пусто. Добавьте подборку в избранное — она останется здесь.")).toBeInTheDocument();
  });
});

describe("корзина", () => {
  it("правило 14, S8 и S10: один запрос при двойном клике, ссылка и статус «Корзина готова»", async () => {
    const { user } = await renderLoaded();
    server.use(http.post("/api/collections/:id/cart", async () => {
      await delay(80);
      return HttpResponse.json({ url: cartUrl });
    }));
    const urls = recordRequests();
    const card = within(screen.getByText("Ужин на двоих").closest("li") as HTMLElement);
    await user.dblClick(card.getByRole("button", { name: "В корзину" }));
    const busy = card.getByRole("button", { name: "Собираем корзину…" });
    expect(busy).toBeDisabled();
    const link = await card.findByRole("link", { name: "Открыть корзину во ВкусВилле" });
    expect(link).toHaveAttribute("href", cartUrl);
    expect(card.getByText("Корзина готова")).toBeInTheDocument();
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith(cartUrl, "_blank", "noopener,noreferrer");
    expect(urls.filter((u) => u.startsWith("POST"))).toHaveLength(1);
  });

  it("S9: ошибка корзины — сообщение у карточки, кнопка снова доступна", async () => {
    const { user } = await renderLoaded();
    server.use(http.post("/api/collections/:id/cart", () => HttpResponse.json({ error: "cannot create cart link" }, { status: 502 })));
    const card = within(screen.getByText("Ужин на двоих").closest("li") as HTMLElement);
    await user.click(card.getByRole("button", { name: "В корзину" }));
    expect(await card.findByText("Не удалось собрать корзину. Попробуйте ещё раз.")).toBeInTheDocument();
    expect(card.getByRole("button", { name: "В корзину" })).toBeEnabled();
    expect(window.open).not.toHaveBeenCalled();
  });
});

describe("основной сценарий и доступность", () => {
  it("тег → карточки → «В корзину» → ссылка открыта", async () => {
    const { user } = await renderLoaded();
    await user.type(field(), "ужин");
    await user.click(findButton());
    await screen.findByText(/Показаны подборки по тегу «ужин»/);
    expect(screen.getAllByRole("button", { name: "В корзину" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "В корзину" }));
    await screen.findByText("Корзина готова");
    expect(window.open).toHaveBeenCalledWith(cartUrl, "_blank", "noopener,noreferrer");
  });

  it("правила 15 и 17: нет нарушений axe в состоянии списка и ошибки формы", async () => {
    const { user, container } = await renderLoaded();
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    await user.click(findButton());
    expect(screen.getByText("Введите тег")).toBeInTheDocument();
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it("правило 16: сценарий выполняется с клавиатуры", async () => {
    const { user } = await renderLoaded();
    field().focus();
    await user.keyboard("завтрак{Enter}");
    await screen.findByText(/Показаны подборки по тегу «завтрак»/);
    const cart = screen.getByRole("button", { name: "В корзину" });
    cart.focus();
    await user.keyboard("{Enter}");
    await screen.findByText("Корзина готова");
    expect(vi.mocked(window.open)).toHaveBeenCalledOnce();
  });
});
