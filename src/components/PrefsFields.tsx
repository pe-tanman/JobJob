"use client";

import * as Checkbox from "@radix-ui/react-checkbox";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Check, Plus, X } from "@phosphor-icons/react";
import { useId, useState } from "react";
import type { Prefs } from "@/lib/prefs";
import { roleLabel } from "@/rank/features";

type FieldProps = { value: Prefs; onChange: (next: Prefs) => void };

const ROLE_ORDER = [
  "software_engineering",
  "machine_learning_ai",
  "data_science_analytics",
  "product_management",
  "design_ux",
  "infrastructure_security",
  "hardware_electrical",
  "mechanical_aerospace_civil",
  "quant_trading",
  "research_science",
  "finance_accounting",
  "consulting_strategy",
  "marketing_content",
  "sales_business_development",
  "operations_supply_chain",
  "people_legal_policy",
];

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function CheckChip({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  // The chip is the checkbox; its text is its accessible name.
  return (
    <Checkbox.Root checked={checked} onCheckedChange={onToggle} className="chip">
      <Checkbox.Indicator>
        <Check size={16} weight="bold" aria-hidden />
      </Checkbox.Indicator>
      {label}
    </Checkbox.Root>
  );
}

export function RolesField({ value, onChange }: FieldProps) {
  return (
    <fieldset className="grid gap-3">
      <legend className="field-label mb-1">Pick every kind of work you would enjoy</legend>
      <p className="field-help">Choose none to see everything. You can change this later.</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {ROLE_ORDER.map((r) => (
          <CheckChip
            key={r}
            label={roleLabel(r)}
            checked={value.roles.includes(r)}
            onToggle={() => onChange({ ...value, roles: toggle(value.roles, r) })}
          />
        ))}
      </div>
    </fieldset>
  );
}

const SEASONS = [
  ["summer", "Summer"],
  ["fall", "Fall term"],
  ["winter_spring", "Winter or spring term"],
  ["year_round", "Part-time during school"],
] as const;

export function WhenField({ value, onChange }: FieldProps) {
  return (
    <fieldset className="grid gap-3">
      <legend className="field-label mb-1">When could you intern?</legend>
      <p className="field-help">Pick all that work. Postings that do not say are always included.</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {SEASONS.map(([k, label]) => (
          <CheckChip
            key={k}
            label={label}
            checked={value.seasons.includes(k)}
            onToggle={() => onChange({ ...value, seasons: toggle(value.seasons, k) })}
          />
        ))}
      </div>
    </fieldset>
  );
}

const MODES = [
  ["onsite", "In person"],
  ["hybrid", "Hybrid"],
  ["remote", "Remote"],
] as const;

const POPULAR_CITIES = ["New York, NY", "San Francisco, CA", "Seattle, WA", "Austin, TX", "Boston, MA", "Chicago, IL"];

export function WhereField({ value, onChange }: FieldProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();

  function add(city: string) {
    const c = city.trim();
    if (!c) return;
    if (c.length > 60) return setError("That is longer than a city name. Try just the city.");
    if (value.locations.some((l) => l.toLowerCase() === c.toLowerCase())) return setError(`${c} is already on your list.`);
    if (value.locations.length >= 12) return setError("You can add up to 12 places.");
    setError("");
    onChange({ ...value, locations: [...value.locations, c] });
    setDraft("");
  }

  return (
    <div className="grid gap-8">
      <fieldset className="grid gap-3">
        <legend className="field-label mb-1">How do you want to work?</legend>
        <div className="flex flex-wrap gap-2">
          {MODES.map(([k, label]) => (
            <CheckChip
              key={k}
              label={label}
              checked={value.workModes.includes(k)}
              onToggle={() => onChange({ ...value, workModes: toggle(value.workModes, k) })}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <label htmlFor={inputId} className="field-label">
          Cities you would work in
        </label>
        <p id={helpId} className="field-help">
          Leave empty to include every location. Remote roles are included when you pick Remote.
        </p>
        <div className="flex gap-2">
          <input
            id={inputId}
            className="input"
            value={draft}
            autoComplete="address-level2"
            aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
            aria-invalid={!!error}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
          />
          <button type="button" className="btn-quiet shrink-0" onClick={() => add(draft)}>
            <Plus size={18} aria-hidden />
            Add
          </button>
        </div>
        {error && (
          <p id={errorId} className="field-error" role="alert">
            {error}
          </p>
        )}
        {value.locations.length > 0 && (
          <ul aria-label="Your cities" className="flex flex-wrap gap-2 pt-1">
            {value.locations.map((l) => (
              <li key={l}>
                <button
                  type="button"
                  data-state="on"
                  className="chip"
                  onClick={() => onChange({ ...value, locations: value.locations.filter((x) => x !== l) })}
                  aria-label={`Remove ${l}`}
                >
                  {l}
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="field-help">Quick add:</span>
          {POPULAR_CITIES.filter((c) => !value.locations.includes(c)).map((c) => (
            <button key={c} type="button" className="btn-ghost min-h-11 px-3 text-sm font-medium underline underline-offset-4" onClick={() => add(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const YEARS = [
  ["early_undergrad", "First or second year"],
  ["late_undergrad", "Third year or later"],
  ["graduate", "Master's or PhD"],
  ["any", "Rather not say"],
] as const;

function SwitchRow({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  const helpId = useId();
  return (
    <div className="flex items-start gap-4">
      <Checkbox.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        aria-describedby={helpId}
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border-2 border-line-strong bg-sky-1 text-on-accent data-[state=checked]:border-accent data-[state=checked]:bg-accent"
      >
        <Checkbox.Indicator>
          <Check size={16} weight="bold" aria-hidden />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <div className="grid gap-1">
        <label htmlFor={id} className="field-label cursor-pointer">
          {label}
        </label>
        <p id={helpId} className="field-help">
          {help}
        </p>
      </div>
    </div>
  );
}

export function ConstraintsField({ value, onChange }: FieldProps) {
  return (
    <div className="grid gap-8">
      <fieldset className="grid gap-3">
        <legend className="field-label mb-1">Where are you in school?</legend>
        <RadioGroup.Root
          className="flex flex-wrap gap-2"
          value={value.classYear}
          onValueChange={(v) => onChange({ ...value, classYear: v })}
        >
          {YEARS.map(([k, label]) => (
            <RadioGroup.Item key={k} value={k} className="chip">
              {label}
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </fieldset>
      <fieldset className="grid gap-5">
        <legend className="field-label mb-3">Anything we should filter out?</legend>
        <SwitchRow
          label="I will need visa sponsorship (CPT or OPT)"
          help="We hide postings that say they cannot sponsor."
          checked={value.needsSponsorship}
          onChange={(v) => onChange({ ...value, needsSponsorship: v })}
        />
        <SwitchRow
          label="I am a US citizen"
          help="Leave off to hide roles that require citizenship or a security clearance."
          checked={value.usCitizen}
          onChange={(v) => onChange({ ...value, usCitizen: v })}
        />
        <SwitchRow
          label="Only paid internships"
          help="We hide postings that say they are unpaid or for credit only."
          checked={value.paidOnly}
          onChange={(v) => onChange({ ...value, paidOnly: v })}
        />
      </fieldset>
    </div>
  );
}

export function AboutField({ value, onChange }: FieldProps) {
  const interestsId = useId();
  const skillsId = useId();
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <label htmlFor={interestsId} className="field-label">
          What kind of work excites you?
        </label>
        <p id={`${interestsId}-help`} className="field-help">
          A few sentences in your own words. This is the most useful thing you can tell us.
        </p>
        <textarea
          id={interestsId}
          className="input min-h-32 resize-y"
          maxLength={1500}
          aria-describedby={`${interestsId}-help`}
          value={value.interests}
          onChange={(e) => onChange({ ...value, interests: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor={skillsId} className="field-label">
          Skills and experience <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <p id={`${skillsId}-help`} className="field-help">
          Paste the skills section of your resume, or list classes and projects.
        </p>
        <textarea
          id={skillsId}
          className="input min-h-28 resize-y"
          maxLength={1500}
          aria-describedby={`${skillsId}-help`}
          value={value.skills}
          onChange={(e) => onChange({ ...value, skills: e.target.value })}
        />
      </div>
    </div>
  );
}
