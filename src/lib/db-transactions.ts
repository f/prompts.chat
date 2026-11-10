/**
 * Neon's HTTP mode answers each query with one `fetch`, so a single client can
 * serve every request in a worker isolate. It cannot hold a transaction open,
 * so interactive `$transaction(async (tx) => ...)` calls get their own
 * WebSocket-backed client for the length of the transaction. WebSockets in a
 * worker belong to the request that opened them and must not be pooled.
 *
 * Batch `$transaction([...])` is refused: its queries were built on the HTTP
 * client and cannot be moved onto the WebSocket one.
 */
export function withPerTransactionClient<T extends { $transaction: unknown }>(
  client: T,
  createTransactionClient: () => T & { $disconnect(): Promise<void> }
): T {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver);
      return async (callback: unknown, options?: unknown) => {
        if (typeof callback !== "function") {
          throw new Error(
            "Batch $transaction([...]) is not supported with PCHAT_DB_DRIVER=neon; use $transaction(async (tx) => ...)"
          );
        }
        const transactionClient = createTransactionClient();
        try {
          const run = transactionClient.$transaction as (fn: unknown, options?: unknown) => Promise<unknown>;
          return await run.call(transactionClient, callback, options);
        } finally {
          await transactionClient.$disconnect();
        }
      };
    },
  });
}
