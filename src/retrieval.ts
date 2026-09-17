import { config } from "./config.js";
import { openai, movieIndex } from "./clients.js";

export type Movie = {
  tmdbId: number;
  title: string;
  year: number | null;
  genres: string[];
  description: string;
};

// Finds the movies in Pinecone that are closest in meaning to the question.
export async function findMovies(question: string, limit = 4): Promise<Movie[]> {
  // 1. Turn the question into a vector.
  const embedding = await openai.embeddings.create({
    model: config.openai.embedModel,
    input: question,
  });
  const vector = embedding.data[0].embedding;

  // 2. Ask Pinecone for the nearest movies. We ask for a few extra in case of duplicates.
  const result = await movieIndex.query({ vector, topK: limit * 2, includeMetadata: true });

  // 3. Turn the raw matches into plain movie objects.
  const movies: Movie[] = [];
  for (const match of result.matches ?? []) {
    const meta: any = match.metadata ?? {};
    const tmdbId = Number(meta.tmdb_id ?? match.id);
    if (!tmdbId || movies.some((m) => m.tmdbId === tmdbId)) continue;

    movies.push({
      tmdbId,
      title: meta.title ?? `Movie ${tmdbId}`,
      year: meta.year ? Number(meta.year) : null,
      genres: Array.isArray(meta.genres) ? meta.genres : [],
      description: meta.text ?? "",
    });
    if (movies.length === limit) break;
  }
  return movies;
}
