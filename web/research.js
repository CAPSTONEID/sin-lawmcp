import { getHealth, research, errorTitle } from "/api.js";

const healthEl = document.getElementById("health");
const form = document.getElementById("form");
const q = document.getElementById("q");
const go = document.getElementById("go");
const results = document.getElementById("results");
const error = document.getElementById("error");
const banner = document.getElementById("banner");

function pill(ok, label) {
  return `<span class="pill ${ok ? "ok" : "down"}"><span class="dot"></span>${label}</span>`;
}

async function refreshHealth() {
  try {
    const h = await getHealth();
    healthEl.innerHTML =
      pill(h.mcp === "up", h.mcp === "up" ? "MCP 정상" : "MCP 중단") +
      pill(!!h.ocConfigured, h.ocConfigured ? "OC 정상" : "OC 없음");
    if (!h.ocConfigured) {
      error.innerHTML = `<div class="err-box"><div class="code">LAW_OC_MISSING</div><h2>${errorTitle("LAW_OC_MISSING")}</h2><p class="muted">서버 <code>.env</code>의 <code>LAW_OC</code>만 설정하세요. 키는 화면에 표시되지 않습니다. 결과 없음 화면이 아닙니다.</p></div>`;
    }
  } catch (e) {
    healthEl.innerHTML = pill(false, "API 끊김");
  }
}

function renderError(e) {
  const code = e.code || "INTERNAL";
  const cls = code === "MCP_UNAVAILABLE" ? "mcp" : code === "UPSTREAM_LAW_GO_KR" ? "upstream" : "";
  error.innerHTML = `<div class="err-box ${cls}"><div class="code">${code}</div><h2>${errorTitle(code)}</h2><p class="muted">${e.message || ""}</p></div>`;
  results.innerHTML = "";
  banner.innerHTML = "";
}

function card(c) {
  const kind = c.kind === "precedent" ? "판례" : "법령";
  return `<article class="card">
    <div class="card-head"><span class="kind">${kind}</span></div>
    <h3>${escapeHtml(c.title || "")}</h3>
    <div class="article">${escapeHtml(c.citation || "")}</div>
    <p class="excerpt">${escapeHtml(c.summary || "")}</p>
    <a class="orig" href="${escapeAttr(c.officialUrl)}" target="_blank" rel="noopener">법제처 원문 <span class="url">${escapeHtml(c.officialUrl || "")}</span></a>
  </article>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[ch]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/`/g, ""); }

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const query = q.value.trim();
  if (!query) return;
  go.disabled = true;
  form.classList.add("busy");
  error.innerHTML = "";
  banner.innerHTML = "";
  results.innerHTML = `<p class="muted">검색 중…</p>`;
  try {
    const data = await research(query);
    if (data.status === "partial") {
      banner.innerHTML = `<div class="banner partial" role="status"><strong>부분 결과</strong> — 일부 브랜치만 성공했습니다. 결과 없음이 아닙니다.</div>`;
    }
    const list = Array.isArray(data.results) ? data.results : [];
    if (!list.length) {
      results.innerHTML = `<p class="muted">카드 0건. (장애 화면과 다릅니다 — API가 성공 응답을 준 경우)</p>`;
    } else {
      results.innerHTML = list.map(card).join("");
    }
  } catch (e) {
    renderError(e);
  } finally {
    go.disabled = false;
    form.classList.remove("busy");
  }
});

refreshHealth();
