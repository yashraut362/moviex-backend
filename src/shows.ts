// Hardcoded world for the booking simulation: every movie plays at every
// venue at every showtime, today only. Shared by the API and the agent.
export const VENUES = ["PVR Phoenix", "INOX Nexus", "Cinepolis Seasons"];
export const SHOWTIMES = ["10:30 AM", "1:45 PM", "7:00 PM", "10:15 PM"];
export const ROWS = ["A", "B", "C", "D", "E", "F"];
export const SEATS_PER_ROW = 8;
// Seat id = row letter + seat number (1-based), e.g. "C4".

// Today's date on the server as "YYYY-MM-DD".
export const todayISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const shows = () => ({
  venues: VENUES,
  showtimes: SHOWTIMES,
  rows: ROWS,
  seatsPerRow: SEATS_PER_ROW,
  date: todayISO(),
});
