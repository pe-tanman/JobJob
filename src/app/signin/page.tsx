import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SigninForm } from "./SigninForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function SigninPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main" className="sky-wash flex-1">
        <div className="mx-auto grid w-full max-w-md gap-6 px-4 pt-16 pb-20">
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-ink-muted">We will email you a link. No password needed.</p>
          </div>
          {expired && (
            <p className="card border-accent p-4 font-medium text-accent-ink" role="alert">
              That link expired. Links work for 30 minutes, so request a new one below.
            </p>
          )}
          <SigninForm />
          <p className="text-ink-muted">
            New here?{" "}
            <Link href="/onboarding" className="font-medium text-accent-ink underline underline-offset-4">
              Get started
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
