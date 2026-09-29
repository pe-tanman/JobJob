import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { SiteHeader } from "@/components/SiteHeader";
import { EMPTY_PREFS, type Prefs } from "@/lib/prefs";
import { currentUser } from "@/lib/session";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const db = await getDb();
  const [p] = await db.select().from(schema.preferences).where(eq(schema.preferences.userId, user.id));
  const prefs: Prefs = p
    ? {
        roles: p.roles,
        seasons: p.seasons,
        workModes: p.workModes,
        locations: p.locations,
        needsSponsorship: p.needsSponsorship,
        usCitizen: p.usCitizen,
        classYear: p.classYear,
        paidOnly: p.paidOnly,
        interests: p.interests,
        skills: p.skills,
      }
    : EMPTY_PREFS;

  return (
    <>
      <SiteHeader />
      <main id="main" className="sky-wash flex-1">
        <div className="mx-auto grid w-full max-w-2xl gap-10 px-4 pt-10 pb-20 md:pt-14">
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Settings</h1>
            <p className="text-ink-muted">Signed in as {user.email}</p>
          </div>
          <SettingsForm prefs={prefs} cadence={user.cadence} paused={user.paused} />
        </div>
      </main>
    </>
  );
}
