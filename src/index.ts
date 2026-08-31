import { isOcConfigured } from "./errors.js";
import { buildApp } from "./app.js";
import { loadLocalEnv } from "./load-env.js";
import { StdioKoreanLawMcp } from "./mcp/client.js";
import { logLine } from "./logging.js";

loadLocalEnv();

const HOST = process.env.HOST?.trim() || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);

async function main(): Promise<void> {
  const mcp = new StdioKoreanLawMcp();
  const app = await buildApp({ mcp, ocConfigured: () => isOcConfigured() });

  const shutdown = async () => {
    await app.close();
    await mcp.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ host: HOST, port: PORT });
  logLine({ event: "listen", host: HOST, port: PORT, ocConfigured: isOcConfigured() });
}

main().catch((err) => {
  logLine({ event: "fatal", message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
