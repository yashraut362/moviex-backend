import { Router } from "express";
import type { AskStream, ChatTurn } from "../recommender.js";

export function askRouter(ask: AskStream) {
  const router = Router();

  router.post("/", async (req, res) => {
    const question = req.body?.question;
    if (typeof question !== "string" || question.trim() === "") {
      res.status(400).json({ error: "missing question" });
      return;
    }

    // Keep only well-formed turns from the history the frontend sends.
    const history: ChatTurn[] = [];
    if (Array.isArray(req.body.history)) {
      for (const turn of req.body.history) {
        if ((turn?.role === "user" || turn?.role === "assistant") && typeof turn.text === "string") {
          history.push({ role: turn.role, text: turn.text });
        }
      }
    }

    // Stream newline-delimited JSON events to the client.
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders();

    try {
      for await (const event of ask(question, history)) {
        res.write(JSON.stringify(event) + "\n");
      }
    } catch (err) {
      console.error("ask failed:", err instanceof Error ? err.message : err);
      res.write(JSON.stringify({ type: "text", text: "Something went wrong while looking that up. Try again in a moment." }) + "\n");
      res.write(JSON.stringify({ type: "picks", picks: [] }) + "\n");
      res.write(JSON.stringify({ type: "done" }) + "\n");
    }
    res.end();
  });

  return router;
}
