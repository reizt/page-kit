import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { closeBrowser } from "./browser.js";
import { createCache } from "./cache.js";

const cache = createCache();
const app = createApp(cache);
const port = Number(process.env.PORT ?? 3000);
const server = serve({ fetch: app.fetch, port }, ({ port: listeningPort }) => {
  console.log(`Page Kit listening on http://localhost:${listeningPort}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await closeBrowser();
  cache.close();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
