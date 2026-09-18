import { Router } from "express";
import { Agent, assistant, run, setDefaultOpenAIKey, tool, user } from "@openai/agents";
import { z } from "zod";
import { config } from "./config.js";
import type { TmdbClient } from "./tmdb.js";
import { bookSeats, takenSeats } from "./routes/bookings.js";
import { shows, todayISO } from "./shows.js";

const INSTRUCTIONS = `You are MovieX's booking concierge.
Use list_now_playing for anything about what is in theatres; only name movies it returned.
Use list_shows for venues, showtimes and the seat layout; every movie plays today at every venue and showtime.
Seats are named row letter plus number, like C4. Corner seats are the first and last seat of a row.
When asked to book: pick the movie, venue, time and seats from the request, using sensible defaults (one seat, the latest showtime for "night", corner seats when asked), check is_seat_taken, then state one exact plan (movie, venue, time, seats) and ask the user to confirm it. Choose the seats yourself; do not ask the user to pick.
Only call book_seats after the user confirms the plan in their reply; never book without that.
Tool results are not remembered between messages: when the user confirms, call list_now_playing again and use its tmdbId.
Always call is_seat_taken right before book_seats, passing every candidate seat for the requested row or area in one call. If a planned seat is taken, pick the nearest free seats that still match the request, book those, and mention the change. Only report a failure when no matching seat is free.
Reply in two or three plain sentences, no lists or markdown. After booking, say exactly what was booked.
Set booking to the booking made by book_seats in this reply, otherwise null.`;

const MAX_TURNS = 8;

const Output = z.object({
  text: z.string(),
  booking: z
    .object({ tmdbId: z.number(), title: z.string(), venue: z.string(), time: z.string(), seats: z.array(z.string()) })
    .nullable(),
});

const GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary",
  18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Science Fiction", 10770: "TV Movie", 53: "Thriller",
  10752: "War", 37: "Western",
};

export function conciergeRouter(tmdb: TmdbClient) {
  setDefaultOpenAIKey(config.openai.apiKey);

  const nowPlaying = async () => {
    const { body } = await tmdb("/movie/now_playing");
    return ((body as { results?: any[] }).results ?? []).map((m) => ({
      tmdbId: m.id as number,
      title: m.title as string,
      genres: (m.genre_ids ?? []).map((id: number) => GENRES[id]).filter(Boolean),
      releaseDate: m.release_date,
      rating: m.vote_average,
      overview: String(m.overview ?? "").slice(0, 160),
    }));
  };

  const listNowPlaying = tool({
    name: "list_now_playing",
    description: "Movies currently playing in theatres: tmdbId, title, genres, release date, rating, overview.",
    parameters: z.object({}),
    execute: nowPlaying,
  });

  const listShows = tool({
    name: "list_shows",
    description: "Venues, showtimes, seat rows, seats per row and today's date. Same for every movie.",
    parameters: z.object({}),
    execute: async () => shows(),
  });

  const isSeatTaken = tool({
    name: "is_seat_taken",
    description: "Checks which of the given seats are already booked for a movie, venue and showtime today.",
    parameters: z.object({
      tmdbId: z.number(),
      venue: z.string(),
      time: z.string(),
      seats: z.array(z.string()),
    }),
    execute: async ({ tmdbId, venue, time, seats }) => {
      const taken = await takenSeats({ tmdbId, venue, date: todayISO(), time });
      return { taken: seats.filter((s) => taken.includes(s)), free: seats.filter((s) => !taken.includes(s)) };
    },
  });

  const bookSeatsTool = tool({
    name: "book_seats",
    description: "Books the given seats for a movie, venue and showtime today. Returns the booking, or the seats that were already taken.",
    parameters: z.object({
      tmdbId: z.number(),
      venue: z.string(),
      time: z.string(),
      seats: z.array(z.string()),
    }),
    execute: async ({ tmdbId, venue, time, seats }) => {
      if (!(await nowPlaying()).some((m) => m.tmdbId === tmdbId)) return { error: "unknown tmdbId, call list_now_playing" };
      const result = await bookSeats({ tmdbId, venue, date: todayISO(), time }, seats);
      return result.conflict ? { error: "seats taken", seats: result.conflict } : { booked: seats };
    },
  });

  const agent = new Agent({
    name: "MovieX concierge",
    instructions: INSTRUCTIONS,
    model: config.openai.chatModel,
    tools: [listNowPlaying, listShows, isSeatTaken, bookSeatsTool],
    outputType: Output,
  });

  const router = Router();
  router.post("/", async (req, res) => {
    const { message, history = [] } = req.body ?? {};
    if (typeof message !== "string" || !message.trim()) return void res.status(400).json({ error: "missing message" });

    const input = [
      ...history.map((t: { role: string; text: string }) => (t.role === "user" ? user(t.text) : assistant(t.text))),
      user(message),
    ];
    try {
      const result = await run(agent, input, { maxTurns: MAX_TURNS });
      res.json(result.finalOutput ?? { text: "", booking: null });
    } catch (err) {
      console.error("concierge failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "concierge failed" });
    }
  });
  return router;
}
