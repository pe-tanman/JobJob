import { describe, expect, it } from "vitest";
import { makeToken, readToken } from "@/lib/tokens";

describe("signed tokens", () => {
  const fb = { k: "fb" as const, u: "user-1", j: "job-1", s: "interested" as const, exp: Date.now() + 60_000 };

  it("round-trips", () => {
    expect(readToken(makeToken(fb), "fb")).toEqual(fb);
  });
  it("rejects tampering", () => {
    const t = makeToken(fb);
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...fb, u: "someone-else" })).toString("base64url");
    expect(readToken(`${forged}.${sig}`, "fb")).toBeNull();
    expect(readToken(`${body}.${sig}x`, "fb")).toBeNull();
  });
  it("rejects the wrong kind, so a feedback link cannot be used as a session", () => {
    expect(readToken(makeToken(fb), "session")).toBeNull();
  });
  it("rejects expired tokens", () => {
    expect(readToken(makeToken({ ...fb, exp: Date.now() - 1 }), "fb")).toBeNull();
  });
});
