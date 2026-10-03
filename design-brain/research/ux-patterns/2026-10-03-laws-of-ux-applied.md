# Laws of UX (Jon Yablonski) applied to FollowUp's screens — 2026-10-03

**Why this exists:** the founder, after saying every screen has too much on it (R-026), asked for deep research
into "the book about the laws of UI/UX". That is *Laws of UX: Using Psychology to Design Better Products &
Services* by Jon Yablonski (O'Reilly, 2020; 2nd edition January 2024), the designer behind lawsofux.com. The
book's chapters are the ten laws below plus, in the 2nd edition, the paradox of choice, complexity bias, flow,
the paradox of the active user, accessibility and personalisation.

**Evidence quality, honestly:** the book itself and lawsofux.com are not reachable from this environment, so
every statement below comes from the author's own one-line definitions and takeaways as they appear in search
snippets of lawsofux.com, the O'Reilly chapter list, and secondary write-ups. Grade **B**: good enough to steer
design, not to quote on a screen. No statistic below is invented; where a number appears it is the author's.

**The question this answers:** which of the laws does FollowUp break today, on which screen, and what rule
does each law give us for the rebuild the founder asked for?

**Screens examined:** Today, the customer page, Settings, Inbox, Customers, as counted in
`2026-10-03-too-much-stuff-density-audit.md` (one-customer account, desktop).

---

## The laws, one by one

| # | Law (author's one line) | Where we stand | Verdict |
|---|---|---|---|
| 1 | **Jakob's Law** — users spend most of their time on other sites, so they prefer yours to work the way those do. | The thread-plus-reply on the customer page looks like mail and chat, which every owner knows. The right column (a facts table, a three-way switch, four accordions) looks like nothing an owner uses. | Left column passes. Right column fails. |
| 2 | **Fitts's Law** — time to reach a target depends on its distance and size. | Send is big and black, Review is a solid button, both easy to hit. Later and Don't send are small text links on purpose (they should be slower). On Today, the setup banner's black button sits above and competes with Review. | Passes, except the competing black button when the banner shows. |
| 3 | **Hick's Law** — decision time grows with the number and complexity of choices. Takeaways: minimise choices where response time matters; highlight the recommended option. | Today's card offers two choices (Later, Review): right. The customer page offers about ten things to click beside a reply that needs one press. Settings offers about thirty. | Today passes. Customer page and Settings fail. |
| 4 | **Miller's Law / Chunking / Working memory** — working memory holds 4–7 chunks, each fading in 20–30 seconds; chunk and group so people can scan. | Today puts five chunks (headline, start line, progress, counts, section label) above the one chunk that matters. The customer side column is fifteen items in one column. Settings is 17 rows in 6 groups plus 3 more and a link grid. | All three fail. Rule: at most five groups on a screen, and the one that matters first. |
| 5 | **Postel's Law** — be liberal in what you accept, conservative in what you send. | Import accepts loose column names (fixed again today, #420); the booking page accepts any time inside the hours; Later offers two fixed times. Outbound is conservative: one reply, held for OK. | Passes. |
| 6 | **Peak-End Rule** — people judge an experience by its peak and its end. | The peak is pressing Send and reading "Sent to Priya, from your own address." The end is "You're done for today. FollowUp keeps watching." Both exist (A-046). Everything between them is what the founder calls too much. | Passes on the two moments. The law says polish those two and let the rest go quiet. |
| 7 | **Aesthetic-Usability Effect** — people forgive minor usability problems in a design they find beautiful. | The warm wash on the reply card (A-025 as amended by R-018) is doing this work. The author's caveat: beauty hides problems in testing, so test by task, not by opinion. | Keep the wash. Test Monday's realtor on *whether he presses Send*, not on whether he likes it. |
| 8 | **Von Restorff (isolation) effect** — among similar things, the one that differs is remembered. | On the customer page three things are black: Send, the "Ask if risky" segment, the state dot's pill. On Today, when the setup banner shows, two black buttons. | Fails. Rule: exactly one black element per screen, and it is the thing to press. |
| 9 | **Tesler's Law** — every system has complexity that cannot be removed, only moved; lift it off the user. "An engineer should spend an extra week reducing complexity rather than make millions of users spend an extra minute." | FollowUp absorbs the real complexity (reading, scoring, drafting, holding, timing). Then the right column hands it back: Why it may write, What FollowUp did, Follow-up plan, How it handles, Stage, Assigned to, Language. The owner is shown the machinery to prove it exists. | Fails on the customer page. Principle 6 (show the reasoning) is satisfied by the one hold-reason line; the rest can live behind one "Details". |
| 10 | **Doherty Threshold** — keep the loop under 400 ms so neither side waits. | "Sending in 10 s … Undo" gives immediate feedback; pages show a skeleton while loading. | Passes. |
| 11 | **Cognitive load / Choice overload** (2nd ed.) — too many choices, too much thought, lack of clarity; minimise choices at any moment, especially in navigation, forms and drop-downs. | Counts, progress, labels and expanders are *extraneous* load: they ask for reading that does not change what the owner does. | Fails on Today and the customer page. |
| 12 | **Gestalt: proximity, common region, similarity, Prägnanz, uniform connectedness** — grouping by nearness, by shared boundary, by likeness; the eye reads the simplest form. | Settings uses common region correctly (bordered groups) but has too many regions to be simple. Today's five stacked lines have the same weight and the same rules between them, so Prägnanz gives the owner one grey block to read. | Partial. Rule: fewer regions; the primary group visibly different from the rest. |
| 13 | **Serial position effect** — first and last items are remembered best. | First card is the longest-waiting (A-046): right. The last thing on Today is the week line: fine. | Passes. |
| 14 | **Goal-gradient effect / Zeigarnik effect** — motivation rises nearer the goal; an open task stays in mind. | The "0 of 1 handled" bar is a goal-gradient device. It works when there is a gradient. With one to three items it is noise, and the held reply is already the open loop (Zeigarnik) that keeps the owner here. | Fails at small counts. Rule: show "N of M handled" only when M ≥ 5, and only at the foot. |
| 15 | **Occam's razor / Pareto / Paradox of the active user / Selective attention / Mental model** — fewest assumptions wins; 80% of use comes from 20% of features; nobody reads the manual; put the critical thing on the attention path; match what the user believes the system is. | 80% of use is Today → open → Send. The owner's mental model is "an assistant drafted a reply and is waiting for my OK". A dashboard with counts is a different model (a report). The explanation under the mode switch ("It writes the replies and holds them for you…") is the manual nobody reads. | The screens should look like the mental model: a note from a customer, a draft, Send. Not a report. |

**Score:** of fifteen, FollowUp passes six, partly passes two, and fails seven. Every failure is on the same
axis the founder named: things on the screen that do not change what the owner does next.

---

## The rules we build to (derived, one line each, with the law)

1. **One decision per screen** (Hick, cognitive load, mental model). The screen is the person who needs you,
   their words, the reply, Send. Everything else is one click away, never zero.
2. **Say each fact once** (Miller, Prägnanz). The headline carries the count. No line below it may repeat it.
3. **At most five groups on a screen** (Miller / working memory), the primary group first and visibly
   different from the rest (Von Restorff, Prägnanz).
4. **Exactly one black element per screen**, and it is the thing to press (Von Restorff, Fitts).
5. **Machinery behind one "Details"** (Tesler). The hold reason stays as one line (principle 6). Why-it-may-
   write, what-it-did, the plan, stage, assignment and language live behind a single link.
6. **Settings are for changing, not for reading** (Hick, Jakob). One list, grouped, no duplicate link grid, no
   status card that repeats a row; the one broken thing shows at the top, as it already does.
7. **Progress only when there is progress** (goal-gradient). "N of M handled" appears at the foot only when
   M ≥ 5. Never a bar.
8. **Keep the two moments** (peak-end): the Sent confirmation and "You're done for today". Polish them;
   make nothing else celebratory.
9. **Keep the wash** (aesthetic-usability), and test by task, never by asking "do you like it".
10. **Nothing that needs its own explanation** (paradox of the active user, principle 5). If a control needs a
    sentence under it, the control is wrong.

---

## Per screen, what the rules mean

**Today.** Headline. Then the customer rows, longest waiting first, each with their words and Review (or the
first one open with the reply and Send, as the approved phone shape does). Booked calls as one line under the
rows when one exists; nothing when none. The week line at the foot. Gone: start line, progress bar, counts
line, section label, "Nothing planned for the next seven days". The setup banner stays only when nothing can
send, and its button becomes an outline so Review keeps the one black.

**Customer page.** Left as it is: thread, reply card, Send/Edit/Don't send/Later. Right column becomes: the
hold reason (one line), waiting time, the three action buttons (We talked · Copy booking link · Email), and one
"Details" link. Behind Details: how it handles this person, why it may write, what it did, the plan, stage,
assigned to, about, not a customer, delete. Two black things become one.

**Settings.** One column. The one broken thing at the top. Then: Where customers write; How it writes;
Your business; Account; Advanced (closed). The follow-up plan card stays, since it is the thing most owners
change. Gone: the "Everything else" link grid (those pages stay reachable from Customers and the week line),
the status card that repeats the Email row, and the Pause card's explanation (Pause is a row).

**Customers.** Drop the footer count line and "More". Keep tabs, Filter, Add.

**Inbox.** No change.

**Phone.** Already approved this way (A-067). The desk follows the phone, not the other way round.

---

## What this reopens, honestly

The rules remove four approved items: A-031 (the handled line, except at M ≥ 5), A-045 (the numbers line),
A-046's start line, and A-069's side column as drawn. Each was approved alone and was reasonable alone. The
laws say they add up to the wall. The founder decides; nothing here is built until he does.

## Order of work, if approved

1. Draw Today, the customer page and Settings as boards, side by side with today's screens (A-067 rule).
2. Founder picks per board.
3. Build in that order, one PR each, each compared with its board before merge.
4. Watch the realtor on Monday (task: open Today, press Send) before step 1 if the timing allows; his eyes
   are worth more than this document.

## Sources

Grade B throughout; none read in full from here.
- O'Reilly, *Laws of UX, 2nd Edition* chapter list: https://www.oreilly.com/library/view/laws-of-ux/9781098146955/
- Jon Yablonski, "Laws of UX: the 2nd edition": https://jonyablonski.com/articles/2024/laws-of-ux-the-2nd-edition/
- lawsofux.com entries (definitions and takeaways as surfaced in search): Jakob's Law, Fitts's Law, Hick's Law,
  Miller's Law, Chunking, Working Memory, Postel's Law, Peak-End Rule, Aesthetic-Usability Effect, Von Restorff
  Effect, Tesler's Law, Doherty Threshold, Cognitive Load, Choice Overload, Law of Proximity, Law of Common
  Region, Law of Similarity, Law of Prägnanz, Law of Uniform Connectedness, Serial Position Effect,
  Goal-Gradient Effect, Zeigarnik Effect, Occam's Razor, Pareto Principle, Paradox of the Active User,
  Selective Attention, Mental Model: https://lawsofux.com/
- Nielsen's ten heuristics (1990, Nielsen and Molich), for "aesthetic and minimalist design" and "recognition
  rather than recall": https://www.nngroup.com/articles/ten-usability-heuristics/
