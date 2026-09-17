# movie-x-backend

Express API for [movie-x](https://github.com/yashraut362/movie-x). It proxies TMDB so the API key stays server-side, and serves the `/ask` chat stream.

## Setup

```bash
npm install
cp .env.example .env   # fill in TMDB_API_KEY
npm run dev            # http://localhost:4000
```

Environment variables:

| Name | Default | Purpose |
|---|---|---|
| `TMDB_API_KEY` | | TMDB v3 API key (required) |
| `PORT` | `4000` | listen port |
| `CLIENT_ORIGIN` | `http://localhost:3000` | the only origin allowed by CORS |

## Endpoints

| Route | Description |
|---|---|
| `GET /health` | uptime check |
| `GET /api/movies/popular` | TMDB popular movies |
| `GET /api/movies/search?q=` | TMDB movie search |
| `GET /api/movies/:id` | TMDB movie details |
| `GET /api/movies/:id/videos` | TMDB videos (trailers) |
| `POST /api/ask` | chat recommendations, streamed as ndjson `{text}` → `{picks}` → `{done}` |

TMDB responses pass through unchanged. `/api/ask` takes `{"question": string, "history": [{"role","text"}]}`. The canned answers live in `src/ask.ts`; the real recommender replaces `answerFor()` there.

## Deploy

```bash
npm run build && npm start
```

Set `TMDB_API_KEY` and `CLIENT_ORIGIN` (the site's origin) on the host. Point the frontend's `NEXT_PUBLIC_API_URL` at this server.
