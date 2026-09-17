import { config } from "./config.js";
import { createApp } from "./app.js";
import { createTmdbClient } from "./tmdb.js";

if (!config.tmdbApiKey) {
  console.warn("TMDB_API_KEY is not set; movie routes will fail upstream.");
}

const app = createApp({
  tmdb: createTmdbClient(config.tmdbApiKey),
  clientOrigin: config.clientOrigin,
});

app.listen(config.port, () => {
  console.log(`movie-x server listening on http://localhost:${config.port}`);
});
