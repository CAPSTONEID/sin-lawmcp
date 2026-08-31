import { describe, expect, it } from "vitest";
import { parseVerifyText } from "./parse-verify.js";

const CHECK = "\u2713";
const CROSS = "\u2717";
const WARN = "\u26A0";
const HOUR = "\u231B";

describe("parseVerifyText", () => {
  it("maps CONTENT_MISMATCH to content_mismatch, never exists", () => {
    const items = parseVerifyText(
      CROSS + " 민법 제750조 — [CONTENT_MISMATCH] 인용 제목 '계약해제' != 실제",
    );
    expect(items[0]?.verdict).toBe("content_mismatch");
  });

  it("maps REPEALED to repealed", () => {
    const items = parseVerifyText(
      HOUR + " 국유재산관리특별회계법 제6조 — [REPEALED] 폐지된 법령입니다",
    );
    expect(items[0]?.verdict).toBe("repealed");
  });

  it("extractor fail / verifier did not run is unverified, never exists", () => {
    const none = parseVerifyText("[NO_CITATIONS_FOUND] 입력 텍스트에서 조문 인용이 발견되지 않았습니다.");
    expect(none[0]?.verdict).toBe("unverified");
    const warn = parseVerifyText(WARN + " 제750조 — 법령명 추출 실패 (앞 문맥에 법령명 명시 필요)");
    expect(warn[0]?.verdict).toBe("unverified");
  });

  it("민법 제750조 exists", () => {
    const items = parseVerifyText(CHECK + " 민법 제750조(불법행위의 내용) 실존");
    expect(items[0]?.verdict).toBe("exists");
    expect(items[0]?.officialUrl).toMatch(/law\.go\.kr/);
  });

  it("형법 제9999조 not_found", () => {
    const items = parseVerifyText(CROSS + " 형법 제9999조 — [NOT_FOUND] 해당 조문 없음");
    expect(items[0]?.verdict).toBe("not_found");
  });
});
