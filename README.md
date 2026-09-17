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
| `PINECONE_API_KEY` | | Pinecone key (semantic search) |
| `PINECONE_INDEX` | | index name, e.g. `moviex` |
| `PINECONE_NAMESPACE` | default namespace | namespace holding the movie vectors, e.g. `dev` |
| `OPENAI_API_KEY` | | embeddings and answer generation |
| `OPENAI_CHAT_MODEL` | `gpt-5.4` | chat model for the answer |
| `OPENAI_EMBED_MODEL` | `text-embedding-3-small` | must match the model used to build the index |

## Endpoints

| Route | Description |
|---|---|
| `GET /health` | uptime check |
| `GET /api/movies/popular` | TMDB popular movies |
| `GET /api/movies/search?q=` | TMDB movie search |
| `GET /api/movies/:id` | TMDB movie details |
| `GET /api/movies/:id/videos` | TMDB videos (trailers) |
| `POST /api/ask` | chat recommendations, streamed as ndjson `{text}` → `{picks}` → `{done}` |

TMDB responses pass through unchanged. `/api/ask` takes `{"question": string, "history": [{"role","text"}]}`.

## How `/api/ask` works

1. `src/retrieval.ts` turns the question into a vector with OpenAI and asks Pinecone for the closest movies.
2. `src/recommender.ts` gives those movies to the OpenAI chat model. The model answers with a JSON line of picks (`{tmdbId, why}`) followed by a short paragraph.
3. The paragraph streams to the client as `text` events, then the picks go out as one `picks` event, then `done`. If the JSON line is broken, the picks fall back to the search results.

If `PINECONE_API_KEY`, `PINECONE_INDEX`, or `OPENAI_API_KEY` is missing, the route uses the canned answers in `src/ask.ts` instead, so local dev works without keys.

Expected vector metadata: `tmdb_id`, `title`, `text`, `genres`, `year` (the vector id is also accepted as the TMDB id).

## Deploy

```bash
npm run build && npm start
```

Set `TMDB_API_KEY` and `CLIENT_ORIGIN` (the site's origin) on the host. Point the frontend's `NEXT_PUBLIC_API_URL` at this server.
# moviex-backend
