#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { VkusvillRemote } from "./remote.js";
import { buildCart, createCartLink, productDetails, searchProducts } from "./vv.js";

const remote = new VkusvillRemote();
const server = new McpServer({ name: "vkusvill-mcp-local", version: "0.1.0" });

const productSchema = z.object({
  id: z.number().int().positive(),
  quantity: z.number().min(0.01).max(40).default(1),
});

const requestSchema = z.object({
  query: z.string().min(1).max(255),
  quantity: z.number().min(0.01).max(40).default(1),
  min_rating: z.number().min(0).max(5).optional(),
});

function json(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function failure(error) {
  return {
    isError: true,
    content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
  };
}

server.registerTool(
  "vv_search_products",
  {
    title: "Search VkusVill products",
    description:
      "Search the VkusVill catalog and return compact product cards (id, name, price, rating, url).",
    inputSchema: {
      query: z.string().min(1).max(255).describe("Search query, e.g. 'круассан'"),
      limit: z.number().int().min(1).max(10).default(5),
      min_rating: z.number().min(0).max(5).optional(),
      sort: z.enum(["rating", "popularity", "price_asc", "price_desc", "new"]).default("rating"),
    },
  },
  async ({ query, limit, min_rating, sort }) => {
    try {
      return json(await searchProducts(remote, { query, limit, minRating: min_rating, sort }));
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "vv_product_details",
  {
    title: "Get VkusVill product details",
    description: "Return full details for one VkusVill product by id.",
    inputSchema: {
      id: z.number().int().positive().describe("Product id from vv_search_products"),
    },
  },
  async ({ id }) => {
    try {
      return json(await productDetails(remote, id));
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "vv_create_cart_link",
  {
    title: "Create VkusVill cart link",
    description:
      "Create a shareable VkusVill cart link from explicit product ids and quantities.",
    inputSchema: {
      items: z.array(productSchema).min(1).max(100),
    },
  },
  async ({ items }) => {
    try {
      return json({ link: await createCartLink(remote, items) });
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "vv_build_cart",
  {
    title: "Build VkusVill cart from a shopping list",
    description:
      "Search each item, pick the best-rated product above the rating threshold, and create a cart link in one call.",
    inputSchema: {
      items: z.array(requestSchema).min(1).max(20),
      min_rating: z.number().min(0).max(5).default(4.5),
    },
  },
  async ({ items, min_rating }) => {
    try {
      return json(await buildCart(remote, items, { minRating: min_rating }));
    } catch (error) {
      return failure(error);
    }
  },
);

async function shutdown() {
  await remote.close().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`vkusvill-mcp-local ready (remote: ${remote.url}, auth: ${remote.authorized})`);
