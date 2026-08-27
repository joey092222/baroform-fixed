/**
 * Downloads the survey cover photo packs from Pexels.
 *
 * Covers are picked at render time by `app/ux/survey-cover.ts` from a fixed pack
 * per category, so the app never calls Pexels: this script runs by hand when the
 * packs need refreshing. Search terms live in `coverSearchTerms` — one source of
 * truth for both the pack and the code that reads it.
 *
 *   node scripts/fetch-cover-packs.mjs [--dry]
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const PACK_SIZE = 8;

/**
 * Photos Pexels ranks highly for a query they have nothing to do with.
 * 16758828 is a mallard duck returned as the #1 hit for "university lecture
 * hall students" — it landed in two packs before anyone looked at them.
 * Add an id here when a search result is plainly off-topic.
 */
const BLOCK = new Set(["16758828"]);
const OUT = "public/covers";
const DRY = process.argv.includes("--dry");
// --only course,club → 그 카테고리만 다시 받습니다. 나머지 팩과 크레딧은 그대로 둡니다.
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice("--only=".length).split(",").filter(Boolean) : null;

// Kept in sync with app/ux/survey-cover.ts — Korean first (Pexels matches it
// natively via locale=ko-KR and returns better campus frames than English does).
const TERMS = {
  course: ["대학 강의실", "도서관에서 공부하는 학생", "캠퍼스 수업", "university lecture hall students"],
  club: ["대학 동아리", "밴드 공연", "students celebrating together", "student club activity"],
  research: ["실험실", "연구 자료", "laboratory research", "data analysis"],
  campus: ["대학 캠퍼스", "도서관", "학생식당", "university campus students"],
  career: ["면접", "사무실 회의", "job interview", "office desk work"],
  other: ["도시 거리", "카페 창가", "everyday city life", "abstract texture"],
};

async function readKey() {
  const env = await readFile(".env.local", "utf8");
  const line = env.split("\n").find((row) => row.startsWith("PEXELS_API_KEY="));
  const key = line?.slice("PEXELS_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error(".env.local 에 PEXELS_API_KEY 가 없습니다");
  return key;
}

async function search(key, query) {
  const url =
    "https://api.pexels.com/v1/search?" +
    new URLSearchParams({
      query,
      locale: "ko-KR",
      orientation: "landscape",
      size: "medium",
      per_page: "12",
    });
  const response = await fetch(url, { headers: { Authorization: key } });
  if (!response.ok) throw new Error(`검색 실패 ${response.status} — ${query}`);
  const body = await response.json();
  return body.photos ?? [];
}

const key = await readKey();
const credits = [];
let written = 0;

for (const [category, terms] of Object.entries(TERMS)) {
  if (ONLY && !ONLY.includes(category)) continue;
  const picked = [];
  const seen = new Set();
  // Fill round-robin across the terms rather than draining the first one: eight
  // frames from a single query all look like the same shoot.
  const quota = Math.ceil(PACK_SIZE / terms.length);
  const pools = [];
  for (const term of terms) {
    pools.push({ term, photos: await search(key, term) });
  }
  const take = (limit) => {
    for (const pool of pools) {
      let taken = 0;
      for (const photo of pool.photos) {
        if (picked.length >= PACK_SIZE || taken >= limit) break;
        if (seen.has(photo.id) || BLOCK.has(String(photo.id))) continue;
        // One photographer at most twice per pack, so a pack never reads as one shoot.
        const owner = String(photo.photographer_id);
        if (picked.filter((p) => String(p.photographer_id) === owner).length >= 2) continue;
        seen.add(photo.id);
        picked.push({ ...photo, term: pool.term });
        taken += 1;
      }
    }
  };
  take(quota);
  if (picked.length < PACK_SIZE) take(PACK_SIZE); // top up if some term came back thin
  if (picked.length < PACK_SIZE) {
    console.warn(`⚠ ${category}: ${picked.length}/${PACK_SIZE}장만 확보 — 검색어를 늘려야 합니다`);
  }
  if (!DRY) await mkdir(join(OUT, category), { recursive: true });
  for (const [index, photo] of picked.entries()) {
    const src = photo.src?.large ?? photo.src?.medium;
    console.log(`${category}/${index}.jpg  ← ${photo.term}  · ${photo.photographer}`);
    credits.push({
      file: `${category}/${index}.jpg`,
      term: photo.term,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      photoUrl: photo.url,
      alt: photo.alt ?? "",
    });
    if (DRY) continue;
    const image = await fetch(src);
    if (!image.ok) { console.warn(`  ✗ 내려받기 실패 ${image.status}`); continue; }
    await writeFile(join(OUT, category, `${index}.jpg`), Buffer.from(await image.arrayBuffer()));
    written += 1;
  }
}

if (!DRY) {
  // Pexels asks for photographer credit; this file is what the footer notice points at.
  // A partial run must merge, not clobber the categories it skipped.
  let merged = credits;
  if (ONLY) {
    let existing = [];
    try { existing = JSON.parse(await readFile(join(OUT, "credits.json"), "utf8")); } catch {}
    const touched = new Set(credits.map((c) => c.file));
    merged = [...existing.filter((c) => !touched.has(c.file)), ...credits].sort((a, b) =>
      a.file.localeCompare(b.file),
    );
  }
  await writeFile(join(OUT, "credits.json"), `${JSON.stringify(merged, null, 2)}\n`);
}
console.log(`\n${DRY ? "(dry) " : ""}사진 ${written}장 · 크레딧 ${credits.length}건`);
