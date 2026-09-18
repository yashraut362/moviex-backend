import { Router, type Response } from "express";
import type { TmdbClient, TmdbResult } from "../tmdb.js";

const ID = /^\d+$/;

async function send(res: Response, result: Promise<TmdbResult>) {
  const { status, body } = await result;
  res.status(status).json(body);
}

export function moviesRouter(tmdb: TmdbClient) {
  const router = Router();

  router.get("/popular", (_req, res) => send(res, tmdb("/movie/popular")));

  router.get("/now-playing", (_req, res) => send(res, tmdb("/movie/now_playing")));

  router.get("/search", (req, res) => {
    const q = req.query.q;
    if (typeof q !== "string" || q.trim() === "") {
      res.status(400).json({ error: "missing q" });
      return;
    }
    return send(res, tmdb("/search/movie", { query: q }));
  });

  router.get("/:id", (req, res) => {
    const { id } = req.params;
    if (!ID.test(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    return send(res, tmdb(`/movie/${id}`));
  });

  router.get("/:id/videos", (req, res) => {
    const { id } = req.params;
    if (!ID.test(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    return send(res, tmdb(`/movie/${id}/videos`, { language: "en-US" }));
  });

  return router;
}
