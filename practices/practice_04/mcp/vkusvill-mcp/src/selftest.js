#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("./server.js", import.meta.url));
const client = new Client({ name: "vkusvill-mcp-selftest", version: "0.0.0" });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
  });
  await client.connect(transport);

  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name);
  for (const expected of [
    "vv_search_products",
    "vv_product_details",
    "vv_create_cart_link",
    "vv_build_cart",
  ]) {
    assert(names.includes(expected), `missing tool: ${expected}`);
  }

  const result = await client.callTool({
    name: "vv_search_products",
    arguments: { query: "круассан", limit: 2 },
  });
  assert(!result.isError, `search failed: ${result.content?.[0]?.text}`);
  const payload = JSON.parse(result.content[0].text);
  assert(payload.items.length > 0, "search returned no items");
  assert(payload.items[0].id > 0, "search returned an item without id");

  console.log(`OK: ${names.length} tools, search found ${payload.items.length} items`);
} finally {
  await client.close().catch(() => {});
}
