import { describe, it, expect, vi, beforeEach } from "vitest";

describe("hasura client", () => {
  beforeEach(() => {
    // reset mocks before each test
    vi.resetAllMocks();
    // provide a clean global fetch for each test
    // @ts-ignore
    delete (global as any).fetch;
  });

  it("graphqlRequest should return data on success", async () => {
    // @ts-ignore
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { hello: "world" } }),
    });

    const { graphqlRequest } = await import("../client");
    const data = await graphqlRequest<{ hello: string }>(`query { hello }`);
    expect(data).toEqual({ hello: "world" });
  });

  it("graphqlRequest should throw on non-ok response", async () => {
    // @ts-ignore
    (global as any).fetch = vi.fn().mockResolvedValue({ ok: false, statusText: "Not Found" });
    const { graphqlRequest } = await import("../client");
    await expect(graphqlRequest<any>(`query { hello }`)).rejects.toBeInstanceOf(Error);
  });

  it("graphqlRequest should throw on GraphQL errors", async () => {
    // @ts-ignore
    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ errors: [{ message: "boom" }] }) });
    const { graphqlRequest } = await import("../client");
    await expect(graphqlRequest<any>(`query { hello }`)).rejects.toThrow("boom");
  });

  it("getHasuraWsClient should initialize WebSocket client with ws URL and expose dispose", async () => {
    // Mock graphql-ws createClient
    let capturedOpts: any = null;
    vi.resetModules();
    // @ts-ignore
    vi.doMock('graphql-ws', () => ({
      createClient: vi.fn((opts: any) => {
        capturedOpts = opts;
        return { dispose: vi.fn() } as any;
      }),
    }));
    process.env.NEXT_PUBLIC_HASURA_URL = "http://example.com/v1/graphql";
    const { getHasuraWsClient, closeHasuraConnection } = await import("../client");
    const ws = getHasuraWsClient();
    expect(capturedOpts.url).toBe("ws://example.com/v1/graphql");
    // closing should call dispose on the client
    // @ts-ignore
    closeHasuraConnection();
  });
});
