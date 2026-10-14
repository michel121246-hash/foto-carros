import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST, GET, DELETE } from "../app/api/access/route";
import { hasStudioSession, sessionCookie } from "../lib/studio-auth";
import { POST as edit } from "../app/api/edit/route";
import sharp from "sharp";

const base = "https://studio.test";
const login = (password: unknown, origin = base) =>
  new Request(`${base}/api/access`, {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_PASSWORD", "senha-ação-🚗");
  vi.stubEnv("OPENAI_API_KEY", "unit-test-only-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("explicit studio sign-in", () => {
  it("accepts a Unicode password and creates a protected session without an OpenAI call", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await POST(login("senha-ação-🚗"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticated: true,
      generationReady: true,
    });
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("senha");
    expect(cookie).not.toContain("unit-test-only-key");
    expect(
      hasStudioSession(
        new Request(base, { headers: { cookie: cookie.split(";")[0] } }),
      ),
    ).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a wrong password with a useful message and no session", async () => {
    const response = await POST(login("wrong"));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toContain("Senha incorreta");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("rejects cross-origin authentication", async () =>
    expect(
      (await POST(login("senha-ação-🚗", "https://evil.test"))).status,
    ).toBe(403));
  it("returns no authenticated state for a forged cookie", async () => {
    const response = await GET(
      new Request(base, {
        headers: { cookie: "auto_vision_session=9999999999.fake" },
      }),
    );
    expect((await response.json()).authenticated).toBe(false);
  });
  it("expires sessions and invalidates them after a password rotation", () => {
    const now = Date.now();
    const cookie = sessionCookie(now).split(";")[0];
    const request = new Request(base, { headers: { cookie } });
    expect(hasStudioSession(request, now)).toBe(true);
    expect(hasStudioSession(request, now + 9 * 60 * 60 * 1000)).toBe(false);
    vi.stubEnv("APP_PASSWORD", "rotated");
    expect(hasStudioSession(request, now)).toBe(false);
  });
  it("signs out by expiring the HttpOnly cookie", async () => {
    const response = await DELETE(
      new Request(`${base}/api/access`, {
        method: "DELETE",
        headers: { origin: base },
      }),
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("reports a missing OpenAI configuration without pretending generation is ready", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(login("senha-ação-🚗"));
    expect(response.status).toBe(200);
    expect((await response.json()).generationReady).toBe(false);
  });
});
describe("authenticated multi-reference edit route", () => {
  it("forwards five photos to the real adapter using only the session cookie", async () => {
    const image = await sharp({
      create: { width: 50, height: 30, channels: 3, background: "#abcdef" },
    })
      .jpeg()
      .toBuffer();
    const provider = vi.fn(async () =>
      Response.json({ data: [{ b64_json: image.toString("base64") }] }),
    );
    vi.stubGlobal("fetch", provider);
    const body = new FormData();
    for (let i = 0; i < 5; i++)
      body.append(
        "images",
        new File([new Uint8Array(image)], `angle-${i}.jpg`, {
          type: "image/jpeg",
        }),
      );
    body.append("style", "studio");
    body.append("ratio", "4:5");
    const response = await edit(
      new Request(`${base}/api/edit`, {
        method: "POST",
        headers: { origin: base, cookie: sessionCookie().split(";")[0] },
        body,
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    const meta = await sharp(
      Buffer.from(await response.arrayBuffer()),
    ).metadata();
    expect([meta.width, meta.height]).toEqual([1024, 1280]);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(
      (
        (provider.mock.calls as unknown as [string, RequestInit][])[0][1]
          .body as FormData
      ).getAll("image[]"),
    ).toHaveLength(5);
  });
  it("rejects 11 photos without reaching the provider", async () => {
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    const body = new FormData();
    for (let i = 0; i < 11; i++)
      body.append("images", new File(["fake"], `car-${i}.jpg`));
    body.append("style", "studio");
    body.append("ratio", "1:1");
    const response = await edit(
      new Request(`${base}/api/edit`, {
        method: "POST",
        headers: { origin: base, cookie: sessionCookie().split(";")[0] },
        body,
      }),
    );
    expect(response.status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
  it("rejects a missing session before parsing images", async () => {
    expect(
      (
        await edit(
          new Request(`${base}/api/edit`, {
            method: "POST",
            headers: { origin: base },
          }),
        )
      ).status,
    ).toBe(401);
  });
});
