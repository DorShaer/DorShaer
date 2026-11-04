// Renders assets/profile.svg from public GitHub data. Run: GITHUB_TOKEN=... bun scripts/render.ts
const USER = "DorShaer";
const FEATURED = "Husk";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("GITHUB_TOKEN is required");

const query = `query($user: String!, $repo: String!) {
  user(login: $user) {
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
      nodes { stargazerCount }
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      contributionCalendar { totalContributions weeks { contributionDays { contributionCount } } }
    }
  }
  repository(owner: $user, name: $repo) {
    stargazerCount
    forkCount
    description
    pushedAt
    languages(first: 4, orderBy: { field: SIZE, direction: DESC }) {
      totalSize
      edges { size node { name color } }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { user: USER, repo: FEATURED } }),
});
const { data, errors } = await res.json();
if (errors) throw new Error(JSON.stringify(errors));
const u = data.user;
const r = data.repository;
const cc = u.contributionsCollection;
const stars = u.repositories.nodes.reduce((a: number, n: any) => a + n.stargazerCount, 0);
const weeks: number[] = cc.contributionCalendar.weeks.map((w: any) =>
  w.contributionDays.reduce((a: number, d: any) => a + d.contributionCount, 0),
);

// Visual constants. Width matches the README column so text renders 1:1 instead of being scaled down.
const W = 860;
const BG = "#0d1117";
const INK = "#e6edf3";
const DIM = "#8b949e";
const LINE = "#30363d";
const ACCENT = "#7b8cde";
const GREEN = "#3fb950";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n: number) => n.toLocaleString("en-US");
const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// 5x7 bitmap glyphs, drawn as rects so the hero number never depends on viewer fonts
const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ",": ["000", "000", "000", "000", "011", "001", "010"],
};
function pixelText(text: string, x: number, y: number, px: number, color: string): string {
  let out = "";
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) continue;
    g.forEach((row, ry) => {
      [...row].forEach((bit, rx) => {
        if (bit === "1") out += `<rect x="${cx + rx * px}" y="${y + ry * px}" width="${px - 1}" height="${px - 1}" fill="${color}"/>`;
      });
    });
    cx += (ch === "," ? 4 : 6) * px;
  }
  return out;
}
const pixelWidth = (text: string, px: number) => [...text].reduce((a, ch) => a + (ch === "," ? 4 : 6) * px, 0);

function label(text: string, x: number, y: number, anchor = "start", color = ACCENT, size = 12) {
  return `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" letter-spacing="1.5" fill="${color}" text-anchor="${anchor}">${esc(text.toUpperCase())}</text>`;
}
function body(text: string, x: number, y: number, size = 16, color = INK, anchor = "start", weight = 400) {
  return `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(text)}</text>`;
}
const M = 32;
const rule = (y: number, x1 = M, x2 = W - M) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${LINE}"/>`;

// Area chart of weekly contributions
function areaChart(x: number, y: number, w: number, h: number): string {
  const max = Math.max(...weeks, 1);
  const pts = weeks.map((v, i) => [x + (i / (weeks.length - 1)) * w, y + h - (v / max) * h]);
  const path = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="${x}" y1="${y + h * f}" x2="${x + w}" y2="${y + h * f}" stroke="${LINE}" stroke-dasharray="2 4"/>`).join("");
  return `${grid}<path d="${path} L${(x + w).toFixed(1)},${y + h} L${x},${y + h} Z" fill="${ACCENT}" fill-opacity="0.18"/><path d="${path}" fill="none" stroke="${ACCENT}" stroke-width="1.5"/>${rule(y + h, x, x + w)}`;
}

// Layout
let y = 0;
const parts: string[] = [];
parts.push(`<rect width="${W}" height="100%" fill="${BG}"/>`);

y = 44;
parts.push(label("FIG_000 / SECURITY ENGINEER PROFILE", M, y), label(`@${USER}`, W - M, y, "end", DIM));
y += 58;
parts.push(body("DOR SHAER", M, y, 52, INK, "start", 700));
y += 34;
parts.push(body("Security engineer who builds his own tooling.", M, y, 19));
y += 26;
parts.push(label("WEB & API PENTESTING  ·  BUG BOUNTY  ·  DAST AT BRIGHT SECURITY  ·  AI AGENT TOOLS", M, y, "start", DIM, 11));
y += 26;
parts.push(rule(y));

// Hero: contributions + chart
y += 30;
const heroPx = 13;
const chartW = 500;
const heroText = fmt(cc.contributionCalendar.totalContributions);
parts.push(label("FIG_001 / CONTRIBUTIONS, LAST 365 DAYS", M, y));
parts.push(pixelText(heroText, M, y + 18, heroPx, ACCENT));
parts.push(label("PUBLIC", M + pixelWidth(heroText, heroPx) + 20, y + 18 + 7 * heroPx - 4, "start", DIM, 11));
parts.push(areaChart(M, y + 136, chartW, 80));
parts.push(label("52 WEEKS AGO", M, y + 234, "start", DIM, 11), label("THIS WEEK", M + chartW, y + 234, "end", DIM, 11));

// Right column: focus areas
const fx = M + chartW + 44;
parts.push(label("FIG_002 / FOCUS", fx, y));
["Offensive security", "Security tooling", "AI agent workflows", "DAST engineering", "Research & writeups"].forEach((name, i) => {
  const fy = y + 40 + i * 40;
  parts.push(`<rect x="${fx}" y="${fy - 10}" width="10" height="10" fill="${ACCENT}"/>`);
  parts.push(body(name, fx + 22, fy, 17, INK));
});
parts.push(`<line x1="${fx - 22}" y1="${y - 12}" x2="${fx - 22}" y2="${y + 236}" stroke="${LINE}"/>`);
y += 256;
parts.push(rule(y));

// Stat row
y += 22;
const stats: [string, string][] = [
  [fmt(stars), "OWNED STARS"],
  [fmt(cc.totalCommitContributions), "COMMITS / 365D"],
  [fmt(cc.totalPullRequestContributions), "PRS / 365D"],
  [fmt(cc.totalIssueContributions), "ISSUES / 365D"],
  [fmt(u.repositories.totalCount), "PUBLIC REPOS"],
];
stats.forEach(([v, name], i) => {
  const sx = M + i * 160;
  parts.push(pixelText(v, sx, y + 8, 5, ACCENT));
  parts.push(label(name, sx, y + 62, "start", DIM, 11));
});
y += 84;
parts.push(rule(y));

// Featured project
y += 34;
parts.push(label("FIG_003 / FEATURED PROJECT", M, y));
parts.push(label(`PUSHED ${new Date(r.pushedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`, W - M, y, "end", DIM, 11));
y += 38;
parts.push(body(FEATURED, M, y, 30, INK, "start", 700));
parts.push(label(`${fmt(r.stargazerCount)} STARS  /  ${fmt(r.forkCount)} FORKS`, M + FEATURED.length * 18 + 24, y - 4, "start", GREEN, 13));
y += 30;
const langTotal = r.languages.edges.reduce((a: number, e: any) => a + e.size, 0);
const descLines = (r.description ?? "").match(/.{1,80}(\s|$)/g) ?? [];
descLines.forEach((line: string) => { parts.push(body(line.trim(), M, y, 15, INK)); y += 22; });
y += 8;
let lx = M;
const barW = W - 2 * M;
r.languages.edges.forEach((e: any) => {
  const w = (e.size / langTotal) * barW;
  parts.push(`<rect x="${lx.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="10" fill="${e.node.color ?? DIM}"/>`);
  lx += w;
});
y += 30;
r.languages.edges.forEach((e: any, i: number) => {
  const pct = ((e.size / langTotal) * 100).toFixed(1);
  parts.push(`<circle cx="${M + 5 + i * 190}" cy="${y - 5}" r="5" fill="${e.node.color ?? DIM}"/>`);
  parts.push(label(`${e.node.name} ${pct}%`, M + 20 + i * 190, y, "start", INK, 12));
});
y += 28;
parts.push(rule(y));

// Tech stack
y += 34;
parts.push(label("FIG_004 / TECH STACK", M, y));
y += 18;
const tech = ["TypeScript", "Bun", "Python", "Electron", "Burp Suite", "Docker", "OpenSearch"];
const boxW = (W - 2 * M - (tech.length - 1) * 10) / tech.length;
tech.forEach((t, i) => {
  const bx = M + i * (boxW + 10);
  parts.push(`<rect x="${bx.toFixed(1)}" y="${y}" width="${boxW.toFixed(1)}" height="40" fill="none" stroke="${LINE}"/>`);
  parts.push(body(t, bx + boxW / 2, y + 26, 15, INK, "middle"));
});
y += 66;
parts.push(rule(y));

// Footer
y += 30;
parts.push(label("HACKERONE  kassofer   ·   dor.shaer@gmail.com   ·   ISRAEL", M, y, "start", INK, 12));
parts.push(label(`UPDATED ${date}`, W - M, y, "end", DIM, 11));
y += 34;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}" role="img" aria-label="Dor Shaer GitHub profile dashboard">${parts.join("")}</svg>`;
await Bun.write("assets/profile.svg", svg);
console.log(`wrote assets/profile.svg (${W}x${y}), ${heroText} contributions`);
