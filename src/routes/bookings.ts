import { Router } from "express";
import { BookingModel } from "../models/booking.js";

const ID = /^\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEAT = /^[A-Z]\d{1,2}$/;

type ShowKey = { tmdbId: number; venue: string; date: string; time: string };

// Reads the show key from a query string or a JSON body. Returns the name of
// the first invalid field, or the parsed key.
function parseShowKey(src: Record<string, unknown>): ShowKey | string {
  const tmdbId = String(src.tmdbId ?? "");
  if (!ID.test(tmdbId)) return "tmdbId";
  const { venue, date, time } = src;
  if (typeof venue !== "string" || venue.trim() === "") return "venue";
  if (typeof date !== "string" || !DATE.test(date)) return "date";
  if (typeof time !== "string" || time.trim() === "") return "time";
  return { tmdbId: Number(tmdbId), venue, date, time };
}

function parseSeats(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((s) => typeof s === "string" && SEAT.test(s))) return null;
  return [...new Set(value as string[])];
}

async function takenSeats(key: ShowKey): Promise<string[]> {
  const bookings = await BookingModel.find(key, { seats: 1 }).lean();
  return [...new Set(bookings.flatMap((b) => b.seats))];
}

export function bookingsRouter() {
  const router = Router();

  router.get("/taken", async (req, res) => {
    const key = parseShowKey(req.query as Record<string, unknown>);
    if (typeof key === "string") {
      res.status(400).json({ error: `${key} invalid` });
      return;
    }
    res.json({ seats: await takenSeats(key) });
  });

  router.post("/", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const key = parseShowKey(body);
    if (typeof key === "string") {
      res.status(400).json({ error: `${key} invalid` });
      return;
    }
    const seats = parseSeats(body.seats);
    if (!seats) {
      res.status(400).json({ error: "seats invalid" });
      return;
    }

    // Check-then-insert. A same-instant race can double book; acceptable here.
    const taken = await takenSeats(key);
    const conflict = seats.filter((s) => taken.includes(s));
    if (conflict.length > 0) {
      res.status(409).json({ error: "seats taken", seats: conflict });
      return;
    }

    const booking = await BookingModel.create({ ...key, seats });
    res.status(201).json(booking);
  });

  return router;
}
