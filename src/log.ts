import pino from "pino";

export const logger = pino(
  { level: process.env.MCPSCOPE_LOG_LEVEL ?? "info" },
  pino.destination(2),
);
