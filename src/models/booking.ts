import { Schema, model, type InferSchemaType } from "mongoose";

// One document per booking. Venues, showtimes and the seat grid are
// hardcoded on the frontend; the backend only remembers who took what.
const bookingSchema = new Schema(
  {
    tmdbId: { type: Number, required: true },
    venue: { type: String, required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    time: { type: String, required: true }, // "7:00 PM", as the frontend sends it
    seats: { type: [String], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Every read and the conflict check on write look up one show.
bookingSchema.index({ tmdbId: 1, venue: 1, date: 1, time: 1 });

export type Booking = InferSchemaType<typeof bookingSchema>;
export const BookingModel = model("Booking", bookingSchema);
