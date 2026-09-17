import { z } from "zod";

export const JsonRpcVersionSchema = z.object({
  jsonrpc: z.literal("2.0"),
});

export const RequestSchema = z.object({
  ...JsonRpcVersionSchema.shape,
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.unknown().optional(),
});

export type JsonRpcRequest = z.infer<typeof RequestSchema>;

export const ResponseSchema = z.object({
  ...JsonRpcVersionSchema.shape,
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});

export type JsonRpcResponse = z.infer<typeof ResponseSchema>;

export const NotificationSchema = z.object({
  ...JsonRpcVersionSchema.shape,
  method: z.string(),
  params: z.unknown().optional(),
});

export type JsonRpcNotification = z.infer<typeof NotificationSchema>;

export const MessageSchema = z.union([RequestSchema, ResponseSchema, NotificationSchema]);

export type JsonRpcMessage = z.infer<typeof MessageSchema>;
