import { existsSync } from "node:fs";
import path from "node:path";
import { ArrowRight, BellSimple, Binoculars, ChatCircleText, Plus } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ExampleCard } from "./ExampleCard";
import { HeroReveal, Reveal } from "./HeroReveal";

// Hero photo: generated for JetJob. The file ships in /public; until it is added,
// the hero shows the sky gradient panel instead of a broken image.
const HERO_IMAGE = "/hero-sky.jpg";
const hasHeroImage = existsSync(path.join(process.cwd(), "public", HERO_IMAGE));

const STEPS = [
  {
    icon: ChatCircleText,
    title: "Tell us",
    body: "Pick the work you want, when and where, and say what excites you in your own words.",
  },
  {
    icon: Binoculars,
    title: "We watch",
    body: "Every few hours we read new postings from thousands of company job boards and skip the ones that do not fit.",
  },
  {
    icon: BellSimple,
    title: "You decide",
    body: "A short email with the best few. Mark each one Interested or Not for me, and the next email gets sharper.",
  },
];

// Sources JetJob reads that have a Simple Icons mark (Lever and Ashby do not).
const SOURCES = [
  { name: "Greenhouse", slug: "greenhouse" },
  { name: "GitHub", slug: "github" },
  { name: "Y Combinator", slug: "ycombinator" },
];

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. Reading a posting costs us a small fraction of a cent, because we use a fast model that answers typed questions instead of writing text. That keeps JetJob free for students.",
  },
  {
    q: "Where do the postings come from?",
    a: "Public company job boards on Greenhouse, Lever and Ashby, plus community internship lists. We link straight to the original posting, so you always apply with the company.",
  },
  {
    q: "How does it learn what I like?",
    a: "Each posting gets a set of facts: kind of work, timing, location, pay, and more. Your answers adjust how much each fact matters to you. Nothing you write is shared.",
  },
  {
    q: "How many emails will I get?",
    a: "At most one a day, and only when something new fits. You can switch to twice a week or weekly, or pause any time.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {/* Hero: asymmetric split, copy left, sky right. */}
        <section>
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-12 pb-16 md:grid-cols-[1.25fr_0.75fr] md:gap-12 md:px-8 md:pt-20 md:pb-24">
            <div className="grid max-w-2xl gap-6">
              <HeroReveal>
                <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance md:text-5xl xl:text-[3.5rem]">
                  Internships that fit, delivered to your inbox.
                </h1>
              </HeroReveal>
              <HeroReveal delay={0.08}>
                <p className="max-w-[46ch] text-lg leading-relaxed text-ink-muted">
                  JetJob reads thousands of new postings every day and emails you the few worth your time. Free for
                  students.
                </p>
              </HeroReveal>
              <HeroReveal delay={0.16}>
                <div className="flex flex-wrap gap-3">
                  <Link href="/onboarding" className="btn-primary px-6">
                    Get started <ArrowRight size={18} aria-hidden />
                  </Link>
                  <Link href="#how" className="btn-quiet px-6">
                    How it works
                  </Link>
                </div>
              </HeroReveal>
            </div>
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] md:max-h-[640px] md:justify-self-end">
              {hasHeroImage ? (
                <Image
                  src={HERO_IMAGE}
                  alt="A pale morning sky with soft clouds and a thin contrail."
                  fill
                  priority
                  sizes="(min-width: 768px) 45vw, 100vw"
                  className="object-cover"
                />
              ) : (
                // TODO: add public/hero-sky.jpg (1136x1408). Until then, a plain sky panel.
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_20%,var(--sky-1)_0%,var(--sky-top)_45%,var(--sky-2)_100%)]"
                />
              )}
            </div>
          </div>
        </section>

        {/* How it works: a vertical flow, one idea per row. */}
        <section id="how" className="scroll-mt-20">
          <div className="mx-auto grid max-w-3xl gap-12 px-4 py-20 md:py-28">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Three minutes to set up. Then it runs.</h2>
            <ol className="grid gap-10">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <Reveal delay={i * 0.06} className="grid grid-cols-[48px_1fr] gap-5">
                    <span className="grid size-12 place-items-center rounded-full bg-sky-2 text-accent-ink">
                      <s.icon size={24} weight="duotone" aria-hidden />
                    </span>
                    <div className="grid gap-1.5">
                      <h3 className="text-xl font-semibold">{s.title}</h3>
                      <p className="max-w-[55ch] text-ink-muted leading-relaxed">{s.body}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Sources: logo wall, logos only. */}
        <section aria-labelledby="sources-heading" className="border-y border-white/70 bg-sky-1/60">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-8">
            <h2 id="sources-heading" className="text-center text-lg font-medium text-ink-muted">
              Postings come from public job boards and community lists
            </h2>
            <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
              {SOURCES.map((s) => (
                <li key={s.slug}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://cdn.simpleicons.org/${s.slug}/3e526a`}
                    alt={s.name}
                    width={36}
                    height={36}
                    loading="lazy"
                    className="h-9 w-auto"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Live preview: a working miniature of the real match card. */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:py-28">
          <div className="grid gap-4">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">One tap teaches it.</h2>
            <p className="max-w-[48ch] text-lg leading-relaxed text-ink-muted">
              Try it. Every answer shifts what comes next, so the tenth email is far better than the first.
            </p>
          </div>
          <div className="grid gap-2">
            <p className="text-sm text-ink-muted">Example postings</p>
            <ExampleCard />
          </div>
        </section>

        {/* Cost explainer: a single tinted band. */}
        <section className="bg-sky-2">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 py-20 md:grid-cols-[auto_1fr] md:items-center md:gap-16 md:px-8 md:py-24">
            <p className="font-mono text-6xl font-semibold tracking-tight text-accent-ink md:text-7xl">$0</p>
            <div className="grid gap-3">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Free, and built to stay free.</h2>
              <p className="max-w-[58ch] leading-relaxed text-ink-muted">
                JetJob classifies postings with Jev, a model that returns answers instead of writing essays. At $42 per
                billion tokens, reading every new internship each day costs less than a cup of coffee, so there is
                nothing to charge you for.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ: native disclosure, keyboard and screen reader friendly with no script. */}
        <section aria-labelledby="faq-heading" className="mx-auto grid max-w-3xl gap-8 px-4 py-20 md:py-28">
          <h2 id="faq-heading" className="text-3xl font-semibold tracking-tight">
            Questions
          </h2>
          <div className="grid gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group card open:bg-sky-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-card)] px-5 py-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <Plus size={20} aria-hidden className="shrink-0 transition-transform duration-200 group-open:rotate-45" />
                </summary>
                <p className="max-w-[60ch] px-5 pb-5 leading-relaxed text-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <Link href="/onboarding" className="btn-primary justify-self-start px-6">
            Get started <ArrowRight size={18} aria-hidden />
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-muted md:px-8">
          <p>JetJob. Free internship alerts for students.</p>
          <nav aria-label="Footer" className="flex gap-6">
            <Link href="/signin" className="underline-offset-4 hover:underline">
              Sign in
            </Link>
            <Link href="/#how" className="underline-offset-4 hover:underline">
              How it works
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
