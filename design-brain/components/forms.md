# Forms

**Principle: a form is an interrogation the user didn't ask for.** Every field must earn
its place. The best form improvement is almost always deleting a field.

## Rules

1. **Ask for the minimum.** Anything that can be collected later, in context, or inferred,
   should not be on the form.
2. **One column.** Multi-column forms cause skipped fields and break on mobile. Exception:
   genuinely paired fields (city/postcode, first/last).
3. **Labels above fields, always visible.** Placeholder-as-label fails the moment someone
   starts typing, fails for screen readers, and fails anyone who looks away mid-form.
4. **Placeholders show format, not meaning.** `+1 555 000 0000`, not "Phone number".
5. **Help text sits under the label, before the input** — it should be read before the
   user answers, not after they've got it wrong.
6. **Optional is marked, required is not.** In most FollowUp forms nearly everything is
   required, so marking optional is less visual noise. Pick one and be consistent.
7. **Validate on blur, not on keystroke.** Errors appearing while someone is still typing
   are hostile. Re-validate on submit.
8. **Errors appear next to the field**, in `--coral`, with a specific fix — never a
   summary at the top only, never "Invalid input".
9. **Never lose what was typed.** Not on error, not on navigation, not on session expiry.
10. **Autofill and input types.** `type="email"`, `type="tel"`, `autocomplete` attributes,
    correct mobile keyboards. Free, and immediately noticeable when absent.
11. **Never blame the user.** "That number doesn't look like a mobile — check the country
    code?" not "Invalid phone number."

## Save behavior

Two patterns, applied consistently:

- **Settings-style: save on change.** No Save button; the control saves immediately, shows
  a transient confirmation, and reverts with an inline error if it fails. This is the
  app's established pattern (`SourceRoutingSection.tsx`, `LeadAutomationToggle.tsx`) and
  should be kept for toggles and selects.
- **Form-style: explicit submit.** For multi-field forms where partial state is
  meaningless or where the action has consequences (sending a message, adding a lead).

**Never mix them in one panel.** A panel where some controls save instantly and others
need a button is a reliable source of lost work.

## Inputs

Text, textarea, select, checkbox, radio, toggle, date/time, search, file.

- `[TO DECIDE]` Default height, padding, radius, and border treatment — must be consistent
  across all of them. Currently styled per usage.
- Focus: the global accent ring. Keep.
- Error: `--coral` border + message. `[TO DECIDE]` whether the border changes or only the
  message appears.
- Disabled: reduced contrast + a reason.
- **Toggle vs. checkbox:** a toggle takes effect immediately; a checkbox takes effect on
  submit. Never a toggle inside a form with a Save button.

## Multi-step forms

Relevant to onboarding (`OnboardingForm.tsx`).

- Show real progress, honestly. Never a fake progress bar.
- Back must not lose data.
- Each step needs a clear reason to exist — grouping fields into steps to look simpler
  while asking the same number of questions fools nobody.
- The final step says exactly what will happen when it's completed. For FollowUp this
  matters more than usual: the end of onboarding may mean the product starts contacting
  real customers.

## Open decisions

- `[TO DECIDE]` Shared input components vs. current per-usage styling. Same argument as
  buttons — **recommended**.
- `[TO DECIDE]` Optional vs. required marking convention.
- `[TO DECIDE]` Error style: border change, message only, or both.
