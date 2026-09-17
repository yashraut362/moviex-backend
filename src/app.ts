import express from "express";
import cors from "cors";

import type { TmdbClient } from "./tmdb.js";
import { moviesRouter } from "./routes/movies.js";
import { askRouter } from "./routes/ask.js";

export type AppOptions = {
  tmdb: TmdbClient;
  clientOrigin: string;
  askDelayMs?: number;
};

export function createApp({ tmdb, clientOrigin, askDelayMs }: AppOptions) {
  const app = express();
  app.use(cors({ origin: clientOrigin }));
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/movies", moviesRouter(tmdb));
  app.use("/api/ask", askRouter({ delayMs: askDelayMs }));
  return app;
}
