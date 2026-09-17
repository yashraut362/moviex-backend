import dotenv from "dotenv";

// server/.env is local-only (gitignored) and wins over inherited shell vars,
// so a PORT set by a parent tool can't collide with the Next.js dev server.
// In production there is no .env file and the host's env applies as usual.
dotenv.config({ override: true, quiet: true });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
  tmdbApiKey: process.env.TMDB_API_KEY ?? "",
};
