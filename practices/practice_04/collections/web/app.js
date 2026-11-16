const state = {
  collections: [],
  favorites: new Set(),
  mode: "all",
  tags: [],
  activeTag: "",
  loading: false,
  error: null,
  requestSeq: 0,
  lastRequestTag: "",
  noticeTimer: null,
  focusAll: false,
};

const grid = document.getElementById("grid");
const tagBar = document.getElementById("tag-bar");
const feedback = document.getElementById("feedback");
const feedbackText = document.getElementById("feedback-text");
const feedbackAction = document.getElementById("feedback-action");
const notice = document.getElementById("notice");
const status = document.getElementById("status");
const favCount = document.getElementById("fav-count");
const refresh = document.getElementById("refresh");
const cardTemplate = document.getElementById("card");

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function updateCount() {
  favCount.textContent = String(state.favorites.size);
}

function money(value) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function quantityLabel(item) {
  if (item.unit === "кг") {
    return `${item.quantity} кг`;
  }
  if (item.quantity > 1) {
    return `${item.quantity} шт`;
  }
  return "";
}

function showNotice(message) {
  notice.textContent = message;
  notice.hidden = false;
  if (state.noticeTimer !== null) {
    clearTimeout(state.noticeTimer);
  }
  state.noticeTimer = window.setTimeout(() => {
    notice.hidden = true;
    notice.textContent = "";
    state.noticeTimer = null;
  }, 5000);
}

function showFeedback(message, action, isError = false) {
  feedback.hidden = false;
  feedback.classList.toggle("error", isError);
  feedbackText.textContent = message;
  if (action) {
    feedbackAction.hidden = false;
    feedbackAction.disabled = false;
    feedbackAction.textContent = action.label;
    feedbackAction.onclick = () => {
      if (state.loading) {
        return;
      }
      action.handler();
    };
  } else {
    feedbackAction.hidden = true;
    feedbackAction.textContent = "";
    feedbackAction.onclick = null;
  }
}

function hideFeedback() {
  feedback.hidden = true;
  feedbackAction.hidden = true;
  feedbackAction.textContent = "";
  feedbackAction.onclick = null;
}

function focusActiveChip() {
  if (state.mode !== "all") {
    return;
  }
  const active = tagBar.querySelector('.chip[aria-pressed="true"]');
  const all = tagBar.querySelector('.chip[data-tag=""]');
  (active ?? all)?.focus();
}

function renderTagBar() {
  if (state.mode !== "all") {
    tagBar.hidden = true;
    tagBar.replaceChildren();
    return;
  }

  const focused = document.activeElement;
  const focusedTag = focused && focused.classList && focused.classList.contains("chip")
    ? focused.dataset.tag
    : null;

  tagBar.hidden = false;
  tagBar.replaceChildren();

  const entries = [{ value: "", label: "Все" }];
  for (const tag of state.tags) {
    entries.push({ value: tag, label: tag });
  }

  for (const entry of entries) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.tag = entry.value;
    chip.textContent = entry.label;
    const active = state.activeTag === entry.value;
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-pressed", String(active));
    if (state.loading) {
      chip.setAttribute("aria-disabled", "true");
    }
    chip.addEventListener("click", () => {
      if (state.loading) {
        return;
      }
      selectTag(entry.value);
    });
    chip.addEventListener("focus", () => {
      chip.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    tagBar.append(chip);
  }

  if (state.focusAll) {
    state.focusAll = false;
    tagBar.querySelector('.chip[data-tag=""]')?.focus();
    return;
  }

  if (focusedTag !== null) {
    for (const chip of tagBar.querySelectorAll(".chip")) {
      if (chip.dataset.tag === focusedTag) {
        chip.focus();
        break;
      }
    }
  }
}

function renderCards(collections) {
  for (const col of collections) {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector(".card");

    node.querySelector(".card-title").textContent = col.title;
    node.querySelector(".card-sub").textContent = col.subtitle;

    const tags = node.querySelector(".tags");
    for (const tag of col.tags ?? []) {
      const chip = document.createElement("span");
      chip.className = "tag";
      chip.textContent = tag;
      tags.append(chip);
    }

    const list = node.querySelector(".items");
    for (const item of col.items) {
      const row = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = item.name;
      const qty = quantityLabel(item);
      if (qty) {
        const small = document.createElement("span");
        small.className = "qty";
        small.textContent = ` · ${qty}`;
        name.append(small);
      }
      const price = document.createElement("span");
      price.className = "price";
      price.textContent = money(Math.round(item.price * item.quantity));
      row.append(name, price);
      list.append(row);
    }

    node.querySelector(".total").textContent = money(col.total);
    node.querySelector(".budget").textContent = col.budget > 0
      ? `лимит ${money(col.budget)}`
      : "без лимита";

    const fav = node.querySelector(".fav");
    const isFavorite = state.favorites.has(col.id);
    fav.classList.toggle("active", isFavorite);
    fav.textContent = isFavorite ? "♥" : "♡";
    fav.setAttribute("aria-pressed", String(isFavorite));
    fav.addEventListener("click", () => toggleFavorite(col, fav));

    const cart = node.querySelector(".cart");
    cart.addEventListener("click", () => openCart(col, cart));

    card.dataset.id = col.id;
    grid.append(node);
  }
}

function render() {
  renderTagBar();
  grid.replaceChildren();

  const isAll = state.mode === "all";
  const collections = isAll
    ? state.collections
    : state.collections.filter((col) => state.favorites.has(col.id));

  if (state.loading) {
    grid.setAttribute("aria-busy", "true");
    const indicator = document.createElement("p");
    indicator.className = "loading";
    indicator.textContent = isAll
      ? (state.activeTag
        ? `Загружаем подборки по тегу «${state.activeTag}»…`
        : "Загружаем подборки…")
      : "Загружаем избранное…";
    grid.append(indicator);
    hideFeedback();
    setStatus(indicator.textContent);
    refresh.disabled = true;
    return;
  }

  grid.removeAttribute("aria-busy");
  refresh.disabled = false;

  if (state.error) {
    const action = isAll
      ? (state.error.status === 400
        ? { label: "Сбросить фильтр", handler: resetFilter }
        : { label: "Повторить", handler: retry })
      : null;
    showFeedback(state.error.message, action, true);
    setStatus(state.error.message, true);
    return;
  }

  if (collections.length === 0) {
    if (isAll) {
      if (state.activeTag) {
        const message = `По тегу «${state.activeTag}» ничего не найдено`;
        showFeedback(message, { label: "Сбросить фильтр", handler: resetFilter });
        setStatus(message);
      } else {
        const message = "Подборок пока нет";
        showFeedback(message, {
          label: "Обновить",
          handler: () => loadCollections(""),
        });
        setStatus(message);
      }
    } else {
      showFeedback(
        "Пока пусто. Добавьте подборку в избранное — она останется здесь.",
        null,
      );
      setStatus("");
    }
    return;
  }

  hideFeedback();
  renderCards(collections);
  setStatus(isAll
    ? (state.activeTag
      ? `Показаны подборки по тегу «${state.activeTag}»`
      : "Показаны все подборки")
    : "");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function loadCollections(tag = state.activeTag) {
  const requested = tag ?? "";
  const seq = ++state.requestSeq;
  const requestMode = state.mode;
  const focusWasOnAction = document.activeElement === feedbackAction;

  state.lastRequestTag = requested;
  state.loading = true;
  state.error = null;
  render();

  try {
    const params = new URLSearchParams();
    if (requested) {
      params.set("tag", requested);
    }
    params.set("t", String(Date.now()));
    const data = await api(`/api/collections?${params.toString()}`);

    if (seq !== state.requestSeq || requestMode !== state.mode) {
      return;
    }

    state.collections = data.collections ?? [];
    state.favorites = new Set(data.favorites ?? []);
    updateCount();

    if (requestMode === "all") {
      state.tags = data.tags ?? [];
      state.activeTag = data.active_tag ?? "";
      if (state.activeTag !== "" && !state.tags.includes(state.activeTag)) {
        state.activeTag = "";
        state.loading = false;
        showNotice("Тег больше недоступен, фильтр сброшен");
        loadCollections("");
        return;
      }
    }

    state.loading = false;
    render();
    if (focusWasOnAction) {
      focusActiveChip();
    }
  } catch (error) {
    if (seq !== state.requestSeq || requestMode !== state.mode) {
      return;
    }
    state.loading = false;
    const responseStatus = error.status ?? 0;
    let message;
    if (responseStatus === 400) {
      message = "Не удалось применить фильтр.";
    } else if (requested) {
      message = `Не удалось загрузить подборки по тегу «${requested}». Попробуйте ещё раз.`;
    } else {
      message = "Не удалось загрузить подборки. Попробуйте ещё раз.";
    }
    state.error = { status: responseStatus, tag: requested, message };
    render();
    if (focusWasOnAction) {
      feedbackAction.focus();
    }
  }
}

async function loadFavorites() {
  const seq = ++state.requestSeq;
  state.loading = true;
  state.error = null;
  render();

  try {
    const data = await api("/api/favorites");
    if (seq !== state.requestSeq || state.mode !== "favorites") {
      return;
    }
    state.collections = data.collections ?? [];
    state.favorites = new Set(state.collections.map((col) => col.id));
    updateCount();
    state.loading = false;
    render();
  } catch (error) {
    if (seq !== state.requestSeq || state.mode !== "favorites") {
      return;
    }
    state.loading = false;
    state.error = {
      status: error.status ?? 0,
      tag: "",
      message: "Не удалось загрузить избранное. Попробуйте ещё раз.",
    };
    render();
  }
}

function selectTag(tag) {
  if (state.loading) {
    return;
  }
  if (tag === "" || tag === state.activeTag) {
    state.activeTag = "";
    loadCollections("");
    return;
  }
  state.activeTag = tag;
  loadCollections(tag);
}

function resetFilter() {
  if (state.loading) {
    return;
  }
  state.activeTag = "";
  state.focusAll = true;
  loadCollections("");
}

function retry() {
  if (state.loading) {
    return;
  }
  loadCollections(state.lastRequestTag);
}

async function toggleFavorite(col, button) {
  const isFavorite = state.favorites.has(col.id);
  button.disabled = true;
  try {
    await api(`/api/favorites/${encodeURIComponent(col.id)}`, {
      method: isFavorite ? "DELETE" : "PUT",
    });
    if (isFavorite) {
      state.favorites.delete(col.id);
    } else {
      state.favorites.add(col.id);
    }
    updateCount();
    if (state.mode === "favorites" && isFavorite) {
      render();
    } else {
      button.classList.toggle("active", !isFavorite);
      button.textContent = isFavorite ? "♡" : "♥";
      button.setAttribute("aria-pressed", String(!isFavorite));
    }
    setStatus(isFavorite ? "Убрали из избранного" : "Добавили в избранное");
  } catch (error) {
    setStatus(`Не удалось обновить избранное: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
}

async function openCart(col, button) {
  const tab = window.open("about:blank", "_blank");
  button.disabled = true;
  setStatus("Собираем корзину…");
  try {
    const data = await api(`/api/collections/${encodeURIComponent(col.id)}/cart`, {
      method: "POST",
    });
    if (tab) {
      tab.location.href = data.url;
    } else {
      window.location.href = data.url;
    }
    setStatus("Корзина готова — открыли новую вкладку");
  } catch (error) {
    if (tab) {
      tab.close();
    }
    setStatus(`Не получилось собрать корзину: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
}

document.querySelectorAll(".tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    if (mode === state.mode) {
      return;
    }
    state.mode = mode;
    document.querySelectorAll(".tabs button").forEach((other) => {
      const active = other === button;
      other.classList.toggle("active", active);
      other.setAttribute("aria-selected", String(active));
    });
    if (mode === "favorites") {
      loadFavorites();
    } else {
      loadCollections(state.activeTag);
    }
  });
});

refresh.addEventListener("click", () => {
  if (state.loading) {
    return;
  }
  if (state.mode === "favorites") {
    loadFavorites();
  } else {
    loadCollections(state.activeTag);
  }
});

loadCollections("");
