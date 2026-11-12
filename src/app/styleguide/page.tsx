import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Field } from '@/components/field';
import { BellIcon, CameraIcon, CloseIcon, MenuIcon, PlusIcon } from '@/components/icons';
import { Meter } from '@/components/meter';
import { budgetState } from '@/lib/budget-state';
import { Money } from '@/components/money';
import { PageHeader } from '@/components/page-header';
import { Select } from '@/components/select';
import { StateTag } from '@/components/state-tag';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/button';
import { ButtonsDemo, DialogDemo, EmptyStateDemo, ErrorStateDemo } from './demos';

export const metadata: Metadata = { title: 'Styleguide | My Expenses' };

const TOKENS: Array<[name: string, use: string]> = [
  ['canvas', 'Page background'],
  ['surface', 'Cards, fields, dialogs'],
  ['sunken', 'Hover and disabled fills'],
  ['line', 'Dividers'],
  ['line-strong', 'Control borders'],
  ['ink', 'Text, the meter tick'],
  ['muted', 'Secondary text, On track'],
  ['accent', 'Primary action, links, focus ring'],
  ['danger', 'Destructive action, Over'],
  ['warning', 'Near limit'],
  ['meter-track', 'Meter, unused part'],
  ['meter-fill', 'Meter, used part'],
];

const AMOUNTS: Array<[label: string, sen: number]> = [
  ['Typical', 4280],
  ['Thousands', 123450],
  ['Zero', 0],
  ['Negative', -500],
];

const BUDGETS = [
  { name: 'Groceries', spent: 40000, allocation: 100000, state: 'fine' },
  { name: 'Petrol', spent: 34000, allocation: 40000, state: 'tight' },
  { name: 'Eating out', spent: 39000, allocation: 30000, state: 'over' },
] as const;

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 border-t border-line pt-8 sm:mt-16">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {note && <p className="mt-1 max-w-prose text-sm text-muted">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function StyleguidePage() {
  // A development tool. NODE_ENV is fixed at build time, so a production build
  // prerenders this route as not found.
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <PageHeader title="Styleguide" action={<ThemeToggle />} />
      <p className="mt-2 max-w-prose text-muted">
        Every shared component in each of its states. Development only: a production build returns not
        found here. Names and amounts are sample values.
      </p>

      <Section id="colour" title="Colour" note="Warm neutrals, one accent for actions and links, and two state colours that always come with a word.">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {TOKENS.map(([name, use]) => (
            <li key={name}>
              <div className="h-10 rounded-control border border-line" style={{ background: `var(--${name})` }} />
              <p className="mt-2 text-sm font-medium">{name}</p>
              <p className="text-sm text-muted">{use}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="type" title="Type" note="IBM Plex Sans. The amount that matters on a screen is the largest thing on it.">
        <div className="rounded-surface border border-line bg-surface px-5 py-6">
          <p className="text-sm text-muted">Left this month</p>
          <p className="mt-1">
            <Money sen={164250} className="text-focal font-semibold" />
          </p>
          <p className="mt-2 text-sm text-muted">
            of <Money sen={450000} /> across all budgets
          </p>
        </div>
        <dl className="mt-6 flex flex-col gap-4">
          <div>
            <dt className="text-sm text-muted">Page title, 24px semibold</dt>
            <dd className="text-2xl font-semibold">Transactions</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Section title, 18px semibold</dt>
            <dd className="text-lg font-semibold">Recent transactions</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Body, 16px</dt>
            <dd>Snap a receipt and check the details before saving.</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Label and hint, 14px</dt>
            <dd className="text-sm">Paid by card on 12 November</dd>
          </div>
        </dl>
      </Section>

      <Section id="buttons" title="Buttons" note="44px tall. Hover and press darken the fill; press also nudges the button down 1px.">
        <ButtonsDemo />
      </Section>

      <Section id="fields" title="Fields and selects" note="The label is always visible. Hint under the label, error above the control so a phone keyboard cannot hide it.">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Shop or company" name="merchant" hint="As printed on the receipt." autoComplete="off" />
          <Field label="Amount (RM)" name="amount" inputMode="decimal" defaultValue="12.5x" error="Enter an amount like 12.50." />
          <Field label="Created by" name="createdBy" defaultValue="You" disabled />
          <Select label="Budget" name="budget" defaultValue="">
            <option value="" disabled>
              Choose a budget
            </option>
            <option>Groceries</option>
            <option>Petrol</option>
            <option>School</option>
            <option>Uncategorised</option>
          </Select>
          <Select label="Payment method" name="method" defaultValue="" error="Choose how it was paid.">
            <option value="" disabled>
              Choose one
            </option>
            <option>QR</option>
            <option>Cash</option>
            <option>Card</option>
            <option>Other</option>
          </Select>
          <Select label="Month" name="month" defaultValue="2026-11" disabled>
            <option value="2026-11">November 2026</option>
          </Select>
        </div>
      </Section>

      <Section id="money" title="Money" note="Tabular figures, so amounts in a column line up digit for digit.">
        <dl className="max-w-xs divide-y divide-line rounded-surface border border-line bg-surface px-4">
          {AMOUNTS.map(([label, sen]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-muted">{label}</dt>
              <dd>
                <Money sen={sen} />
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="state" title="Budget state" note="Colour plus a word, never colour alone. On track stays neutral so problems stand out.">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <StateTag state="fine" />
          <StateTag state="tight" />
          <StateTag state="over" />
        </div>
      </Section>

      <Section id="meter" title="Meter" note="The one identity mark: a thin bar with a tick at the threshold. Budgets, the dashboard and the AI budget only.">
        <ul className="divide-y divide-line rounded-surface border border-line bg-surface px-5">
          {BUDGETS.map(({ name, spent, allocation, state }) => {
            const left = allocation - spent;
            return (
              <li key={name} className="py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{name}</span>
                  <StateTag state={state} />
                </div>
                <div className="mt-2">
                  <Meter value={spent} max={allocation} state={state} threshold={80} label={`${name} budget used`} />
                </div>
                <p className="mt-1.5 text-sm text-muted">
                  {left >= 0 ? (
                    <>
                      <Money sen={left} /> left of <Money sen={allocation} />
                    </>
                  ) : (
                    <>
                      <Money sen={-left} /> over a budget of <Money sen={allocation} />
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
        <dl className="mt-6 grid gap-5 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted">Exactly at the threshold</dt>
            <dd className="mt-2">
              <Meter value={80} max={100} state={budgetState(80, 100, 80)} threshold={80} label="At the threshold" />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">No threshold</dt>
            <dd className="mt-2">
              <Meter value={25} max={100} state={budgetState(25, 100, 80)} label="No threshold" />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Nothing allocated</dt>
            <dd className="mt-2">
              <Meter value={1000} max={0} state={budgetState(1000, 0, 80)} label="Nothing allocated" />
            </dd>
          </div>
        </dl>
      </Section>

      <Section id="empty" title="Empty state" note="Says why the view is empty and gives the one action that fills it.">
        <EmptyStateDemo />
      </Section>

      <Section id="error" title="Error state" note="Says what failed. Try again appears only when retrying can help.">
        <ErrorStateDemo />
      </Section>

      <Section id="dialog" title="Dialog" note="Native modal. Escape, the Close button and Keep it all close it; focus returns to the button that opened it.">
        <DialogDemo />
      </Section>

      <Section id="page-header" title="Page header" note="This page's own title is a page header with an action. The specimens below are inert and hidden from screen readers, so the page keeps one h1.">
        <div inert className="flex flex-col gap-4">
          <div className="rounded-surface border border-line bg-surface p-4">
            <PageHeader title="Budgets" />
          </div>
          <div className="rounded-surface border border-line bg-surface p-4">
            <PageHeader
              title="Budgets"
              action={
                <Button>
                  <PlusIcon />
                  Add a budget
                </Button>
              }
            />
          </div>
        </div>
      </Section>

      <Section id="icons" title="Icons" note="Drawn for this app, square ends to match the type. Only where an icon is faster to read than the word; an icon-only button always has a spoken name, like the dialog's Close.">
        <ul className="flex flex-wrap gap-x-8 gap-y-4">
          {(
            [
              [BellIcon, 'Bell, notifications'],
              [CameraIcon, 'Camera, scan receipt'],
              [PlusIcon, 'Plus, add'],
              [CloseIcon, 'Close'],
              [MenuIcon, 'Menu'],
            ] as const
          ).map(([Icon, name]) => (
            <li key={name} className="flex items-center gap-2">
              <Icon />
              <span className="text-sm">{name}</span>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
