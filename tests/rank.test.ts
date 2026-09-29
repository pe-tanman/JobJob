import { describe, expect, it } from "vitest";
import { offlineClassify } from "@/jev/offline";
import { featuresFor } from "@/rank/features";
import { applyReason, explain, predict, priorFromPreferences, update } from "@/rank/model";

const prefs = {
  roles: ["software_engineering"],
  seasons: ["summer"],
  workModes: [],
  paidOnly: true,
  needsSponsorship: false,
  hasInterests: true,
};

function job(title: string, description = "Summer internship. Paid hourly. Mentorship program.") {
  const answers = offlineClassify({
    posting: { title, company: "Northwind", location: "Austin, TX", pay: null, source: "test", description },
  });
  return featuresFor(answers, { firstSeenAt: new Date(), payText: null }, { interest: 0.8, skills: 0.6 });
}

describe("prior from onboarding", () => {
  it("ranks a chosen role above an unchosen one before any feedback", () => {
    const w = priorFromPreferences(prefs);
    expect(predict(w, job("Software Engineer Intern"))).toBeGreaterThan(predict(w, job("Marketing Intern")));
  });
});

describe("learning from feedback", () => {
  it("an Interested click raises the score of similar postings", () => {
    const prior = priorFromPreferences(prefs);
    const x = job("Data Analyst Intern");
    const after = update(prior, prior, x, "interested");
    expect(predict(after, job("Data Analytics Intern"))).toBeGreaterThan(predict(prior, job("Data Analytics Intern")));
    expect(after["role:data_science_analytics"]!).toBeGreaterThan(prior["role:data_science_analytics"]!);
  });

  it("Not for me lowers it, and Apply counts more than Interested", () => {
    const prior = priorFromPreferences(prefs);
    const x = job("Software Engineer Intern");
    const down = update(prior, prior, x, "dismissed");
    expect(predict(down, x)).toBeLessThan(predict(prior, x));
    const liked = update(prior, prior, x, "interested");
    const applied = update(prior, prior, x, "applied");
    expect(predict(applied, x)).toBeGreaterThan(predict(liked, x));
  });

  it("a Role reason pushes down that role specifically", () => {
    const prior = priorFromPreferences(prefs);
    const x = job("Software Engineer Intern");
    const w = applyReason(prior, x, "role");
    expect(w["role:software_engineering"]!).toBeLessThan(prior["role:software_engineering"]!);
    expect(w["season:summer"]).toBe(prior["season:summer"]);
  });

  it("repeated dismissals do not drift weights without bound", () => {
    const prior = priorFromPreferences(prefs);
    const x = job("Software Engineer Intern");
    let w = prior;
    for (let i = 0; i < 200; i++) w = update(w, prior, x, "dismissed");
    for (const v of Object.values(w)) expect(Number.isFinite(v)).toBe(true);
    expect(Math.abs(w["role:software_engineering"]!)).toBeLessThan(20);
  });
});

describe("explain", () => {
  it("builds a readable reason from the strongest features, with no dashes", () => {
    const w = priorFromPreferences(prefs);
    const reason = explain(w, job("Software Engineer Intern"), "software_engineering");
    expect(reason.startsWith("Software engineering")).toBe(true);
    expect(reason).not.toMatch(/[–—]/);
  });
});
