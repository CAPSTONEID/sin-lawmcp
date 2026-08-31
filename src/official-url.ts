/** Official 국가법령정보센터 (law.go.kr) URLs. Required on every research card. */

export const LAW_GO_KR = "https://www.law.go.kr";

export function lawOfficialUrl(lawName: string, jo?: string): string {
  const name = lawName.trim();
  if (!name) return `${LAW_GO_KR}/`;
  const base = `${LAW_GO_KR}/법령/${encodeURIComponent(name)}`;
  const article = jo?.replace(/\s+/g, "").trim();
  return article ? `${base}/${encodeURIComponent(article)}` : base;
}

export function precedentOfficialUrl(id: string): string {
  const seq = id.trim();
  if (!seq) return `${LAW_GO_KR}/`;
  return `${LAW_GO_KR}/LSW/precInfoP.do?precSeq=${encodeURIComponent(seq)}`;
}

const ARTICLE_IN_CITE = /^(?<name>.+?)\s+(?<jo>제\s*\d+\s*조(?:\s*의\s*\d+)?)/;

export function officialUrlFromLawCitation(citation: string): string | undefined {
  const trimmed = citation.trim();
  if (!trimmed) return undefined;
  const m = trimmed.match(ARTICLE_IN_CITE);
  if (m?.groups?.name && m.groups.jo) {
    return lawOfficialUrl(m.groups.name.replace(/[「」]/g, "").trim(), m.groups.jo);
  }
  if (/법|법률|시행령|시행규칙|조례/.test(trimmed)) {
    const name = trimmed.replace(/[「」]/g, "").replace(/\s+제\s*\d+.*$/, "").trim();
    if (name) return lawOfficialUrl(name);
  }
  return undefined;
}
