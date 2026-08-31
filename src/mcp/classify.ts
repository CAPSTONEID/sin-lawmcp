import type { UpstreamKind } from "./types.js";

export function classifyToolText(text: string, isError?: boolean): UpstreamKind {
  const sample = text.slice(0, 4000);
  if (
    /503|timeout|timed out|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed|EXTERNAL_API_ERROR|antibot|anti-bot|location\.assign|missing root element|<!DOCTYPE html|<html|점검|사용자 정보 검증/i.test(
      sample,
    )
  ) {
    return "upstream";
  }
  if (isError && /unavailable|ECONNREFUSED|spawn/i.test(sample)) return "unavailable";
  return "ok";
}

export function looksLikeEmptySearch(text: string): boolean {
  if (/\[NOT_FOUND\]/i.test(text)) return true;
  if (/검색\s*결과\s*없|0\s*건/.test(text) && !/법령명|MST|lawId|판례/.test(text)) return true;
  return false;
}
