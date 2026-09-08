import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getEnv, resetEnvCache } from "@/lib/env";

const original = { ...process.env };

beforeEach(() => resetEnvCache());
afterEach(() => {
  process.env = { ...original };
  resetEnvCache();
});

describe("getEnv", () => {
  it("accepte une configuration valide", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080/api/v1";
    process.env.NEXT_PUBLIC_WS_URL = "http://localhost:8080/ws";

    expect(getEnv().NEXT_PUBLIC_API_URL).toBe("http://localhost:8080/api/v1");
  });

  /** Le projet de référence se contentait d'un avertissement — on veut un arrêt franc. */
  it("échoue explicitement si une variable manque, en nommant laquelle", () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_WS_URL = "http://localhost:8080/ws";

    expect(() => getEnv()).toThrowError(/NEXT_PUBLIC_API_URL/);
  });

  it("refuse une URL relative", () => {
    process.env.NEXT_PUBLIC_API_URL = "/api/v1";
    process.env.NEXT_PUBLIC_WS_URL = "http://localhost:8080/ws";

    expect(() => getEnv()).toThrowError(/URL absolue/);
  });
});
