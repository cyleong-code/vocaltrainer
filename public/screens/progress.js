// Saved sessions and change over time. Charts only plot attempts with a real transcript for
// transcript-based measures; audio-based measures plot for every usable recording.
import { h, render, fmtDate, toast, confirmDialog, audioPlayer } from "../lib/ui.js";
import { db } from "../lib/db.js";
import { fmtSec } from "../lib/measures.js";

export async function progressScreen(root, { navigate }) {
  const sessions = (await db.listSessions()).sort((a, b) => b.createdAt - a.createdAt);
  const usable = sessions.filter((s) => s.analysis?.audio?.usable);
  const real = usable.filter((s) => s.analysis.transcript?.real);

  if (!sessions.length) {
    render(root, h("h1", {}, "Progress"), h("div", { class: "card" }, h("h2", {}, "No recordings yet"), h("p", { class: "muted" }, "Your saved attempts and how they change will appear here."), h("a", { class: "btn primary", href: "#/" }, "Record a baseline")));
    return;
  }

  const chronological = [...usable].reverse();
  render(
    root,
    h("h1", {}, "Progress"),
    h("p", { class: "muted small" }, `${sessions.length} recording${sessions.length === 1 ? "" : "s"}, all stored on this device.`),
    h("div", { class: "card" },
      h("h2", {}, "Pace over time"),
      real.length >= 2
        ? lineChart(chronological.filter((s) => s.analysis.transcript?.real).map((s) => ({ x: s.createdAt, y: s.analysis.measures.wpm, label: `${s.title} · ${s.analysis.measures.wpm} wpm` })), "words per minute")
        : h("p", { class: "small muted" }, real.length === 1 ? "One attempt with a real transcript so far. The line appears after your second." : "Pace needs a real transcript. Attempts with a demo transcript are not plotted here.")
    ),
    h("div", { class: "card" },
      h("h2", {}, "Fillers per minute"),
      real.length >= 2
        ? lineChart(chronological.filter((s) => s.analysis.transcript?.real).map((s) => ({ x: s.createdAt, y: s.analysis.measures.fillersPerMin ?? 0, label: `${s.title} · ${s.analysis.measures.fillersPerMin ?? 0}/min` })), "fillers per minute")
        : h("p", { class: "small muted" }, "Needs at least two attempts with a real transcript.")
    ),
    h("div", { class: "card" },
      h("h2", {}, "Audible pauses"),
      usable.length >= 2
        ? lineChart(chronological.map((s) => ({ x: s.createdAt, y: s.analysis.measures.pauseCount, label: `${s.title} · ${s.analysis.measures.pauseCount} pauses` })), "pauses per recording (from audio)")
        : h("p", { class: "small muted" }, "The line appears after your second recording.")
    ),
    h("div", { class: "card" },
      h("h2", {}, "All recordings"),
      h("div", { "data-testid": "session-list" }, ...sessions.map((s) => sessionItem(s, navigate, root)))
    ),
    h("div", { class: "card soft" },
      h("h3", {}, "Your data"),
      h("p", { class: "small muted" }, "Recordings never leave this browser unless you analyse one with a configured transcription service. Clearing site data in your browser also removes them."),
      h("button", { class: "btn danger block", type: "button", onClick: async () => {
        if (!(await confirmDialog("Delete every recording, all feedback and your goal? This cannot be undone."))) return;
        await db.deleteAll();
        toast("All data deleted");
        navigate("#/");
      } }, "Delete all my data")
    )
  );
}

function sessionItem(s, navigate, root) {
  const m = s.analysis?.measures;
  const real = s.analysis?.transcript?.real;
  const stats = !s.analysis?.audio?.usable
    ? "No speech detected"
    : [m.wpm != null ? `${m.wpm} wpm${real ? "" : " (demo)"}` : null, `${m.fillerCount} filler${m.fillerCount === 1 ? "" : "s"}${real ? "" : " (demo)"}`, `${m.pauseCount} pause${m.pauseCount === 1 ? "" : "s"}`, fmtSec(s.duration)].filter(Boolean).join(" · ");
  const playerSlot = h("div");
  return h("div", { class: "session-item", "data-testid": "session-item" },
    h("div", { class: "meta" },
      h("div", { class: "title" }, s.title, s.attempt > 1 ? h("span", { class: "tiny" }, ` · attempt ${s.attempt}`) : null),
      h("div", { class: "stats" }, `${fmtDate(s.createdAt)} · ${stats}`),
      playerSlot,
      h("div", { class: "row", style: "margin-top:6px" },
        h("button", { class: "btn sm ghost", type: "button", onClick: () => { playerSlot.replaceChildren(audioPlayer(s.audio, `Playback of ${s.title}`)); playerSlot.querySelector("audio").play().catch(() => {}); } }, "Play"),
        h("a", { class: "btn sm", href: `#/session/${s.id}` }, "Feedback"),
        h("button", { class: "btn sm danger", type: "button", "aria-label": `Delete ${s.title}`, onClick: async () => {
          if (!(await confirmDialog("Delete this recording? This cannot be undone."))) return;
          await db.deleteSession(s.id);
          toast("Deleted");
          progressScreen(root, { navigate });
        } }, "Delete")
      )
    )
  );
}

// Single-series line: 2px line, 8px markers, recessive grid, native tooltips, text in text tokens.
function lineChart(points, yLabel) {
  const W = 320, H = 150, padL = 34, padR = 12, padT = 12, padB = 26;
  const ys = points.map((p) => p.y ?? 0);
  const yMax = Math.max(1, ...ys) * 1.15;
  const yMin = 0;
  const xs = points.map((_, i) => i);
  const xScale = (i) => padL + (xs.length === 1 ? (W - padL - padR) / 2 : (i / (xs.length - 1)) * (W - padL - padR));
  const yScale = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB);
  const d = points.map((p, i) => `${i ? "L" : "M"}${xScale(i).toFixed(1)},${yScale(p.y ?? 0).toFixed(1)}`).join(" ");
  const ticks = [0, yMax / 2, yMax].map((v) => Math.round(v));
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "chart");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${yLabel} across ${points.length} recordings, from ${points[0].y} to ${points[points.length - 1].y}`);
  const el = (tag, attrs, text) => {
    const e = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };
  for (const t of ticks) {
    svg.append(el("line", { class: "grid", x1: padL, x2: W - padR, y1: yScale(t), y2: yScale(t) }));
    svg.append(el("text", { x: padL - 6, y: yScale(t) + 4, "text-anchor": "end" }, t));
  }
  svg.append(el("path", { class: "line", d }));
  points.forEach((p, i) => {
    const c = el("circle", { class: "dot", cx: xScale(i), cy: yScale(p.y ?? 0), r: 4.5 });
    c.append(el("title", {}, `${p.label} · ${fmtDate(p.x)}`));
    svg.append(c);
  });
  svg.append(el("text", { x: padL, y: H - 6 }, fmtDate(points[0].x)));
  svg.append(el("text", { x: W - padR, y: H - 6, "text-anchor": "end" }, fmtDate(points[points.length - 1].x)));
  return h("div", {}, svg, h("p", { class: "tiny" }, yLabel));
}
