import { Router } from "express";
import { answerFor, type AskEvent } from "../ask.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function askRouter({ delayMs = 40 }: { delayMs?: number } = {}) {
  const router = Router();

  router.post("/", async (req, res) => {
    const question = (req.body as { question?: unknown } | undefined)?.question;
    if (typeof question !== "string" || question.trim() === "") {
      res.status(400).json({ error: "missing question" });
      return;
    }

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders();
    const write = (event: AskEvent) => res.write(JSON.stringify(event) + "\n");

    const answer = answerFor(question);
    const words = answer.text.split(" ");
    for (let i = 0; i < words.length; i++) {
      write({ type: "text", text: (i === 0 ? "" : " ") + words[i] });
      if (delayMs > 0) await sleep(delayMs);
    }
    write({ type: "picks", picks: answer.picks });
    write({ type: "done" });
    res.end();
  });

  return router;
}
