#!/usr/bin/env node
import { VkusvillRemote } from "./remote.js";
import { buildCart } from "./vv.js";

const DEFAULT_BASKET = [
  { query: "круассан", quantity: 2 },
  { query: "сырники", quantity: 1 },
  { query: "сметана", quantity: 1 },
  { query: "сгущенка", quantity: 1 },
  { query: "голубика", quantity: 1 },
  { query: "кофе в дрип-пакетах молотый", quantity: 1 },
  { query: "апельсиновый сок", quantity: 1 },
];

function parseArgs(argv) {
  let minRating = 4.7;
  const items = [];
  for (const arg of argv) {
    if (arg.startsWith("--min-rating=")) {
      minRating = Number(arg.split("=")[1]);
      continue;
    }
    const [query, quantity] = arg.split(":");
    items.push({ query, quantity: quantity ? Number(quantity) : 1 });
  }
  return { minRating, items: items.length > 0 ? items : DEFAULT_BASKET };
}

const { minRating, items } = parseArgs(process.argv.slice(2));
const remote = new VkusvillRemote();

try {
  console.error(`Building cart (${items.length} positions, rating >= ${minRating})...`);
  const result = await buildCart(remote, items, { minRating });
  for (const entry of result.selection) {
    const { product } = entry;
    console.log(
      `${entry.quantity} x ${product.name} — ${product.price} ${product.currency}, rating ${product.rating}`,
    );
  }
  console.log(`\nCart link: ${result.link}`);
} catch (error) {
  console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await remote.close().catch(() => {});
}
