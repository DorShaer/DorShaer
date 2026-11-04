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
      contributionCalendar { totalContributions weeks { contributionDays { contributionCount date weekday } } }
    }
    repositoriesContributedTo(first: 4, contributionTypes: [COMMIT, PULL_REQUEST], includeUserRepositories: false, privacy: PUBLIC, orderBy: { field: STARGAZERS, direction: DESC }) {
      nodes { nameWithOwner stargazerCount primaryLanguage { name color } }
    }
  }
  mergedUpstream: search(query: "author:DorShaer is:pr is:merged is:public -user:DorShaer", type: ISSUE, first: 1) { issueCount }
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
const calWeeks: any[] = cc.contributionCalendar.weeks;
const days: { count: number; date: string; weekday: number }[] = calWeeks.flatMap((w: any) =>
  w.contributionDays.map((d: any) => ({ count: d.contributionCount, date: d.date, weekday: d.weekday })),
);
const busiest = days.reduce((a, d) => (d.count > a.count ? d : a), days[0]);
let longestStreak = 0, run = 0;
for (const d of days) { run = d.count > 0 ? run + 1 : 0; longestStreak = Math.max(longestStreak, run); }
const byWeekday = Array.from({ length: 7 }, (_, i) => days.filter((d) => d.weekday === i).reduce((a, d) => a + d.count, 0));
const upstream = u.repositoriesContributedTo.nodes;
const mergedUpstream = data.mergedUpstream.issueCount;

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
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

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

function label(text: string, x: number, y: number, anchor = "start", color = ACCENT, size = 11) {
  return `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" letter-spacing="1.5" fill="${color}" text-anchor="${anchor}">${esc(text.toUpperCase())}</text>`;
}
function body(text: string, x: number, y: number, size = 14, color = INK, anchor = "start", weight = 400) {
  return `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(text)}</text>`;
}
const M = 32;
const rule = (y: number, x1 = M, x2 = W - M) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${LINE}"/>`;
const vrule = (x: number, y1: number, y2: number) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${LINE}"/>`;

// Contribution heatmap: one cell per day, 53 columns x 7 rows, accent intensity by count
function heatmap(x: number, y: number, cell: number, gap: number): string {
  const max = Math.max(...days.map((d) => d.count), 1);
  let out = "";
  calWeeks.forEach((w: any, wi: number) => {
    w.contributionDays.forEach((d: any) => {
      const t = d.contributionCount / max;
      const op = d.contributionCount === 0 ? 0.12 : 0.3 + 0.7 * Math.sqrt(t);
      out += `<rect x="${x + wi * (cell + gap)}" y="${y + d.weekday * (cell + gap)}" width="${cell}" height="${cell}" rx="1" fill="${ACCENT}" fill-opacity="${op.toFixed(2)}"/>`;
    });
  });
  return out;
}

// Layout
let y = 0;
const parts: string[] = [];
parts.push(`<rect width="${W}" height="100%" fill="${BG}"/>`);

y = 40;
parts.push(label("FIG_000 / SECURITY ENGINEER PROFILE", M, y), label(`@${USER}`, W - M, y, "end", DIM));
y += 50;
parts.push(body("DOR SHAER", M, y, 44, INK, "start", 700));
y += 30;
parts.push(body("Security engineer who builds his own tooling.", M, y, 16));
y += 22;
parts.push(label("WEB & API PENTESTING  ·  BUG BOUNTY  ·  DAST AT BRIGHT SECURITY  ·  AI AGENT TOOLS", M, y, "start", DIM, 10));
y += 24;
parts.push(rule(y));

// Hero: contributions + heatmap, focus list on the right
y += 28;
const heroPx = 11;
const cell = 8, gap = 2;
const chartW = calWeeks.length * (cell + gap) - gap;
const heroText = fmt(cc.contributionCalendar.totalContributions);
parts.push(label("FIG_001 / CONTRIBUTIONS, LAST 365 DAYS", M, y));
parts.push(pixelText(heroText, M, y + 16, heroPx, ACCENT));
parts.push(label("PUBLIC", M + pixelWidth(heroText, heroPx) + 16, y + 16 + 7 * heroPx - 4, "start", DIM, 10));
parts.push(heatmap(M, y + 108, cell, gap));
parts.push(label("52 WEEKS AGO", M, y + 192, "start", DIM, 10), label("THIS WEEK", M + chartW, y + 192, "end", DIM, 10));

const fx = M + chartW + 40;
parts.push(vrule(fx - 20, y - 10, y + 196));
parts.push(label("FIG_002 / FOCUS", fx, y));
["Offensive security", "Security tooling", "AI agent workflows", "DAST engineering", "Research & writeups"].forEach((name, i) => {
  const fy = y + 34 + i * 30;
  parts.push(`<rect x="${fx}" y="${fy - 9}" width="9" height="9" fill="${ACCENT}"/>`);
  parts.push(body(name, fx + 20, fy, 15, INK));
});
y += 212;
parts.push(rule(y));

// Stat row
y += 20;
const stats: [string, string][] = [
  [fmt(stars), "OWNED STARS"],
  [fmt(cc.totalCommitContributions), "COMMITS / 365D"],
  [fmt(cc.totalPullRequestContributions), "PRS / 365D"],
  [fmt(cc.totalIssueContributions), "ISSUES / 365D"],
  [fmt(u.repositories.totalCount), "PUBLIC REPOS"],
  [fmt(longestStreak), "BEST STREAK"],
  [fmt(busiest.count), "PEAK DAY"],
];
const statW = (W - 2 * M) / stats.length;
stats.forEach(([v, name], i) => {
  const sx = M + i * statW;
  parts.push(pixelText(v, sx, y + 6, 4, ACCENT));
  parts.push(label(name, sx, y + 50, "start", DIM, 9));
});
y += 68;
parts.push(rule(y));

// Weekday rhythm + upstream contributions
y += 28;
const half = (W - 2 * M) / 2;
parts.push(label("FIG_003 / WEEKLY RHYTHM", M, y));
parts.push(label("CONTRIBUTIONS BY WEEKDAY", M, y + 16, "start", DIM, 9));
const wdMax = Math.max(...byWeekday, 1);
const wdNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const barH = 70, barW = 34, barGap = 16;
byWeekday.forEach((v, i) => {
  const bx = M + i * (barW + barGap);
  const h = Math.max(2, (v / wdMax) * barH);
  const top = v === wdMax;
  parts.push(`<rect x="${bx}" y="${y + 42 + barH - h}" width="${barW}" height="${h.toFixed(1)}" fill="${ACCENT}" fill-opacity="${top ? 1 : 0.45}"/>`);
  parts.push(label(wdNames[i], bx + barW / 2, y + 42 + barH + 14, "middle", top ? INK : DIM, 9));
  parts.push(label(fmt(v), bx + barW / 2, y + 42 + barH - h - 5, "middle", top ? INK : DIM, 9));
});

const ux = M + half + 20;
parts.push(vrule(ux - 20, y - 10, y + 136));
parts.push(label("FIG_004 / UPSTREAM", ux, y));
parts.push(label(`${fmt(mergedUpstream)} MERGED PRS IN OTHER PEOPLE'S REPOS`, ux, y + 16, "start", DIM, 9));
upstream.forEach((repo: any, i: number) => {
  const ry = y + 44 + i * 28;
  parts.push(`<circle cx="${ux + 5}" cy="${ry - 4}" r="4" fill="${repo.primaryLanguage?.color ?? DIM}"/>`);
  parts.push(body(repo.nameWithOwner, ux + 18, ry, 14, INK));
  parts.push(label(`${fmt(repo.stargazerCount)} STARS`, W - M, ry, "end", DIM, 9));
});
y += 148;
parts.push(rule(y));

// Featured project
y += 30;
parts.push(label("FIG_005 / FEATURED PROJECT", M, y));
parts.push(label(`PUSHED ${fmtDate(r.pushedAt)}`, W - M, y, "end", DIM, 10));
y += 34;
parts.push(body(FEATURED, M, y, 26, INK, "start", 700));
parts.push(label(`${fmt(r.stargazerCount)} STARS  /  ${fmt(r.forkCount)} FORKS`, M + FEATURED.length * 16 + 20, y - 3, "start", GREEN, 12));
y += 26;
const langTotal = r.languages.edges.reduce((a: number, e: any) => a + e.size, 0);
const descLines = (r.description ?? "").match(/.{1,92}(\s|$)/g) ?? [];
descLines.forEach((line: string) => { parts.push(body(line.trim(), M, y, 13.5, INK)); y += 20; });
y += 6;
let lx = M;
const fullW = W - 2 * M;
r.languages.edges.forEach((e: any) => {
  const w = (e.size / langTotal) * fullW;
  parts.push(`<rect x="${lx.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="8" fill="${e.node.color ?? DIM}"/>`);
  lx += w;
});
y += 26;
r.languages.edges.forEach((e: any, i: number) => {
  const pct = ((e.size / langTotal) * 100).toFixed(1);
  parts.push(`<circle cx="${M + 4 + i * 180}" cy="${y - 4}" r="4" fill="${e.node.color ?? DIM}"/>`);
  parts.push(label(`${e.node.name} ${pct}%`, M + 16 + i * 180, y, "start", INK, 10));
});
y += 24;
parts.push(rule(y));

// Tech stack
y += 30;
parts.push(label("FIG_006 / TECH STACK", M, y));
y += 16;
const tech = ["TypeScript", "Bun", "Python", "Electron", "Burp Suite", "Docker", "OpenSearch"];
const boxW = (fullW - (tech.length - 1) * 10) / tech.length;
tech.forEach((t, i) => {
  const bx = M + i * (boxW + 10);
  parts.push(`<rect x="${bx.toFixed(1)}" y="${y}" width="${boxW.toFixed(1)}" height="34" fill="none" stroke="${LINE}"/>`);
  parts.push(body(t, bx + boxW / 2, y + 22, 13, INK, "middle"));
});
y += 58;
parts.push(rule(y));

// Footer
y += 26;
parts.push(label("HACKERONE  kassofer   ·   dor.shaer@gmail.com   ·   ISRAEL", M, y, "start", INK, 11));
parts.push(label(`PUBLIC DATA  ·  UPDATED ${fmtDate(new Date())}`, W - M, y, "end", DIM, 10));
y += 30;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}" role="img" aria-label="Dor Shaer GitHub profile dashboard">${parts.join("")}</svg>`;
await Bun.write("assets/profile.svg", svg);
console.log(`wrote assets/profile.svg (${W}x${y}), ${heroText} contributions, best day ${busiest.count} on ${busiest.date}, streak ${longestStreak}`);
