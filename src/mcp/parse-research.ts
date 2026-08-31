import { lawOfficialUrl, precedentOfficialUrl } from "../official-url.js";
import type { ResearchCard } from "../types.js";

const ARTICLE_RE = /제\s*\d+\s*조(?:\s*의\s*\d+)?/;

export function articleFromQuery(query: string): string | undefined {
  const m = query.match(ARTICLE_RE);
  return m ? m[0].replace(/\s+/g, "") : undefined;
}

export function parseSearchLawText(text: string, query = ""): ResearchCard[] {
  const jo = articleFromQuery(query);
  const cards: ResearchCard[] = [];
  const blocks = splitNumberedHits(text);
  for (const block of blocks) {
    const header = block.match(/^\d+\.\s+(.+?)\s*(?:\[현행\]|⚠️\[연혁-과거버전\]|\[연혁[^\]]*\])?\s*$/m);
    if (!header?.[1]) continue;
    const title = header[1].trim();
    if (!title) continue;
    const lawId = block.match(/법령ID:\s*(\S+)/)?.[1];
    const mst = block.match(/MST:\s*(\S+)/)?.[1];
    const prom = block.match(/공포일:\s*([^\s/]+)/)?.[1];
    const eff = block.match(/시행일:\s*(\S+)/)?.[1];
    const kind = block.match(/구분:\s*([^\n]+)/)?.[1]?.trim();
    const summary = [
      kind ? `구분 ${kind}` : null,
      prom ? `공포 ${prom}` : null,
      eff ? `시행 ${eff}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    cards.push({
      kind: "law",
      title,
      citation: jo ? `${title} ${jo}` : title,
      summary: summary || title,
      officialUrl: lawOfficialUrl(title, jo),
      id: mst || lawId,
    });
  }
  return cards;
}

function splitNumberedHits(text: string): string[] {
  const parts = text.split(/\n(?=\d+\.\s)/);
  return parts.filter((p) => /^\d+\.\s/.test(p.trimStart()) || /^\d+\.\s/.test(p));
}

export function parsePrecedentSearchText(text: string): ResearchCard[] {
  if (/\[NOT_FOUND\]/.test(text) && !/\[\d+\]/.test(text)) return [];
  const cards: ResearchCard[] = [];
  const blocks = text.split(/\n(?=\[\d+\])/);
  for (const block of blocks) {
    const header = block.match(/^\[(\d+)\]\s+(.+)$/m);
    if (!header?.[1] || !header[2]) continue;
    const id = header[1];
    const title = header[2].trim();
    const caseNumber = block.match(/사건번호:\s*([^\n]+)/)?.[1]?.trim();
    const court = block.match(/법원:\s*([^\n]+)/)?.[1]?.trim();
    const date = block.match(/선고일:\s*([^\n]+)/)?.[1]?.trim();
    const link = block.match(/링크:\s*(\S+)/)?.[1]?.trim();
    const officialUrl =
      link && /law\.go\.kr/i.test(link) ? link : precedentOfficialUrl(id);
    const summary = [court, date].filter((v) => v && v !== "N/A").join(" · ");
    cards.push({
      kind: "precedent",
      title,
      citation: caseNumber && caseNumber !== "N/A" ? caseNumber : title,
      summary: summary || title,
      officialUrl,
      id,
    });
  }
  return cards;
}

/** Numbered search_law hits, or a compact "법령명:" block (tests / other formatters). */
export function parseLawHits(text: string): ResearchCard[] {
  const numbered = parseSearchLawText(text);
  if (numbered.length > 0) return numbered;

  const name = text.match(/법령명:\s*([^\n]+)/)?.[1]?.trim();
  if (name) {
    const mst = text.match(/MST:\s*(\S+)/)?.[1];
    const url = text.match(/https?:\/\/[^\s]*law\.go\.kr[^\s]*/i)?.[0];
    return [
      {
        kind: "law",
        title: name,
        citation: name,
        summary: name,
        officialUrl: url && /law\.go\.kr/i.test(url) ? url : lawOfficialUrl(name),
        id: mst,
      },
    ];
  }
  return [];
}

export const parsePrecedentHits = parsePrecedentSearchText;
