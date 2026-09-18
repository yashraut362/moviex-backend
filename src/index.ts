import mongoose from "mongoose";
import { config, semanticSearchConfigured } from "./config.js";
import { createApp } from "./app.js";
import { createTmdbClient } from "./tmdb.js";
import { answerFor } from "./ask.js";
import type { AskFn } from "./recommender.js";

if (!config.tmdbApiKey) {
  console.warn("TMDB_API_KEY is not set; movie routes will fail upstream.");
}

// Use real semantic search when the Pinecone and OpenAI keys are present,
// otherwise fall back to canned answers so local dev still works.
let ask: AskFn;
if (semanticSearchConfigured()) {
  const { askWithSearch } = await import("./recommender.js");
  ask = askWithSearch;
  console.log(`/api/ask: Pinecone "${config.pinecone.index}"/${config.pinecone.namespace || "__default__"} + ${config.openai.chatModel}`);
} else {
  ask = async (question) => answerFor(question);
  console.warn("/api/ask: PINECONE_* or OPENAI_API_KEY missing; using canned answers.");
}

// Bookings live in MongoDB; the server does not start without it.
try {
  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 5000 });
  console.log(`/api/bookings: MongoDB "${mongoose.connection.name}"`);
} catch (error) {
  console.error(`Could not connect to MongoDB (MONGODB_URI): ${(error as Error).message}`);
  process.exit(1);
}

const app = createApp({
  tmdb: createTmdbClient(config.tmdbApiKey),
  ask,
  clientOrigin: config.clientOrigin,
});

app.listen(config.port, () => {
  console.log(`movie-x server listening on http://localhost:${config.port}`);
});
