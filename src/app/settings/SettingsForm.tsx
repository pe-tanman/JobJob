"use client";

import * as Checkbox from "@radix-ui/react-checkbox";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Check } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import {
  deleteAccountAction,
  savePreferencesAction,
  saveSettingsAction,
  signOutAction,
} from "@/app/actions";
import { AboutField, ConstraintsField, RolesField, WhenField, WhereField } from "@/components/PrefsFields";
import type { Prefs } from "@/lib/prefs";

type Cadence = "daily" | "twice_weekly" | "weekly";

const CADENCES: [Cadence, string][] = [
  ["daily", "Daily, when there is something new"],
  ["twice_weekly", "Twice a week"],
  ["weekly", "Once a week"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line pt-8" aria-label={title}>
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsForm({ prefs: initial, cadence: c0, paused: p0 }: { prefs: Prefs; cadence: Cadence; paused: boolean }) {
  const [prefs, setPrefs] = useState(initial);
  const [cadence, setCadence] = useState<Cadence>(c0);
  const [paused, setPaused] = useState(p0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () =>
    start(async () => {
      setError("");
      setStatus("");
      const [a, b] = await Promise.all([savePreferencesAction(prefs), saveSettingsAction({ cadence, paused })]);
      if (!a.ok) return setError(a.error);
      if (!b.ok) return setError(b.error);
      setStatus("Saved. Your next matches will use these settings.");
    });

  return (
    <div className="grid gap-10">
      <Section title="Emails">
        <fieldset className="grid gap-3">
          <legend className="field-label mb-1">How often</legend>
          <RadioGroup.Root value={cadence} onValueChange={(v) => setCadence(v as Cadence)} className="flex flex-wrap gap-2">
            {CADENCES.map(([k, label]) => (
              <RadioGroup.Item key={k} value={k} className="chip">
                {label}
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </fieldset>
        <div className="flex items-start gap-4">
          <Checkbox.Root
            id="paused"
            checked={paused}
            onCheckedChange={(v) => setPaused(v === true)}
            className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border-2 border-line-strong bg-sky-1 text-on-accent data-[state=checked]:border-accent data-[state=checked]:bg-accent"
          >
            <Checkbox.Indicator>
              <Check size={16} weight="bold" aria-hidden />
            </Checkbox.Indicator>
          </Checkbox.Root>
          <label htmlFor="paused" className="field-label cursor-pointer">
            Pause all emails
          </label>
        </div>
      </Section>

      <Section title="What you are looking for">
        <RolesField value={prefs} onChange={setPrefs} />
        <WhenField value={prefs} onChange={setPrefs} />
      </Section>
      <Section title="Where">
        <WhereField value={prefs} onChange={setPrefs} />
      </Section>
      <Section title="Filters">
        <ConstraintsField value={prefs} onChange={setPrefs} />
      </Section>
      <Section title="About you">
        <AboutField value={prefs} onChange={setPrefs} />
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t border-line bg-sky-0/95 px-4 py-4">
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving" : "Save changes"}
        </button>
        <p className="text-ink-muted" role="status">
          {status}
        </p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <Section title="Account">
        <div className="flex flex-wrap gap-3">
          <form action={signOutAction}>
            <button type="submit" className="btn-quiet">
              Sign out
            </button>
          </form>
          {!confirmDelete ? (
            <button type="button" className="btn-ghost text-accent-ink" onClick={() => setConfirmDelete(true)}>
              Delete my account
            </button>
          ) : (
            <div className="card grid w-full gap-3 border-accent p-5" role="group" aria-labelledby="delete-heading">
              <p id="delete-heading" className="font-semibold">
                Delete your account and everything JetJob learned about you?
              </p>
              <p className="text-ink-muted">This removes your preferences, matches and feedback. It cannot be undone.</p>
              <div className="flex flex-wrap gap-2">
                <form action={deleteAccountAction}>
                  <button type="submit" className="btn-primary">
                    Delete account
                  </button>
                </form>
                <button type="button" className="btn-quiet" onClick={() => setConfirmDelete(false)}>
                  Keep my account
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
