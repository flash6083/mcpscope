#!/usr/bin/env node

import { Command } from "commander";
import { dashboardCommand } from "./commands/dashboard.js";
import { wrapCommand } from "./commands/wrap.js";
import { wrapHttpCommand } from "./commands/wrap-http.js";

const program = new Command();

program
  .name("mcpscope")
  .description("Observability proxy for Model Context Protocol")
  .version("0.1.0");

program
  .command("wrap")
  .description("Wrap an MCP server and inspect traffic")
  .argument("<cmd...>", "Command to run")
  .action(async (cmd) => {
    await wrapCommand(cmd[0], cmd.slice(1));
  });

program
  .command("wrap-http")
  .description("Wrap an MCP server over Streamable HTTP")
  .argument("<url>", "Upstream MCP server URL")
  .option("--port <number>", "Local listening port", "8989")
  .action(async (url, options) => {
    await wrapHttpCommand(url, Number(options.port));
  });

program
  .command("dashboard")
  .description("Start the dashboard server")
  .action(async () => {
    await dashboardCommand();
  });

program.parseAsync();
