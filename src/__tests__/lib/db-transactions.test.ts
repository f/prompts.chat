import { describe, it, expect, vi } from "vitest";
import { withPerTransactionClient } from "@/lib/db-transactions";

function fakeClient(name: string) {
  return {
    name,
    $transaction: vi.fn(async (fn: (tx: { name: string }) => unknown) => fn({ name: `${name}-tx` })),
    $disconnect: vi.fn(async () => {}),
    query: vi.fn(() => `${name}-query`),
  };
}

describe("withPerTransactionClient", () => {
  it("passes ordinary calls through to the shared client", () => {
    const shared = fakeClient("http");
    const create = vi.fn(() => fakeClient("ws"));
    const client = withPerTransactionClient(shared, create);

    expect(client.query()).toBe("http-query");
    expect(client.name).toBe("http");
    expect(create).not.toHaveBeenCalled();
  });

  it("runs each interactive transaction on its own client and disconnects it", async () => {
    const shared = fakeClient("http");
    const transactionClients: ReturnType<typeof fakeClient>[] = [];
    const client = withPerTransactionClient(shared, () => {
      const created = fakeClient(`ws${transactionClients.length}`);
      transactionClients.push(created);
      return created;
    });

    const options = { timeout: 5000 };
    await expect(client.$transaction(async (tx: { name: string }) => tx.name, options as never)).resolves.toBe("ws0-tx");
    await expect(client.$transaction(async (tx: { name: string }) => tx.name)).resolves.toBe("ws1-tx");

    expect(shared.$transaction).not.toHaveBeenCalled();
    expect(transactionClients).toHaveLength(2);
    expect(transactionClients[0].$transaction).toHaveBeenCalledWith(expect.any(Function), options);
    for (const created of transactionClients) expect(created.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("disconnects the transaction client when the transaction fails", async () => {
    const created = fakeClient("ws");
    const client = withPerTransactionClient(fakeClient("http"), () => created);

    await expect(
      client.$transaction(async () => {
        throw new Error("rollback");
      })
    ).rejects.toThrow("rollback");
    expect(created.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("refuses batch transactions", async () => {
    const create = vi.fn(() => fakeClient("ws"));
    const client = withPerTransactionClient(fakeClient("http"), create);

    await expect(client.$transaction([] as never)).rejects.toThrow(/Batch \$transaction/);
    expect(create).not.toHaveBeenCalled();
  });
});
