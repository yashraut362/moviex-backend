import { config } from "./config.js";
import { openai } from "./clients.js";
import { findMovies, type Movie } from "./retrieval.js";
import type { AskEvent, Pick } from "./ask.js";

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type AskStream = (question: string, history: ChatTurn[]) => AsyncGenerator<AskEvent>;

const SYSTEM_PROMPT = `You are MovieX, a movie recommender. Only recommend movies from the CANDIDATES list. Never mention any other film.

Your reply has two parts:
1. The FIRST line is a JSON array of up to 4 picks, best first, like:
   [{"tmdbId": 123, "why": "one sentence under 15 words on why it fits"}]
   Only use tmdbId values from CANDIDATES.
2. After that line, write two or three sentences answering the user in a warm, specific voice. Plain prose, no lists, no markdown. Name at most two titles.`;

// Search Pinecone for matching movies, then let the model explain them.
// Streams events in the order the chat UI expects: text, then picks, then done.
export async function* askWithSearch(question: string, history: ChatTurn[]): AsyncGenerator<AskEvent> {
  const movies = await findMovies(question);

  if (movies.length === 0) {
    yield { type: "text", text: "I couldn't find anything close to that in the catalog. Try describing the mood or a film you liked." };
    yield { type: "picks", picks: [] };
    yield { type: "done" };
    return;
  }

  const stream = await openai.responses.create({
    model: config.openai.chatModel,
    instructions: SYSTEM_PROMPT,
    input: [
      ...history.slice(-6).map((turn) => ({ role: turn.role, content: turn.text })),
      { role: "user" as const, content: `${question}\n\nCANDIDATES:\n${describeMovies(movies)}` },
    ],
    max_output_tokens: 600,
    stream: true,
  });

  // The model writes the picks JSON on the first line, then the answer text.
  // Collect until the first newline, then stream everything after it.
  let firstLine = "";
  let seenNewline = false;

  for await (const event of stream) {
    if (event.type !== "response.output_text.delta") continue;

    if (seenNewline) {
      yield { type: "text", text: event.delta };
      continue;
    }

    firstLine += event.delta;
    const newline = firstLine.indexOf("\n");
    if (newline !== -1) {
      seenNewline = true;
      const rest = firstLine.slice(newline + 1);
      firstLine = firstLine.slice(0, newline);
      if (rest) yield { type: "text", text: rest };
    }
  }

  // The model never wrote a newline, so treat everything as text.
  if (!seenNewline) yield { type: "text", text: firstLine };

  yield { type: "picks", picks: parsePicks(firstLine, movies) };
  yield { type: "done" };
}

function describeMovies(movies: Movie[]): string {
  return movies
    .map((m) => `- tmdbId ${m.tmdbId}: ${m.title}${m.year ? ` (${m.year})` : ""}. ${m.description}`)
    .join("\n");
}

// Reads the picks JSON line. Falls back to the search results if the model got it wrong.
function parsePicks(line: string, movies: Movie[]): Pick[] {
  try {
    const parsed = JSON.parse(line);
    const picks: Pick[] = [];
    for (const item of parsed) {
      const movie = movies.find((m) => m.tmdbId === Number(item.tmdbId));
      const alreadyAdded = picks.some((p) => p.tmdbId === movie?.tmdbId);
      if (movie && !alreadyAdded && typeof item.why === "string") {
        picks.push({ tmdbId: movie.tmdbId, why: item.why.trim() });
      }
    }
    if (picks.length > 0) return picks;
  } catch {
    console.warn("Model did not return valid picks JSON, using search results instead.");
  }
  return movies.map((m) => ({ tmdbId: m.tmdbId, why: `A close match: ${m.genres.slice(0, 2).join(", ") || "recommended"}.` }));
}
