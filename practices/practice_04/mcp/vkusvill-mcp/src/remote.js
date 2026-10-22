import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const DEFAULT_URL = "https://mcp.vkusvill.ru/mcp";
const DEFAULT_TIMEOUT_MS = 45_000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class VkusvillRemote {
  #client = null;
  #connecting = null;

  constructor({
    url = process.env.VV_MCP_URL || DEFAULT_URL,
    token = process.env.VV_ACCESS_TOKEN,
    timeoutMs = Number(process.env.VV_MCP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  } = {}) {
    this.url = url;
    this.token = token;
    this.timeoutMs = timeoutMs;
  }

  get authorized() {
    return Boolean(this.token);
  }

  async #connect() {
    if (this.#client) return this.#client;
    if (!this.#connecting) {
      this.#connecting = (async () => {
        const transport = new StreamableHTTPClientTransport(new URL(this.url), {
          requestInit: this.token
            ? { headers: { Authorization: `Bearer ${this.token}` } }
            : undefined,
        });
        const client = new Client({ name: "vkusvill-mcp-local", version: "0.1.0" });
        await withTimeout(client.connect(transport), this.timeoutMs, "connect");
        this.#client = client;
        return client;
      })().catch((error) => {
        this.#connecting = null;
        throw error;
      });
    }
    return this.#connecting;
  }

  async callTool(name, args = {}) {
    const client = await this.#connect();
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await withTimeout(
          client.callTool({ name, arguments: args }),
          this.timeoutMs,
          name,
        );
        const text = (result.content || [])
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n");
        if (result.isError) throw new Error(`${name}: ${text || "unknown error"}`);
        try {
          return JSON.parse(text);
        } catch {
          return { raw: text };
        }
      } catch (error) {
        lastError = error;
        const retryable = /429|rate.?limit|timeout|ECONNRESET|fetch failed/i.test(
          String(error?.message || error),
        );
        if (!retryable || attempt === 2) break;
        await sleep(1_000 * (attempt + 1));
      }
    }
    throw lastError;
  }

  async close() {
    const client = this.#client;
    this.#client = null;
    this.#connecting = null;
    if (client) await client.close();
  }
}
