import { pino, type Logger } from "pino";
import type { ILogger } from "@donordesk/application";

export function createLogger(): ILogger {
  const p: Logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: ["*.password", "*.passwordHash", "*.token", "*.jwt", "req.headers.authorization"],
      censor: "[REDACTED]",
    },
    base: { service: "donordesk" },
  });
  return {
    info: (msg, meta) => p.info(meta ?? {}, msg),
    warn: (msg, meta) => p.warn(meta ?? {}, msg),
    error: (msg, meta) => p.error(meta ?? {}, msg),
    debug: (msg, meta) => p.debug(meta ?? {}, msg),
  };
}
