// Тестовые данные в формате реального API (spec.md, раздел 6).
export const dinner = {
  id: "dinner-500-1792666479",
  slug: "dinner-500",
  title: "Ужин на двоих",
  subtitle: "Простой ужин без лишних трат",
  template: "dinner-500",
  budget: 500,
  total: 480,
  items: [
    { id: 123, name: "Куриное филе", price: 250, unit: "кг", rating: 4.8, quantity: 1, url: "https://vkusvill.ru/goods/123" },
    { id: 124, name: "Рис басмати", price: 130, unit: "уп", rating: 4.7, quantity: 1, url: "https://vkusvill.ru/goods/124" },
    { id: 125, name: "Брокколи", price: 100, unit: "уп", rating: 4.6, quantity: 1, url: "https://vkusvill.ru/goods/125" },
  ],
  tags: ["ужин", "бюджет"],
  created_at: "2026-10-23T12:00:00Z",
  generation: 1792666479,
};

export const breakfast = {
  id: "breakfast-300-1792666479",
  slug: "breakfast-300",
  title: "Быстрый завтрак",
  subtitle: "Овсянка и фрукты",
  template: "breakfast-300",
  budget: 300,
  total: 270,
  items: [{ id: 201, name: "Овсяные хлопья", price: 90, unit: "уп", rating: 4.9, quantity: 1, url: "https://vkusvill.ru/goods/201" }],
  tags: ["завтрак", "бюджет"],
  created_at: "2026-10-23T12:00:00Z",
  generation: 1792666479,
};

export const lunch = {
  id: "friends-lunch-1792666479",
  slug: "friends-lunch",
  title: "Обед с друзьями",
  subtitle: "Большая подборка для компании",
  template: "friends-lunch",
  budget: 1500,
  total: 1420,
  items: [{ id: 301, name: "Лазанья", price: 420, unit: "шт", rating: 4.5, quantity: 2, url: "https://vkusvill.ru/goods/301" }],
  tags: ["перекус"],
  created_at: "2026-10-23T12:00:00Z",
  generation: 1792666479,
};

export const allCollections = [dinner, breakfast, lunch];
export const allTags = ["бюджет", "завтрак", "перекус", "ужин"];
export const cartUrl = "https://vkusvill.ru/mobile?basket&share=abc123";

/** Ответ GET /api/collections для тега (как у реального сервиса: регистр и пробелы нормализуются). */
export function collectionsFor(rawTag: string | null) {
  const tag = (rawTag ?? "").trim().toLowerCase();
  const collections = tag ? allCollections.filter((c) => c.tags.includes(tag)) : allCollections;
  return { collections, favorites: [lunch.id], tags: allTags, active_tag: tag };
}
