export const WellKnownMethods = {
  Initialize: "initialize",
  Initialized: "initialized",
  ToolsList: "tools/list",
  ToolsCall: "tools/call",
  ResourcesList: "resources/list",
  ResourcesRead: "resources/read",
  PromptsList: "prompts/list",
  PromptsGet: "prompts/get",
  LoggingSetLevel: "logging/setLevel",
  Ping: "ping",
  Cancel: "$/cancelRequest",
  Progress: "$/progress",
} as const;

export type WellKnownMethod = (typeof WellKnownMethods)[keyof typeof WellKnownMethods];
