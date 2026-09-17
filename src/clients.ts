import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { config } from "./config.js";

// Shared API clients. Only import this file when semantic search is configured.
export const openai = new OpenAI({ apiKey: config.openai.apiKey });

export const movieIndex = new Pinecone({ apiKey: config.pinecone.apiKey })
  .index(config.pinecone.index)
  .namespace(config.pinecone.namespace);
