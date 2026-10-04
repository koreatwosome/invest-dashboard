const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) invest-dashboard/1.0" };

export async function fetchText(url: string, timeoutMs = 9000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url: string, timeoutMs = 9000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// Stooq q/l CSV: Symbol,Date,Time,Open,High,Low,Close,Volume
export function parseStooqQuote(csv: string): Record<string, any> {
  const out: Record<string, any> = {};
  const lines = csv.trim().split("\n");
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(",");
    if (p.length < 8) continue;
    const sym = p[0].trim().toLowerCase();
    const close = parseFloat(p[6]);
    if (!isFinite(close)) continue;
    out[sym] = {
      symbol: p[0].trim(),
      date: p[1],
      time: p[2],
      open: parseFloat(p[3]),
      high: parseFloat(p[4]),
      low: parseFloat(p[5]),
      close,
      volume: parseFloat(p[7]),
    };
  }
  return out;
}

// Stooq daily history CSV: Date,Open,High,Low,Close,Volume
export function parseStooqHistory(csv: string): { date: string; close: number }[] {
  const out: { date: string; close: number }[] = [];
  const lines = csv.trim().split("\n");
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(",");
    if (p.length < 5) continue;
    const close = parseFloat(p[4]);
    if (p[0] && isFinite(close)) out.push({ date: p[0], close });
  }
  return out;
}

// FRED fredgraph.csv: DATE,VALUE  (VALUE가 "."일 수 있음)
export function parseFredCsv(csv: string): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  const lines = csv.trim().split("\n");
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(",");
    if (p.length < 2) continue;
    const v = parseFloat(p[1]);
    if (p[0] && isFinite(v)) out.push({ date: p[0], value: v });
  }
  return out;
}

// Naver siseJson: ["날짜",시가,고가,저가,종가,거래량,...]
export function parseNaverRows(text: string): any[][] {
  const rows: any[][] = [];
  const re = /\[([^\[\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const inner = m[1].trim();
    if (inner.includes("날짜")) continue;
    const parts = inner.split(",").map((s) => s.trim());
    if (parts.length < 5) continue;
    const date = parts[0].replace(/^["']|["']$/g, "");
    if (!/^\d{8}$/.test(date)) continue;
    const nums = parts.slice(1).map((s) => parseFloat(s));
    if (nums.some((n) => !isFinite(n))) continue;
    rows.push([date, ...nums]);
  }
  return rows;
}

export function kstToday(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dday(targetYmd: string): number {
  const t = kstToday();
  t.setHours(0, 0, 0, 0);
  const [y, m, d] = targetYmd.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - t.getTime()) / 86400000);
}

// FRED 공식 API (api.stlouisfed.org) — Vercel 환경변수 FRED_API_KEY 사용
export async function fredSeries(
  id: string,
  limit = 400
): Promise<{ date: string; value: number }[]> {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY 환경변수가 없습니다");
  const url =
    "https://api.stlouisfed.org/fred/series/observations" +
    `?series_id=${id}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
  const j = await fetchJson(url, 12000);
  return (j.observations || [])
    .map((o: any) => ({ date: o.date as string, value: parseFloat(o.value) }))
    .filter((r: { date: string; value: number }) => isFinite(r.value))
    .reverse(); // 오래된 → 최신 순 (parseFredCsv와 동일한 순서)
}
