// Bundles the client into one self-contained HTML body for publishing as a claude.ai artifact.
// Output: dist/artifact.html (no doctype/html/head/body: the artifact tool adds the skeleton).
import { build } from "esbuild";
import fs from "node:fs";

const js = await build({
  entryPoints: ["public/app.js"],
  bundle: true,
  format: "iife",
  minify: false,
  target: ["es2020"],
  write: false,
  legalComments: "none",
});
const bundle = js.outputFiles[0].text;
const css = fs.readFileSync("public/styles.css", "utf8");
const html = fs.readFileSync("public/index.html", "utf8");
const body = html.slice(html.indexOf("<body>") + "<body>".length, html.lastIndexOf("</body>"))
  .replace(/<script[^>]*src="\/app\.js"[^>]*><\/script>/, "")
  .replace(/<a class="skip"[^>]*>.*?<\/a>\s*/s, "");

const out = `<title>SpeakWell</title>
<style>
html, body { height: auto; }
${css}
</style>
${body.trim()}
<script>window.SPEAKWELL_MODE = "artifact";</script>
<script>
${bundle}
</script>
`;
fs.writeFileSync("dist/artifact.html", out);
console.log(`dist/artifact.html: ${(out.length / 1024).toFixed(0)} KB`);
