import { describe, expect, it } from "vitest";

describe("reserved test recipients", () => {
  it("never sends to RFC 2606 domains", async () => {
    const src = await import("node:fs").then((fs) => fs.readFileSync("src/email/send.ts", "utf8"));
    const re = new RegExp(src.match(/RESERVED_RECIPIENT = \/(.+)\/i;/)![1]!, "i");
    for (const to of ["e2e-1@example.edu", "a@example.com", "x@foo.test", "y@mail.invalid"]) expect(re.test(to)).toBe(true);
    for (const to of ["yi853@my.utexas.edu", "someone@gmail.com", "a@examples.com"]) expect(re.test(to)).toBe(false);
  });
});
