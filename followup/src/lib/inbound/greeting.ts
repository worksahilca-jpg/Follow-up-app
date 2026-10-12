const GREETING_RE =
  /^(?:hi+|hii+|hello+|hey+|heya|hiya|hola|namaste|salam|salaam|assalamu alaikum|sat sri akal|good (?:morning|afternoon|evening))(?:\s+(?:there|team|sir|ma'?am|all|everyone))?[\s!.?,~]*$/iu;

/** "Hi", "Hello there!", "Good morning": a greeting and nothing else. Emoji are ignored. */
export function isBareGreeting(text: string): boolean {
  const words = text.replace(/\p{Extended_Pictographic}|\u200d|\ufe0f/gu, "").trim();
  return words.length > 0 && GREETING_RE.test(words);
}
