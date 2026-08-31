import { officialUrlFromLawCitation, precedentOfficialUrl } from "../official-url.js";
import type { VerifyItem } from "../types.js";

const ITEM_LINE = /^([✓✗⚠⌛])\uFE0F?\s+(.+)$/;
const CASE_NO = /(\d{4}[가-힣]{1,3}\d+)/;

export function parseVerifyText(text: string): VerifyItem[] {
  if (/\[NO_CITATIONS_FOUND\]/.test(text)) {
    return [
      {
        citation: "",
        verdict: "unverified",
        note: "인용을 추출하지 못해 검증기가 가동되지 않았습니다. 실존으로 처리하지 않습니다.",
      },
    ];
  }

  const items: VerifyItem[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(ITEM_LINE);
    if (!m?.[1] || !m[2]) continue;
    items.push(mapVerifyLine(m[1], m[2]));
  }

  if (items.length === 0) {
    return [
      {
        citation: "",
        verdict: "unverified",
        note: "검증기 출력을 해석하지 못했습니다. 실존으로 처리하지 않습니다.",
      },
    ];
  }
  return items;
}

export const parseVerifyOutput = parseVerifyText;

function mapVerifyLine(mark: string, body: string): VerifyItem {
  const citation = extractCitation(body);
  const note = extractNote(body);
  const officialUrl = urlForCitation(citation);

  if (/\[CONTENT_MISMATCH\]/.test(body)) {
    return { citation, verdict: "content_mismatch", officialUrl, note };
  }
  if (mark === "⌛" || /\[REPEALED(?:_REFERENCE)?\]/.test(body)) {
    return { citation, verdict: "repealed", officialUrl, note };
  }
  if (mark === "✗" || /\[NOT_FOUND\]/.test(body) || /실존불가/.test(body)) {
    return { citation, verdict: "not_found", officialUrl, note };
  }
  if (mark === "⚠" || /미확인|추출 실패|불명확|확인 실패/.test(body)) {
    return { citation, verdict: "unverified", note };
  }
  if (mark === "✓") {
    return { citation, verdict: "exists", officialUrl, note };
  }
  return {
    citation,
    verdict: "unverified",
    note: note ?? "검증 결과를 확정하지 못했습니다. 실존으로 처리하지 않습니다.",
  };
}

function extractCitation(body: string): string {
  const cut = body.split(/\s+[—–-]\s+/)[0] ?? body;
  return cut
    .replace(/\s+실존(?:\s.*)?$/u, "")
    .replace(/\s+·\s+제목 일치$/u, "")
    .trim();
}

function extractNote(body: string): string | undefined {
  const dash = body.split(/\s+[—–-]\s+/);
  if (dash.length > 1) return dash.slice(1).join(" — ").trim();
  return undefined;
}

function urlForCitation(citation: string): string | undefined {
  const fromLaw = officialUrlFromLawCitation(citation);
  if (fromLaw) return fromLaw;
  const caseNo = citation.match(CASE_NO)?.[1];
  if (caseNo) return precedentOfficialUrl(caseNo);
  return undefined;
}
