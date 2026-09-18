import { config } from "./config.js";
import { openai } from "./clients.js";
import { findMovies, type Movie } from "./retrieval.js";
import type { Answer, Pick } from "./ask.js";

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type AskFn = (question: string, history: ChatTurn[]) => Promise<Answer>;

const SYSTEM_PROMPT = `You are MovieX, a movie recommender. Only recommend movies from the CANDIDATES list. Never mention any other film.

Reply with JSON only, in exactly this shape:
{
  "answer": "two or three sentences answering the user in a warm, specific voice. Plain prose, no lists. Name at most two titles.",
  "picks": [{ "tmdbId": 123, "why": "one sentence under 15 words on why it fits" }]
}

Include up to 4 picks, best first. Only use tmdbId values from CANDIDATES.`;

// Search Pinecone for matching movies, then ask the model to explain them.
export async function askWithSearch(question: string, history: ChatTurn[]): Promise<Answer> {
  const movies = await findMovies(question);

  if (movies.length === 0) {
    return {
      text: "I couldn't find anything close to that in the catalog. Try describing the mood or a film you liked.",
      picks: [],
    };
  }

  const response = await openai.responses.create({
    model: config.openai.chatModel,
    instructions: SYSTEM_PROMPT,
    input: [
      ...history.slice(-6).map((turn) => ({ role: turn.role, content: turn.text })),
      // OpenAI requires the word "json" in the input when asking for JSON output.
      { role: "user" as const, content: `${question}\n\nCANDIDATES:\n${describeMovies(movies)}\n\nReply in JSON.` },
    ],
    text: { format: { type: "json_object" } },
    max_output_tokens: 600,
  });

  return parseAnswer(response.output_text, movies);
}

function describeMovies(movies: Movie[]): string {
  return movies
    .map((m) => `- tmdbId ${m.tmdbId}: ${m.title}${m.year ? ` (${m.year})` : ""}. ${m.description}`)
    .join("\n");
}

// Reads the model's JSON. Falls back to the search results if anything is off.
function parseAnswer(raw: string, movies: Movie[]): Answer {
  try {
    const parsed = JSON.parse(raw);
    const text = typeof parsed.answer === "string" ? parsed.answer.trim() : "";

    const picks: Pick[] = [];
    for (const item of parsed.picks ?? []) {
      const movie = movies.find((m) => m.tmdbId === Number(item.tmdbId));
      const alreadyAdded = picks.some((p) => p.tmdbId === movie?.tmdbId);
      if (movie && !alreadyAdded && typeof item.why === "string") {
        picks.push({ tmdbId: movie.tmdbId, why: item.why.trim() });
      }
    }

    if (text && picks.length > 0) return { text, picks };
  } catch {
    console.warn("Model did not return valid JSON, using search results instead.");
  }

  return {
    text: "Here are the closest matches I found.",
    picks: movies.map((m) => ({ tmdbId: m.tmdbId, why: `A close match: ${m.genres.slice(0, 2).join(", ") || "recommended"}.` })),
  };
}
