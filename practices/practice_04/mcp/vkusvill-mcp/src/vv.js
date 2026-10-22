const SEARCH_LIMIT = 10;
const HTML_ENTITIES = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

function cleanText(value) {
  if (typeof value !== "string") return value;
  return value.replace(/&(nbsp|amp|quot|#39|lt|gt);/g, (match) => HTML_ENTITIES[match] ?? match);
}

export function compactProduct(item) {
  const average = item?.rating?.average ?? null;
  return {
    id: item.id,
    name: cleanText(item.name),
    price: item?.price?.current ?? null,
    currency: item?.price?.currency ?? "RUB",
    unit: item?.unit ?? null,
    rating: average === null ? null : Math.round(average * 10) / 10,
    url: item?.url ?? null,
  };
}

export async function searchProducts(remote, { query, limit = 5, minRating, sort = "popularity" }) {
  const data = await remote.callTool("vkusvill_products_search", {
    q: query,
    limit: Math.min(Math.max(limit, 1), SEARCH_LIMIT),
    sort,
    mode: "short",
  });

  const payload = data?.data ?? data;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const filtered =
    minRating === undefined
      ? items
      : items.filter((item) => (item?.rating?.average ?? 0) >= minRating);

  return {
    query,
    total: payload?.meta?.total ?? items.length,
    items: filtered.map(compactProduct),
  };
}

export async function productDetails(remote, id) {
  const data = await remote.callTool("vkusvill_product_details", { id });
  const product = data?.data?.product ?? data?.data?.items?.[0] ?? data?.data ?? data;
  if (!product || typeof product !== "object") {
    throw new Error(`product_details: unexpected response for id ${id}`);
  }
  return product;
}

export async function createCartLink(remote, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("createCartLink: items must not be empty");
  }
  const products = items.map(({ id, quantity }) => {
    if (!Number.isInteger(id) || id <= 0) throw new Error(`invalid product id: ${id}`);
    const q = Number(quantity ?? 1);
    if (!Number.isFinite(q) || q < 0.01 || q > 40) {
      throw new Error(`invalid quantity for product ${id}: ${quantity}`);
    }
    return { id, q };
  });
  const data = await remote.callTool("vkusvill_cart_link_create", { products });
  const link = data?.data?.link ?? data?.link;
  if (!link) throw new Error("cart_link_create: no link in response");
  return link;
}

function pickBest(items) {
  const singles = items.filter((item) => item.unit !== "кг");
  const pool = singles.length > 0 ? singles : items;
  const best = pool[0];
  if (!best) return null;
  return { best, alternatives: pool.slice(1, 4) };
}

export async function buildCart(remote, requests, { minRating = 4.5 } = {}) {
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error("buildCart: requests must not be empty");
  }

  const selection = [];
  const missing = [];

  for (const request of requests) {
    const query = request.query;
    if (!query) throw new Error("buildCart: every request needs a query");
    const threshold = request.minRating ?? minRating;
    const result = await searchProducts(remote, {
      query,
      limit: SEARCH_LIMIT,
      minRating: threshold,
    });
    const picked = pickBest(result.items);
    if (!picked) {
      missing.push({ query, threshold, found: result.items.slice(0, 3) });
      continue;
    }
    selection.push({
      query,
      quantity: Number(request.quantity ?? 1),
      product: picked.best,
      alternatives: picked.alternatives,
    });
  }

  if (missing.length > 0) {
    const details = missing
      .map(({ query, threshold, found }) => {
        const names = found.map((item) => `${item.name} (${item.rating})`).join("; ");
        return `"${query}": no match with rating >= ${threshold}${names ? `, candidates: ${names}` : ""}`;
      })
      .join("\n");
    throw new Error(`Could not fill the cart:\n${details}`);
  }

  const merged = new Map();
  for (const entry of selection) {
    const current = merged.get(entry.product.id) ?? 0;
    merged.set(entry.product.id, Math.min(current + entry.quantity, 40));
  }
  const cartItems = [...merged.entries()].map(([id, quantity]) => ({ id, quantity }));
  const link = await createCartLink(remote, cartItems);

  return { link, selection, cartItems };
}
