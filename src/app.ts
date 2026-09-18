import express from "express";
import cors from "cors";

import type { TmdbClient } from "./tmdb.js";
import { moviesRouter } from "./routes/movies.js";
import { askRouter } from "./routes/ask.js";
import { bookingsRouter } from "./routes/bookings.js";
import type { AskFn } from "./recommender.js";

export type AppOptions = {
  tmdb: TmdbClient;
  ask: AskFn;
  clientOrigin: string;
};

export function createApp({ tmdb, ask, clientOrigin }: AppOptions) {
  const app = express();
  app.use(cors({ origin: clientOrigin }));
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/movies", moviesRouter(tmdb));
  app.use("/api/ask", askRouter(ask));
  app.use("/api/bookings", bookingsRouter());
  return app;
}
