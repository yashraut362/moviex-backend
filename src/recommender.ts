import { config } from "./config.js";
import { openai } from "./clients.js";
import { findMovies, type Movie } from "./retrieval.js";
import type { Answer } from "./ask.js";

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type AskFn = (question: string, history: ChatTurn[]) => Promise<Answer>;

const SYSTEM_PROMPT = `You are MovieX, a movie recommender. Only recommend movies from the CANDIDATES list.
Pick up to 4 of them, best first, and explain your picks in a warm, specific voice. Name at most two titles in the text.`;

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
      { role: "user" as const, content: `${question}\n\nCANDIDATES:\n${describeMovies(movies)}` },
    ],
    text: { format: answerFormat(movies) },
    max_output_tokens: 600,
  });

  // The schema guarantees this is an Answer, so no validation is needed.
  return JSON.parse(response.output_text);
}

function describeMovies(movies: Movie[]): string {
  return movies
    .map((m) => `- tmdbId ${m.tmdbId}: ${m.title}${m.year ? ` (${m.year})` : ""}. ${m.description}`)
    .join("\n");
}

// Tells the model exactly what JSON to return. tmdbId can only be one of the
// retrieved movies, so the model cannot invent a film.
function answerFormat(movies: Movie[]) {
  return {
    type: "json_schema" as const,
    name: "movie_answer",
    strict: true,
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Two or three sentences answering the user. Plain prose, no lists, no markdown.",
        },
        picks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tmdbId: { type: "number", enum: movies.map((m) => m.tmdbId) },
              why: { type: "string", description: "One sentence under 15 words on why this movie fits." },
            },
            required: ["tmdbId", "why"],
            additionalProperties: false,
          },
        },
      },
      required: ["text", "picks"],
      additionalProperties: false,
    },
  };
}
