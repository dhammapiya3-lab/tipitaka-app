/**
 * ATI 주제 — Access to Insight 의 Index of Subjects(CC BY 4.0)에서 뽑은 경별 주제를 사이트 자료로.
 *
 *   content/ati-subject-topics.json  경 → [{ topic(영어 제목), note(ATI 설명) }]   (scripts/extract-ati-topics.py)
 *   content/ati-topic-ko.json        영어 제목 → 한국어 이름
 *   → public/data/topics.json        { topics: [{id, ko, en, count}], suttas: { 경: [{ t, n }] } }
 *
 * 주제는 사람이 정리한 색인(ATI)을 그대로 따른다. ATI 에 번역이 있는 경(약 630개)만 다룬다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const ROOT = process.cwd();
const raw = z
  .record(
    z.string(),
    z.array(z.object({ topic: z.string().nullable(), note: z.string() })),
  )
  .parse(
    JSON.parse(
      readFileSync(path.join(ROOT, "content/ati-subject-topics.json"), "utf8"),
    ),
  );
const ko = z
  .record(z.string(), z.string())
  .parse(
    JSON.parse(
      readFileSync(path.join(ROOT, "content/ati-topic-ko.json"), "utf8"),
    ),
  );

const ids = new Map<string, string>();
const used = new Set<string>();
const idOf = (en: string) => {
  const known = ids.get(en);
  if (known) return known;
  const base =
    en
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .match(/[a-z]+/g)
      ?.slice(0, 2)
      .join("-") ?? "topic";
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  ids.set(en, id);
  return id;
};

const suttas: Record<string, { t: string; n: string }[]> = {};
const count = new Map<string, Set<string>>();
for (const [sutta, list] of Object.entries(raw)) {
  for (const { topic, note } of list) {
    if (!topic || !ko[topic]) continue; // "See each one individually:" 같은 안내 줄
    const t = idOf(topic);
    (suttas[sutta] ??= []).push({ t, n: note });
    count.set(t, (count.get(t) ?? new Set()).add(sutta));
  }
}
const topics = [...ids]
  .map(([en, id]) => ({ id, ko: ko[en], en, count: count.get(id)?.size ?? 0 }))
  .filter((t) => t.count > 0);
writeFileSync(
  path.join(ROOT, "public/data/topics.json"),
  `${JSON.stringify({ topics, suttas })}\n`,
);
console.log(`ATI 주제 ${topics.length}개 · 경 ${Object.keys(suttas).length}개`);
