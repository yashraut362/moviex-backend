// Canned answers for POST /api/ask. This is the one file the real
// recommender (retrieve → prompt → generate) replaces later. Keep
// answerFor()'s signature and the AskEvent shape stable.

export type Pick = { tmdbId: number; why: string };

export type AskEvent =
  | { type: "text"; text: string }
  | { type: "picks"; picks: Pick[] }
  | { type: "done" };

export type CannedAnswer = { text: string; picks: Pick[] };

type Rule = CannedAnswer & { match: RegExp };

const CANNED: Rule[] = [
  {
    match: /\b(food|cook|chef|restaurant|kitchen|eat)\b/i,
    text:
      "Food movies split into two moods: warm ones where cooking is how people say what they can't, and sharp ones where the kitchen is a pressure cooker. Here's a mix of both.",
    picks: [
      { tmdbId: 212778, why: "A chef quits fine dining for a food truck. Pure comfort." },
      { tmdbId: 2062, why: "The rat who wants to cook. Still the best film about taste." },
      { tmdbId: 593643, why: "A tasting menu that turns into a thriller. Darkly funny." },
      { tmdbId: 80767, why: "A quiet documentary about an 85-year-old sushi master." },
    ],
  },
  {
    match: /\b(korean|korea|bong|park chan)\b/i,
    text:
      "Korean cinema is great at switching genres mid-scene, so these swing between funny, tense, and brutal without warning. Start with Parasite if you haven't seen it.",
    picks: [
      { tmdbId: 496243, why: "A poor family cons its way into a rich one. Then it turns." },
      { tmdbId: 670, why: "Fifteen years locked in a room with no explanation. Revenge follows." },
      { tmdbId: 11423, why: "Two detectives chase a serial killer in 1980s rural Korea." },
      { tmdbId: 290098, why: "A con artist, an heiress, and a plot that folds three times." },
    ],
  },
  {
    match: /.*/,
    text:
      "If you want something tense that rewards attention, these four are all slow-burn thrillers where the dread builds scene by scene rather than through jump scares.",
    picks: [
      { tmdbId: 146233, why: "A father hunts for his missing daughter and crosses every line." },
      { tmdbId: 1949, why: "An unsolved case that consumes everyone who touches it." },
      { tmdbId: 210577, why: "A wife vanishes. The husband looks guilty. It's not that simple." },
      { tmdbId: 242582, why: "A freelance crime videographer with no limits. Gyllenhaal is chilling." },
    ],
  },
];

export function answerFor(question: string): CannedAnswer {
  const rule = CANNED.find((c) => c.match.test(question)) ?? CANNED[CANNED.length - 1];
  return { text: rule.text, picks: rule.picks };
}
