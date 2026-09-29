import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { readToken } from "@/lib/tokens";
import { EmailFeedback } from "./EmailFeedback";

export const metadata: Metadata = { title: "Thanks", robots: { index: false } };

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = readToken(token, "fb");
  return (
    <>
      <SiteHeader />
      <main id="main" className="sky-wash flex-1">
        <div className="mx-auto grid w-full max-w-xl gap-6 px-4 pt-16 pb-20">
          {valid ? (
            <EmailFeedback token={token} signal={valid.s} />
          ) : (
            <div className="card grid gap-2 p-6">
              <h1 className="text-2xl font-semibold">This link has expired</h1>
              <p className="text-ink-muted">Links in emails work for 30 days. Your latest matches are on the Matches page.</p>
              <a href="/matches" className="btn-primary mt-2 justify-self-start">
                Open matches
              </a>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
