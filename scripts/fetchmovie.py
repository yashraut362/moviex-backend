"""
fetch_tmdb.py — step 1 of the MovieX RAG project.

Pulls the top N movies from TMDB, enriches each with keywords + credits,
and writes one JSON object per line to movies.jsonl, including a `text`
field that's ready to embed in step 2.

Setup:
    pip install httpx
    export TMDB_API_KEY=your_v3_api_key      # from themoviedb.org/settings/api

Run:
    python fetch_tmdb.py                      # default: 2000 movies
    python fetch_tmdb.py --limit 5000
    python fetch_tmdb.py --limit 5000         # re-run = resumes, skips what's done

Output: movies.jsonl (safe to re-run; already-fetched ids are skipped)
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import httpx

API_KEY = os.environ.get("TMDB_API_KEY")
BASE = "https://api.themoviedb.org/3"
OUT = Path("movies.jsonl")

# TMDB allows roughly 40-50 requests/sec. Stay comfortably under it.
CONCURRENCY = 15
MIN_VOTES = 200          # below this, overviews get thin and results get noisy
PER_PAGE = 20            # TMDB fixed page size for /discover


def build_text(m: dict) -> str:
    """The 'profile doc' — the string we'll embed. Short, dense, human-readable."""
    parts = [f"{m['title']} ({m['year']})." if m["year"] else f"{m['title']}."]
    if m["genres"]:
        parts.append("Genres: " + ", ".join(m["genres"]) + ".")
    if m["director"]:
        parts.append(f"Directed by {m['director']}.")
    if m["cast"]:
        parts.append("Starring " + ", ".join(m["cast"][:4]) + ".")
    if m["keywords"]:
        parts.append("Keywords: " + ", ".join(m["keywords"][:12]) + ".")
    if m["tagline"]:
        parts.append(m["tagline"])
    if m["overview"]:
        parts.append(m["overview"])
    return " ".join(parts)


async def get(client: httpx.AsyncClient, path: str, **params) -> dict:
    params["api_key"] = API_KEY
    for attempt in range(5):
        r = await client.get(f"{BASE}{path}", params=params, timeout=30)
        if r.status_code == 429:                      # rate limited — back off
            wait = float(r.headers.get("Retry-After", 2))
            await asyncio.sleep(wait)
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError(f"gave up on {path}")


async def list_movie_ids(client: httpx.AsyncClient, limit: int) -> list[int]:
    """Page through /discover sorted by vote count until we have `limit` ids."""
    ids: list[int] = []
    page = 1
    while len(ids) < limit:
        data = await get(
            client, "/discover/movie",
            sort_by="vote_count.desc",
            **{"vote_count.gte": MIN_VOTES},
            include_adult="false",
            page=page,
        )
        results = data.get("results", [])
        if not results:
            break
        ids.extend(m["id"] for m in results)
        page += 1
        if page > data.get("total_pages", 500) or page > 500:
            break
    return ids[:limit]


async def fetch_movie(client: httpx.AsyncClient, sem: asyncio.Semaphore, tmdb_id: int) -> dict | None:
    async with sem:
        try:
            d = await get(client, f"/movie/{tmdb_id}", append_to_response="keywords,credits")
        except Exception as e:                        # one bad movie shouldn't kill the run
            print(f"  skip {tmdb_id}: {e}", file=sys.stderr)
            return None

    crew = d.get("credits", {}).get("crew", [])
    cast = d.get("credits", {}).get("cast", [])
    director = next((c["name"] for c in crew if c.get("job") == "Director"), None)

    m = {
        "tmdb_id": d["id"],
        "title": d.get("title"),
        "original_title": d.get("original_title"),
        "year": (d.get("release_date") or "")[:4] or None,
        "release_date": d.get("release_date"),
        "genres": [g["name"] for g in d.get("genres", [])],
        "keywords": [k["name"] for k in d.get("keywords", {}).get("keywords", [])],
        "director": director,
        "cast": [c["name"] for c in cast[:6]],
        "tagline": d.get("tagline") or "",
        "overview": d.get("overview") or "",
        "runtime": d.get("runtime"),
        "original_language": d.get("original_language"),
        "vote_average": d.get("vote_average"),
        "vote_count": d.get("vote_count"),
        "popularity": d.get("popularity"),
        "poster_path": d.get("poster_path"),
    }
    m["text"] = build_text(m)
    return m


def already_done() -> set[int]:
    if not OUT.exists():
        return set()
    with OUT.open() as f:
        return {json.loads(line)["tmdb_id"] for line in f if line.strip()}


async def main(limit: int) -> None:
    if not API_KEY:
        sys.exit("TMDB_API_KEY is not set. export TMDB_API_KEY=... and re-run.")

    done = already_done()
    print(f"already have {len(done)} movies in {OUT}")

    async with httpx.AsyncClient() as client:
        print(f"listing top {limit} movie ids ...")
        ids = [i for i in await list_movie_ids(client, limit) if i not in done]
        print(f"{len(ids)} to fetch")

        sem = asyncio.Semaphore(CONCURRENCY)
        written = 0
        with OUT.open("a") as f:
            # process in chunks so progress is written even if you ctrl-c
            for start in range(0, len(ids), 100):
                chunk = ids[start:start + 100]
                results = await asyncio.gather(*(fetch_movie(client, sem, i) for i in chunk))
                for m in results:
                    if m and m["overview"]:              # skip movies with no overview
                        f.write(json.dumps(m, ensure_ascii=False) + "\n")
                        written += 1
                f.flush()
                print(f"  {min(start + 100, len(ids))}/{len(ids)} fetched, {written} written")

    print(f"done. {len(done) + written} movies in {OUT}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=2000, help="how many movies to fetch")
    asyncio.run(main(ap.parse_args().limit))