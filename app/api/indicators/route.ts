import { NextResponse } from "next/server";
import { getCache, setCache } from "@/app/lib/cache";
import { fetchText, parseFredCsv } from "@/app/lib/sources";

export const dynamic = "force-dynamic";

const SERIES: Record<string, { id: string; label: string; unit: string; mode: "level" | "yoy" | "mom" }> = {
  nfp: { id: "PAYEMS", label: "비농업고용", unit: "천명", mode: "mom" },
  unrate: { id: "UNRATE", label: "실업률", unit: "%", mode: "level" },
  cpi: { id: "CPIAUCSL", label: "CPI", unit: "YoY %", mode: "yoy" },
  pce: { id: "PCEPI", label: "PCE 물가지수", unit: "YoY %", mode: "yoy" },
  jolts: { id: "JTSJOL", label: "JOLTS 구인건수", unit: "천건", mode: "mom" },
};

async function one(key: string) {
  const s = SERIES[key];
  try {
    const t = await fetchText(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${s.id}`
    );
    const rows = parseFredCsv(t);
    if (rows.length < 2) return { key, label: s.label, error: "데이터 없음" };
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    let value: number | null = last.value;
    let change: number | null = null;
    let changeLabel = "";
    if (s.mode === "yoy" && rows.length >= 13) {
      const y = rows[rows.length - 13].value;
      change = +(((last.value - y) / y) * 100).toFixed(2);
      changeLabel = "전년동월비";
      value = change;
    } else if (s.mode === "mom") {
      change = +(last.value - prev.value).toFixed(1);
      changeLabel = "전월비";
    } else {
      change = +(last.value - prev.value).toFixed(2);
      changeLabel = "전월비";
    }
    return {
      key,
      label: s.label,
      unit: s.unit,
      value,
      change,
      changeLabel,
      date: last.date,
      prevDate: prev.date,
    };
  } catch (e: any) {
    return { key, label: s.label, error: String(e?.message || e) };
  }
}

export async function GET() {
  const cached = getCache<any>("indicators", 6 * 3600_000);
  if (cached) return NextResponse.json(cached);
  const items = await Promise.all(Object.keys(SERIES).map(one));
  const data = {
    items,
    source: "FRED (미 노동통계국·경제분석국 원천)",
    updatedAt: new Date().toISOString(),
  };
  setCache("indicators", data);
  return NextResponse.json(data);
}
