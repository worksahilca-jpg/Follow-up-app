# The founder's build diary

Sahil keeps a day-by-day diary of building FollowUp, for his Instagram videos:
https://claude.ai/artifact/PbX7fBvFu1mGRKzxdtF3U7 (private to him).

**When he says "diary", or at the end of a working day, add or update that day's entry.**
Write it with the `ArtifactData` tool against that URL. One document per day, in collection
`entries`, with the Toronto date as the id (`2026-09-26`). The day number counts from Sep 1, 2026,
which is Day 1. If the day already has an entry, read it first, then update it and pass
`if_version`. Never create a second entry for the same day.

```json
{
  "date": "2026-09-26",
  "day": 26,
  "title": "Short headline, a few words",
  "summary": "One or two sentences on what the day was about.",
  "shipped": ["What got built or done, in plain words"],
  "problems": [{ "problem": "What broke or blocked us", "fix": "How it got fixed, or what we learned" }],
  "lesson": "One sentence he could say on camera.",
  "videoIdea": "A hook for a short video.",
  "prs": "#325–#327"
}
```

Rules:
- **Only what really happened.** Take it from merged PRs, commits, research files and the
  conversation itself. Never invent a feeling, a number or an outcome.
- **Plain words.** He reads this on his phone and turns it into videos.
- **Safe to post.** No customer, tester or teammate names. No emails, ids, tokens, keys,
  prices charged to a person, or anything from `.env`.
- **Include the experience, not just the code:** what was confusing, what took longer than
  expected, and what the real cause turned out to be.
- `story/main` holds the chapter summary at the top of the page. When a new chapter clearly
  begins (for example, App Review approved, or the first paying customer), add a chapter. Don't
  rewrite old chapters.
- `notes/<date>` is his own writing. Never edit it.
