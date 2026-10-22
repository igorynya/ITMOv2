const state = {
  collections: [],
  favorites: new Set(),
  mode: "all",
};

const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
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

function render() {
  grid.replaceChildren();
  const collections = state.mode === "favorites"
    ? state.collections.filter((col) => state.favorites.has(col.id))
    : state.collections;

  empty.hidden = collections.length > 0;

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

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

async function loadCollections() {
  refresh.disabled = true;
  setStatus("Загружаем подборки…");
  try {
    const data = await api(`/api/collections?t=${Date.now()}`);
    state.collections = data.collections ?? [];
    state.favorites = new Set(data.favorites ?? []);
    updateCount();
    render();
    setStatus(state.mode === "all" ? "Подборки обновлены" : "");
  } catch (error) {
    setStatus(`Не удалось загрузить подборки: ${error.message}`, true);
  } finally {
    refresh.disabled = false;
  }
}

async function loadFavorites() {
  setStatus("Загружаем избранное…");
  try {
    const data = await api("/api/favorites");
    state.collections = data.collections ?? [];
    render();
    setStatus("");
  } catch (error) {
    setStatus(`Не удалось загрузить избранное: ${error.message}`, true);
  }
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
      loadCollections();
    }
  });
});

refresh.addEventListener("click", loadCollections);

loadCollections();
