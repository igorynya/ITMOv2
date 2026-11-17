import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { allCollections, cartUrl, collectionsFor, lunch } from "./fixtures";

/** Обработчики по умолчанию: «здоровый» сервер. Отдельные тесты подменяют их через server.use. */
export const handlers = [
  http.get("/api/collections", ({ request }) =>
    HttpResponse.json(collectionsFor(new URL(request.url).searchParams.get("tag"))),
  ),
  http.get("/api/favorites", () => HttpResponse.json({ collections: [lunch] })),
  http.put("/api/favorites/:id", ({ params }) => {
    const known = allCollections.some((c) => c.id === params.id);
    return known
      ? HttpResponse.json({ favorite: true, id: params.id })
      : HttpResponse.json({ error: "collection not found" }, { status: 404 });
  }),
  http.delete("/api/favorites/:id", ({ params }) => HttpResponse.json({ favorite: false, id: params.id })),
  http.post("/api/collections/:id/cart", () => HttpResponse.json({ url: cartUrl })),
];

export const server = setupServer(...handlers);
