/**
 * Generates src/app/theme-light.css from the dark design-system stylesheets.
 * Run with `npm run theme:generate` after editing any source CSS file.
 */
import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";

const sources = [
  "src/app/globals.css",
  "src/app/modules.css",
  "src/app/module-extra.css",
];
const output = "src/app/theme-light.css";

function parseHex(value) {
  let hex = value.slice(1);
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function toHex({ r, g, b, a }) {
  const part = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  const base = `#${part(r)}${part(g)}${part(b)}`;
  return a >= 1 ? base : `${base}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

function hslToRgb({ h, s, l }) {
  h /= 360;
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: hue(h + 1 / 3) * 255, g: hue(h) * 255, b: hue(h - 1 / 3) * 255 };
}

/** Map a dark-theme colour to its light-theme counterpart. */
function lighten(raw) {
  const rgb = parseHex(raw);
  const { h, s, l } = rgbToHsl(rgb);
  // Translucent near-black is used for shadows; keep it dark so it stays visible on white.
  if (rgb.a < 1 && l < 0.14) return toHex({ r: 26, g: 24, b: 38, a: rgb.a * 0.45 });
  const neutral = s < 0.14;
  let next;

  if (neutral) {
    const hue = s < 0.04 ? 250 : h;
    if (l < 0.075) next = { h: hue, s: 0.10, l: 0.995 };
    else if (l < 0.105) next = { h: 250, s: 0.18, l: 0.977 };
    else if (l < 0.135) next = { h: 250, s: 0.14, l: 0.957 };
    else if (l < 0.165) next = { h: 250, s: 0.12, l: 0.937 };
    else if (l < 0.215) next = { h: 250, s: 0.10, l: 0.895 };
    else if (l < 0.28) next = { h: 250, s: 0.08, l: 0.845 };
    else if (l < 0.38) next = { h: 250, s: 0.06, l: 0.77 };
    else if (l < 0.48) next = { h: 250, s: 0.05, l: 0.63 };
    else if (l < 0.60) next = { h: 250, s: 0.05, l: 0.48 };
    else if (l < 0.75) next = { h: 250, s: 0.06, l: 0.35 };
    else next = { h: 250, s: 0.10, l: 0.17 };
  } else if (l < 0.14) {
    next = { h, s: Math.min(s * 0.55, 0.35), l: 0.965 };
  } else if (l < 0.22) {
    next = { h, s: Math.min(s * 0.5, 0.38), l: 0.93 };
  } else if (l < 0.32) {
    next = { h, s: Math.min(s * 0.5, 0.4), l: 0.88 };
  } else if (l < 0.45) {
    next = { h, s: Math.min(s * 0.55, 0.45), l: 0.72 };
  } else if (l < 0.60) {
    next = { h, s: Math.min(s * 0.68, 0.56), l: 0.52 };
  } else if (l < 0.72) {
    next = { h, s: Math.min(s * 0.72, 0.62), l: 0.46 };
  } else if (l < 0.86) {
    next = { h, s: Math.min(s * 0.72, 0.6), l: 0.40 };
  } else {
    next = { h, s: Math.min(s * 0.7, 0.58), l: 0.36 };
  }

  return toHex({ ...hslToRgb(next), a: rgb.a });
}

function convertColors(css) {
  return css
    .replace(/#([0-9a-fA-F]{3,8})\b/g, (match) => lighten(match))
    .replace(/rgba\(17,\s*18,\s*20,\s*\.94\)/g, "rgba(255,255,255,.94)")
    .replace(/rgba\(154,\s*135,\s*244,\s*\.11\)/g, "rgba(118, 88, 201, .10)");
}

async function main() {
  let combined = "";
  for (const source of sources) {
    const css = await fs.readFile(path.resolve(source), "utf8");
    const cleaned = css
      .split("\n")
      .filter((line) => !/^\s*@import\b|^\s*@tailwind\b/.test(line))
      .join("\n");
    const root = postcss.parse(cleaned, { from: source });
    root.walkRules((rule) => {
      if (rule.parent?.type === "atrule" && rule.parent.name.includes("keyframes")) return;
      rule.selectors = rule.selectors.map((selector) => {
        const trimmed = selector.trim();
        if (trimmed === ":root" || trimmed.startsWith(":root ")) {
          return `[data-theme="light"]${trimmed.slice(5)}`;
        }
        return `[data-theme="light"] ${trimmed}`;
      });
    });
    combined += `${root.toString()}\n`;
  }

  const polish = `
/* Light-mode overrides that the mechanical transform can't express cleanly. */
[data-theme="light"] {
  color-scheme: light;
  --accent: #7658c9;
  --accent-strong: #6a4fc0;
  --accent-wash: rgba(118, 88, 201, .10);
}
[data-theme="light"] .primary-button,
[data-theme="light"] .account-primary {
  border-color: #7658c9;
  background: #8163d4;
  color: #fff;
}
[data-theme="light"] .primary-button:hover,
[data-theme="light"] .account-primary:hover { background: #6f51bf; }
[data-theme="light"] .profile-avatar,
[data-theme="light"] .top-avatar,
[data-theme="light"] .workspace-avatar {
  border-color: #d6ccf6;
  background: linear-gradient(145deg, #e9e2fb, #d8cdf6);
  color: #5b43a8;
}
[data-theme="light"] .completion-ring { background: conic-gradient(#8163d4 var(--progress), #e6e4ee 0); }
[data-theme="light"] .completion-ring > div { background: #fff; }
[data-theme="light"] .stat-progress-track,
[data-theme="light"] .target-track,
[data-theme="light"] .mini-progress,
[data-theme="light"] .resource-progress { background: #e4e2ec; }
[data-theme="light"] .stat-progress-track span,
[data-theme="light"] .target-track span,
[data-theme="light"] .mini-progress span,
[data-theme="light"] .resource-progress i { background: linear-gradient(90deg, #7658c9, #9b82e8); }
[data-theme="light"] .chart-bar { background: #cfc9e2; }
[data-theme="light"] .chart-today { background: #8163d4; }
[data-theme="light"] :focus-visible { outline-color: #7658c9; }
[data-theme="light"] .topbar,
[data-theme="light"] .module-topbar { background: rgba(255,255,255,.94); }
[data-theme="light"] .brand-mark {
  border-color: #d6ccf6;
  background: #eee8fb;
  color: #5b43a8;
}
[data-theme="light"] .nav-item.nav-active {
  color: #4b3796;
  background: #efeafb;
}
[data-theme="light"] .nav-item.nav-active::before { background: #7658c9; }
[data-theme="light"] .nav-item.nav-active svg { color: #6a4fc0; }
[data-theme="light"] .text-button,
[data-theme="light"] .inline-link,
[data-theme="light"] .shelf-link { color: #6a4fc0; }
`;

  await fs.writeFile(path.resolve(output), `/* Generated by scripts/generate-light-theme.mjs — do not edit directly. */\n${convertColors(combined)}${polish}\n`);
  console.log(`Wrote ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
