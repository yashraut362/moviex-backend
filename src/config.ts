import dotenv from "dotenv";

// .env is local-only (gitignored) and wins over inherited shell vars,
// so a PORT set by a parent tool can't collide with the Next.js dev server.
// In production there is no .env file and the host's env applies as usual.
dotenv.config({ override: true, quiet: true });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
  tmdbApiKey: process.env.TMDB_API_KEY ?? "",
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY ?? "",
    index: process.env.PINECONE_INDEX ?? "",
    namespace: process.env.PINECONE_NAMESPACE ?? "",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-5.4",
    embedModel: process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small",
  },
};

export const semanticSearchConfigured = () =>
  Boolean(config.pinecone.apiKey && config.pinecone.index && config.openai.apiKey);
