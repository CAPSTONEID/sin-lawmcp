import { describe, expect, it } from "vitest";
import { parseSearchLawText } from "./parse-research.js";

describe("parseSearchLawText", () => {
  it("reads 화학물질관리법 from MCP 화관법 expansion", () => {
    const text = [
      '검색 결과 (총 1건, 확장쿼리: "화학물질관리법"):',
      "",
      "정확매칭 (1건):",
      "1. 화학물질관리법 [현행]",
      " - 법령ID: 001089",
      " - MST: 279811",
      " - 공포일: 20130522 / 시행일: 20150101",
      " - 구분: 법률",
      "",
    ].join("\n");
    const cards = parseSearchLawText(text, "화관법");
    expect(cards).toHaveLength(1);
    expect(cards[0]?.title).toBe("화학물질관리법");
    expect(cards[0]?.officialUrl).toMatch(/^https:\/\/www\.law\.go\.kr\//);
    expect(decodeURIComponent(cards[0]?.officialUrl ?? "")).toContain("화학물질관리법");
  });
});
