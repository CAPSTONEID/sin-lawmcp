import { login, me, errorTitle } from "/api.js";

const form = document.getElementById("form");
const email = document.getElementById("email");
const password = document.getElementById("password");
const go = document.getElementById("go");
const error = document.getElementById("error");

function nextUrl() {
  const n = new URLSearchParams(location.search).get("next");
  if (n && n.startsWith("/") && !n.startsWith("//")) return n;
  return "/";
}

// Already signed in → go through
me().then(() => { location.replace(nextUrl()); }).catch(() => {});

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  go.disabled = true;
  error.innerHTML = "";
  try {
    await login(email.value.trim(), password.value);
    location.replace(nextUrl());
  } catch (e) {
    const code = e.code || "UNAUTHENTICATED";
    error.innerHTML = `<div class="err-box"><div class="code">${code}</div><h2>${errorTitle(code)}</h2><p class="muted">${e.message || "이메일 또는 비밀번호를 확인하세요."}</p></div>`;
  } finally {
    go.disabled = false;
  }
});
