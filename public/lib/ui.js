// Small DOM helpers. No framework: h() builds elements, render() swaps the screen.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function render(root, ...children) {
  root.replaceChildren();
  append(root, children);
  root.scrollTop = 0;
  window.scrollTo({ top: 0 });
}

let toastTimer;
export function toast(msg, ms = 2600) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}

export function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtClock(s) {
  s = Math.max(0, Math.floor(s));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function badgeFor(transcript) {
  if (!transcript) return h("span", { class: "badge badge-muted" }, "No transcript");
  if (transcript.source === "demo") return h("span", { class: "badge badge-demo" }, "Demo transcript");
  if (transcript.source === "browser") return h("span", { class: "badge badge-live" }, "Browser transcription");
  return h("span", { class: "badge badge-live" }, "Transcribed from audio");
}

export function audioPlayer(blob, label) {
  const url = URL.createObjectURL(blob);
  const a = h("audio", { controls: true, preload: "metadata", src: url, "aria-label": label || "Recording playback" });
  a.addEventListener("emptied", () => URL.revokeObjectURL(url), { once: true });
  return a;
}

export function confirmDialog(message) {
  return Promise.resolve(window.confirm(message));
}
