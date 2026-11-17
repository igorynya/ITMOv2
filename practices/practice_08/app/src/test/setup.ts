import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";

import { server } from "./server";

// Node fetch не понимает относительные адреса вида "/api/...": разрешаем их от адреса страницы jsdom.
const nativeFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  typeof input === "string" && input.startsWith("/")
    ? nativeFetch(new URL(input, window.location.href), init)
    : nativeFetch(input, init)) as typeof fetch;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  window.open = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
});
afterAll(() => server.close());
