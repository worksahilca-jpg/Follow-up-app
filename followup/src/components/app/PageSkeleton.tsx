/**
 * What a page looks like while it opens (A-254). Every page under (app) is
 * fresh from the server on each visit, so a tap waits on a round trip; the
 * placeholder is what answers the tap in the meantime. It used to be one
 * shape for every page (four stat boxes and a list, from before the
 * redesign), so each tap showed a page that wasn't coming and then jumped.
 * Each place now opens in its own shape, at the same widths as the page
 * itself, so the page fills in rather than replacing what was there.
 *
 * Shapes only: no words, no numbers, nothing that could be read as data.
 */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded-[8px] bg-card-2 ${className}`} />;
}

/** One two-line row with a round initial on the left, like a Customers row. */
function PersonRow({ end = "w-6" }: { end?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2.5">
      <div className="h-8 w-8 shrink-0 rounded-full bg-card-2" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Bar className="h-3.5 w-2/5" />
        <Bar className="h-3 w-4/5" />
      </div>
      <Bar className={`h-3 ${end}`} />
    </div>
  );
}

/**
 * Announced once to screen readers; the shapes themselves are hidden from
 * them. `className` lays out the shapes, so it goes on the box that holds
 * them (a grid on the outer one would have a single child).
 */
function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className={`animate-pulse motion-reduce:animate-none ${className}`}>
        {children}
      </div>
    </div>
  );
}

/** Today: the date, the greeting, the day in numbers, and the first customer's card with its two buttons. */
export function TodaySkeleton() {
  const numbers = (
    <div className="box flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <Bar className="h-4 w-1/2" />
        <Bar className="h-3.5 w-12" />
      </div>
      <Bar className="h-2 w-full rounded-full" />
      <Bar className="h-3.5 w-4/5" />
    </div>
  );
  return (
    <Frame>
      <Bar className="h-3 w-36" />
      <Bar className="mt-2.5 h-8 w-3/4 max-w-[340px]" />
      <Bar className="mt-2.5 h-4 w-3/5 max-w-[280px]" />
      <div className="-mx-2 sm:mx-0 lg:max-w-[1040px]">
        <div className="mt-5 lg:hidden">{numbers}</div>
        <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="box flex flex-col gap-3.5 border border-ink/80 p-5">
            <Bar className="h-3 w-24" />
            <Bar className="h-3.5 w-3/5" />
            <Bar className="h-16 w-full rounded-[16px]" />
            <Bar className="h-3 w-40" />
            <div className="h-20 w-full rounded-[16px] bg-sage-soft/60" />
            <div className="flex gap-2.5 pt-1">
              <div className="h-12 w-[58%] max-w-[170px] rounded-full bg-ink/15" />
              <div className="h-12 w-[36%] max-w-[120px] rounded-full border border-line" />
            </div>
          </div>
          <div className="hidden lg:flex lg:flex-col lg:gap-6">
            {numbers}
            <Bar className="h-4 w-24" />
            <div className="box p-4">
              <PersonRow end="w-3" />
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** Customers: the title and its two round buttons, the search pill, and boxes of two-line rows. */
export function CustomersSkeleton() {
  return (
    <Frame className="max-w-[720px]">
      <div className="flex items-center justify-between gap-3">
        <Bar className="h-9 w-44" />
        <div className="flex gap-2">
          <div className="h-11 w-11 rounded-full border border-line lg:w-24" />
          <div className="h-11 w-11 rounded-full border border-line lg:w-36" />
        </div>
      </div>
      <Bar className="mt-4 h-11 w-full rounded-full" />
      <div className="mt-3 flex flex-col gap-3">
        <div className="box px-4 py-3">
          <Bar className="mb-1 mt-1 h-3 w-24" />
          <PersonRow />
          <PersonRow />
          <PersonRow />
          <PersonRow />
        </div>
        <div className="box px-4 py-3">
          <Bar className="mb-1 mt-1 h-3 w-28" />
          <PersonRow end="h-8 w-14 rounded-full" />
          <PersonRow end="h-8 w-14 rounded-full" />
        </div>
      </div>
    </Frame>
  );
}

/** One customer: on a phone a chat (their card, then messages by the thumb); on a computer the chat beside the side column. */
export function CustomerSkeleton() {
  const bubble = (side: "them" | "you", width: string) => (
    <div className={`flex ${side === "you" ? "justify-end" : "justify-start"}`}>
      <div className={`h-11 rounded-[16px] ${side === "you" ? "bg-ink/15" : "border border-line bg-card"} ${width}`} />
    </div>
  );
  return (
    <Frame className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
      <div className="min-w-0">
        <Bar className="hidden h-3.5 w-24 lg:block" />
        <div className="mt-2 flex items-center gap-2.5">
          <div className="h-[38px] w-[38px] shrink-0 rounded-full bg-card-2" />
          <div className="flex flex-1 flex-col gap-2">
            <Bar className="h-6 w-44" />
            <Bar className="h-3 w-36" />
          </div>
        </div>
        <div className="box mt-4 flex flex-col gap-3 p-5 lg:hidden">
          <Bar className="h-6 w-16 rounded-full" />
          <Bar className="h-5 w-3/4" />
          <Bar className="h-3.5 w-full" />
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {bubble("them", "w-3/4")}
          {bubble("you", "w-2/3")}
          {bubble("them", "w-1/2")}
          {bubble("you", "w-3/5")}
        </div>
        <div className="mt-6 h-12 w-full rounded-full border border-line bg-card" />
      </div>
      <div className="hidden lg:flex lg:flex-col lg:gap-5">
        <div className="box flex flex-col gap-3 p-5">
          <Bar className="h-6 w-16 rounded-full" />
          <Bar className="h-5 w-3/4" />
          <div className="grid grid-cols-3 gap-3">
            <Bar className="h-8" />
            <Bar className="h-8" />
            <Bar className="h-8" />
          </div>
          <Bar className="mt-2 h-14 w-full" />
        </div>
        <Bar className="h-3 w-16" />
        <Bar className="h-4 w-32" />
        <Bar className="h-3 w-16" />
        <Bar className="h-4 w-28" />
      </div>
    </Frame>
  );
}

/** A title and a box of rows. On a computer Settings' tree is already in the left column (Sidebar, A-257). */
function SettingsShape() {
  const row = (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0">
      <div className="h-9 w-9 shrink-0 rounded-[10px] bg-card-2" />
      <Bar className="h-4 w-2/5" />
      <div className="flex-1" />
      <Bar className="h-3 w-3" />
    </div>
  );
  return (
    <div className="max-w-[640px]">
      <Bar className="hidden h-3 w-24 lg:block" />
      <Bar className="h-9 w-40 lg:mt-3 lg:w-72" />
      <div className="box mt-5 overflow-hidden">
        {row}
        {row}
        {row}
        {row}
        {row}
      </div>
    </div>
  );
}

/** Settings as a page (a direct visit, a refresh, an email link). */
export function SettingsSkeleton() {
  return (
    <Frame>
      <SettingsShape />
    </Frame>
  );
}

/** Anywhere else: a title and rows. */
export function ListSkeleton() {
  return (
    <Frame className="max-w-[720px]">
      <Bar className="h-9 w-48" />
      <div className="box mt-5 px-4 py-3">
        <PersonRow />
        <PersonRow />
        <PersonRow />
        <PersonRow />
      </div>
    </Frame>
  );
}
