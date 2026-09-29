import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Emails paused" };

export default function UnsubscribedPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="sky-wash flex-1">
        <div className="mx-auto grid w-full max-w-md gap-4 px-4 pt-16 pb-20">
          <h1 className="text-3xl font-semibold tracking-tight">Emails paused</h1>
          <p className="text-ink-muted">
            You will not get any more digests. Your preferences are kept in case you want to turn them back on.
          </p>
          <Link href="/settings" className="btn-quiet justify-self-start">
            Open settings
          </Link>
        </div>
      </main>
    </>
  );
}
