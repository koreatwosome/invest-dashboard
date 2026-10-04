import { NextResponse } from "next/server";
import { getCache, setCache } from "@/app/lib/cache";
import { fetchText, parseNaverRows } from "@/app/lib/sources";

export const dynamic = "force-dynamic";

export async function GET() {
  const cached = getCache<any>("kospi", 30 * 60_000);
  if (cached) return NextResponse.json(cached);

  try {
    const t = await fetchText(
      "https://api.finance.naver.com/siseJson.naver?symbol=KOSPI&requestType=1&startTime=20220101&endTime=20261231&timeframe=month"
    );
    const rows = parseNaverRows(t)
      .map((r) => ({
        date: r[0],
        open: r[1],
        high: r[2],
        low: r[3],
        close: r[4],
      }))
      .slice(-36);
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const data = {
      months: rows,
      lastClose: last?.close ?? null,
      momPct: last && prev ? +(((last.close - prev.close) / prev.close) * 100).toFixed(2) : null,
      asOf: last?.date ?? null,
      source: "네이버 금융 (KRX 원천)",
      updatedAt: new Date().toISOString(),
    };
    setCache("kospi", data);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: "KOSPI 조회 실패", detail: String(e?.message || e) },
      { status: 502 }
    );
  }
}
