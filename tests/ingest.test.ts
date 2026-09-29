import { describe, expect, it } from "vitest";
import { htmlToText, jobKey, looksRemote, passesPrefilter, prettySlug } from "@/ingest/normalize";
import { atsSlugFromUrl } from "@/ingest/sources/simplify";

describe("htmlToText", () => {
  it("decodes Greenhouse's double-encoded HTML and keeps structure", () => {
    const html = "&lt;h2&gt;About&lt;/h2&gt;&lt;p&gt;Build &amp;amp; ship&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Python&lt;/li&gt;&lt;/ul&gt;";
    expect(htmlToText(html)).toBe("About\nBuild & ship\n- Python");
  });
  it("drops scripts and styles", () => {
    expect(htmlToText("<style>p{}</style><p>Hi</p><script>x()</script>")).toBe("Hi");
  });
});

describe("jobKey", () => {
  it("matches the same posting across sources despite formatting noise", () => {
    const a = jobKey("Stripe, Inc.", "Software Engineer Intern", "San Francisco, CA; Seattle, WA");
    const b = jobKey("stripe", "Software Engineer  Intern", "San Francisco, CA");
    expect(a).toBe(b);
  });
  it("separates different roles", () => {
    expect(jobKey("Stripe", "Data Intern", "SF")).not.toBe(jobKey("Stripe", "Design Intern", "SF"));
  });
});

describe("passesPrefilter", () => {
  it.each([
    ["Software Engineering Intern", true],
    ["Co-op, Mechanical Engineering (Fall 2027)", true],
    ["Summer Analyst, Investment Banking", true],
    ["Senior Software Engineer", false],
    ["Senior Manager, University Recruiting", false],
    ["Account Executive", false],
  ])("%s -> %s", (title, expected) => {
    expect(passesPrefilter(title, false)).toBe(expected);
  });
  it("always passes intern-only sources", () => {
    expect(passesPrefilter("Engineering (Summer 2027)", true)).toBe(true);
  });
});

describe("helpers", () => {
  it("detects remote", () => {
    expect(looksRemote("Remote - US")).toBe(true);
    expect(looksRemote("Austin, TX")).toBe(false);
  });
  it("prettifies slugs", () => {
    expect(prettySlug("jane-street")).toBe("Jane Street");
  });
  it("harvests ATS board slugs from listing URLs", () => {
    expect(atsSlugFromUrl("https://job-boards.greenhouse.io/figma/jobs/123")).toEqual({ ats: "greenhouse", slug: "figma" });
    expect(atsSlugFromUrl("https://jobs.lever.co/palantir/abc")).toEqual({ ats: "lever", slug: "palantir" });
    expect(atsSlugFromUrl("https://jobs.ashbyhq.com/flint/39f9/application?embed=true")).toEqual({ ats: "ashby", slug: "flint" });
    expect(atsSlugFromUrl("https://careers.example.com/job/1")).toBeNull();
    expect(atsSlugFromUrl("not a url")).toBeNull();
  });
});

describe("cleanTitle", () => {
  it("replaces en and em dash separators with hyphens", async () => {
    const { cleanTitle } = await import("@/ingest/normalize");
    expect(cleanTitle("Software Engineering Intern – Distributed  Systems")).toBe("Software Engineering Intern - Distributed Systems");
    expect(cleanTitle("Data Intern—Summer")).toBe("Data Intern - Summer");
  });
});
