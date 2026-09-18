"""
embed_upsert.py — step 2 of the MovieX RAG project.

Reads movies.jsonl (from fetch_tmdb.py), embeds each movie's `text` with
OpenAI, and upserts the vectors + metadata into a Pinecone index.

Setup:
    pip install openai pinecone
    export OPENAI_API_KEY=...
    export PINECONE_API_KEY=...        # from app.pinecone.io

Run:
    python embed_upsert.py             # creates the index if missing, then embeds
    python embed_upsert.py             # re-run = resumes, skips what's done

Cost for 2,000 movies: about 2 cents.
"""

import json
import os
import sys
from pathlib import Path

from openai import OpenAI
from pinecone import Pinecone, ServerlessSpec

INDEX_NAME = "moviex"
NAMESPACE = "dev"                        # use "prod" later for the live site
EMBED_MODEL = "text-embedding-3-small"   # 1536 dims, cheap, good enough
DIMENSION = 1536
BATCH = 100

IN = Path("movies.jsonl")
DONE_FILE = Path("embedded_ids.txt")     # local checkpoint so re-runs skip work

oai = OpenAI()                            # reads OPENAI_API_KEY
pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))


def ensure_index():
    existing = [i["name"] for i in pc.list_indexes()]
    if INDEX_NAME not in existing:
        print(f"creating index '{INDEX_NAME}' ...")
        pc.create_index(
            name=INDEX_NAME,
            dimension=DIMENSION,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
    return pc.Index(INDEX_NAME)


def load_movies() -> list[dict]:
    if not IN.exists():
        sys.exit(f"{IN} not found. Run fetch_tmdb.py first.")
    with IN.open() as f:
        return [json.loads(line) for line in f if line.strip()]


def load_done() -> set[int]:
    if not DONE_FILE.exists():
        return set()
    return {int(x) for x in DONE_FILE.read_text().split() if x.strip()}


def embed(texts: list[str]) -> list[list[float]]:
    resp = oai.embeddings.create(model=EMBED_MODEL, input=texts)
    return [d.embedding for d in resp.data]


def to_metadata(m: dict) -> dict:
    """Keep metadata small and filter-friendly. Pinecone caps it at 40KB/vector."""
    return {
        "tmdb_id": m["tmdb_id"],
        "title": m["title"] or "",
        "year": int(m["year"]) if m.get("year") else 0,
        "genres": m.get("genres") or [],
        "language": m.get("original_language") or "",
        "vote_average": float(m.get("vote_average") or 0),
        "vote_count": int(m.get("vote_count") or 0),
        "runtime": int(m.get("runtime") or 0),
        "poster_path": m.get("poster_path") or "",
        "text": m["text"][:2000],         # keep the doc so search can show "why"
    }


def main():
    index = ensure_index()
    movies = load_movies()
    done = load_done()
    todo = [m for m in movies if m["tmdb_id"] not in done]
    print(f"{len(movies)} movies total, {len(done)} already embedded, {len(todo)} to go")

    with DONE_FILE.open("a") as done_f:
        for start in range(0, len(todo), BATCH):
            chunk = todo[start:start + BATCH]
            vectors = embed([m["text"] for m in chunk])
            index.upsert(
                vectors=[
                    {"id": str(m["tmdb_id"]), "values": v, "metadata": to_metadata(m)}
                    for m, v in zip(chunk, vectors)
                ],
                namespace=NAMESPACE,
            )
            done_f.write("\n".join(str(m["tmdb_id"]) for m in chunk) + "\n")
            done_f.flush()
            print(f"  {min(start + BATCH, len(todo))}/{len(todo)} upserted")

    stats = index.describe_index_stats()
    print(f"done. index now has {stats['total_vector_count']} vectors")


if __name__ == "__main__":
    main()
