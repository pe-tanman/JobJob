import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { currentUser } from "@/lib/session";

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-white/70 bg-sky-1/65 backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-sky-1">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 md:px-8">
        <Link href="/" className="mr-auto flex items-center gap-2 rounded-full pr-2 text-lg font-semibold tracking-tight">
          <PaperPlaneTilt size={24} weight="duotone" className="text-accent-ink" aria-hidden />
          JetJob
        </Link>
        <Link href="/opportunities" className="btn-ghost px-3 sm:px-5">
          Browse
        </Link>
        {user ? (
          <>
            <Link href="/matches" className="btn-ghost px-3 sm:px-5">
              Matches
            </Link>
            <Link href="/settings" className="btn-ghost px-3 sm:px-5">
              Settings
            </Link>
          </>
        ) : (
          <>
            <Link href="/#how" className="btn-ghost hidden md:inline-flex">
              How it works
            </Link>
            <Link href="/signin" className="btn-ghost">
              Sign in
            </Link>
          </>
        )}
        {!user && (
          <Link href="/onboarding" className="btn-primary hidden sm:inline-flex">
            Get started
          </Link>
        )}
      </nav>
    </header>
  );
}
