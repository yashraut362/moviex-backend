import { Router } from "express";
import type { AskFn, ChatTurn } from "../recommender.js";

export function askRouter(ask: AskFn) {
  const router = Router();

  // POST /api/ask  { question, history } -> { text, picks }
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

    try {
      res.json(await ask(question, history));
    } catch (err) {
      console.error("ask failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "recommendation failed" });
    }
  });

  return router;
}
