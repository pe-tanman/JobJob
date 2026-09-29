import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Wizard } from "./Wizard";

export const metadata: Metadata = { title: "Get started" };

export default function OnboardingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="sky-wash flex-1">
        <Wizard />
      </main>
    </>
  );
}
