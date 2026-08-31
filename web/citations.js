import { getHealth, verifyCitations, verdictLabel, errorTitle, requireSession, logout } from "/api.js";

const healthEl = document.getElementById("health");
const userEl = document.getElementById("user");
const form = document.getElementById("form");
const text = document.getElementById("text");
const go = document.getElementById("go");
const results = document.getElementById("results");
const error = document.getElementById("error");

function pill(ok, label) {
  return `<span class="pill ${ok ? "ok" : "down"}"><span class="dot"></span>${label}</span>`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[ch]));
}

async function refreshHealth() {
  try {
    const h = await getHealth();
    healthEl.innerHTML =
      pill(h.mcp === "up", h.mcp === "up" ? "MCP 정상" : "MCP 중단") +
      pill(!!h.ocConfigured, h.ocConfigured ? "OC 정상" : "OC 없음");
  } catch {
    healthEl.innerHTML = pill(false, "API 끊김");
  }
}

function itemCard(it) {
  const v = verdictLabel(it.verdict);
  const url = it.officialUrl
    ? `<a class="orig" href="${escapeHtml(it.officialUrl)}" target="_blank" rel="noopener">법제처 원문</a>`
    : "";
  return `<article class="status-card status ${v.cls}">
    <span class="badge">${escapeHtml(v.text)}</span>
    <p class="cite" style="font-weight:700;margin:0 0 6px">${escapeHtml(it.citation || "")}</p>
    <p class="muted" style="margin:0 0 8px">${escapeHtml(it.note || "")}</p>
    ${url}
  </article>`;
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const t = text.value.trim();
  if (!t) return;
  go.disabled = true;
  error.innerHTML = "";
  results.innerHTML = `<p class="muted">대조 중…</p>`;
  try {
    const data = await verifyCitations(t);
    const items = Array.isArray(data.items) ? data.items : [];
    results.innerHTML = items.length
      ? items.map(itemCard).join("")
      : `<p class="muted">추출된 인용이 없습니다.</p>`;
  } catch (e) {
    if (e.status === 401 || e.code === "UNAUTHENTICATED") {
      location.replace("/login.html?next=" + encodeURIComponent("/citations.html"));
      return;
    }
    const code = e.code || "INTERNAL";
    const cls = code === "MCP_UNAVAILABLE" ? "mcp" : "";
    error.innerHTML = `<div class="err-box ${cls}"><div class="code">${code}</div><h2>${errorTitle(code)}</h2><p class="muted">${escapeHtml(e.message || "")}</p></div>`;
    results.innerHTML = "";
  } finally {
    go.disabled = false;
  }
});

const user = await requireSession();
if (user) {
  userEl.innerHTML = `<span class="user-chip">${escapeHtml(user.email)}</span><button type="button" class="btn-ghost" id="logout">로그아웃</button>`;
  document.getElementById("logout").addEventListener("click", async () => {
    await logout().catch(() => {});
    location.replace("/login.html");
  });
  refreshHealth();
}
