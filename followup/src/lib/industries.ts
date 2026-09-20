/**
 * What kind of business this is — asked once at onboarding, and now
 * changeable afterwards (src/components/BusinessProfileSection.tsx).
 *
 * A leaf module because two screens ask the same question and a second
 * copy of the list is how they start offering different answers. It was
 * private to OnboardingForm until 2026-09-20, when Settings needed it
 * too.
 *
 * This is not cosmetic. `Business.industry` is the single most important
 * input to classifyAsProspect (see its own comment: without knowing what
 * the business sells, the classifier threw away seven of a realtor's
 * real deals). A business with `industry: null` is judged by a
 * classifier working blind — which is how a photographer pitching a
 * software founder was read as a customer on 2026-09-20.
 */
export const INDUSTRIES = [
  "Real estate",
  "Mortgage brokerage",
  "Home services (contractor, cleaning, etc.)",
  "Dental / medical clinic",
  "Legal",
  "Marketing agency",
  "Other",
] as const;
