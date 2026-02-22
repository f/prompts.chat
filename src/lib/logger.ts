import pino from "pino";

const isDevelopment = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  // Use pretty print in development, JSON in production
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  // Add error serialization
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

// Convenience methods for common logging patterns
export const logQualityCheck = (title: string, contentLength: number) => {
  logger.info({ title, contentLength }, "[Quality Check] Checking prompt");
};

export const logQualityCheckResult = (result: { shouldDelist: boolean; reason: string | null; details: string }) => {
  logger.info(result, "[Quality Check] Result");
};

export const logQualityCheckError = (error: unknown) => {
  logger.error({ error }, "[Quality Check] Failed");
};

export const logEmbeddingError = (error: unknown, context?: string) => {
  logger.error({ error, context }, "[Embedding] Error");
};

export const logWebhookError = (error: unknown, webhookName?: string) => {
  logger.error({ error, webhookName }, "[Webhook] Error");
};

export const logAIError = (error: unknown, operation: string) => {
  logger.error({ error, operation }, `[AI] ${operation} failed`);
};
