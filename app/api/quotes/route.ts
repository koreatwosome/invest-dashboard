import { NextResponse } from "next/server";
import { getCache, setCache } from "@/app/lib/cache";
import {
  fetchText,
  fetchJson,
  parseStooqQuote,
  parseStooqHistory,
  fredSeries,
} from "@/app/lib/sources";

export const dynamic = "force-dynamic";

async function stooqQuotes(): Promise<Record<string, any>> {
  try {
    const t = await fetchText(
      "https://stooq.com/q/l/?s=10usy.b,dx.f,usdkrw&f=sd2t2ohlcv&h&e=csv"
    );
    return parseStooqQuote(t);
  } catch {
    return {};
  }
}

async function stooqHist(sym: string, days = 45): Promise<number[]> {
  try {
    const end = new Date();
    const start = new Date(Date.now() - days * 864e5);
    const f = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
    const t = await fetchText(
      `https://stooq.com/q/d/l/?s=${sym}&d1=${f(start)}&d2=${f(end)}&i=d`
    );
    return parseStooqHistory(t).map((r) => r.close);
  } catch {
    return [];
  }
}

async function fredRows(id: string): Promise<{ date: string; value: number }[]> {
  try {
    return await fredSeries(id, 60);
  } catch {
    return [];
  }
}

async function binanceBtc(): Promise<any> {
  try {
    const j = await fetchJson(
      "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"
    );
    return {
      price: parseFloat(j.lastPrice),
      changePct: parseFloat(j.priceChangePercent),
      high: parseFloat(j.highPrice),
      low: parseFloat(j.lowPrice),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const cached = getCache<any>("quotes", 60_000);
  if (cached) return NextResponse.json(cached);

  const [q, h10y, hDxy, hKrw, brentRows, dgs10Rows, broadRows, btc] =
    await Promise.all([
      stooqQuotes(),
      stooqHist("10usy.b"),
      stooqHist("dx.f"),
      stooqHist("usdkrw"),
      fredRows("DCOILBRENTEU"),
      fredRows("DGS10"),
      fredRows("DTWEXBGS"),
      binanceBtc(),
    ]);

  const q10 = q["10usy.b"];
  const qDx = q["dx.f"];
  const qKrw = q["usdkrw"];
  const brentLast = brentRows.length ? brentRows[brentRows.length - 1] : null;
  const dgsLast = dgs10Rows.length ? dgs10Rows[dgs10Rows.length - 1] : null;
  const broadLast = broadRows.length ? broadRows[broadRows.length - 1] : null;

  const chg = (v: number, p: number) =>
    p ? +(((v - p) / p) * 100).toFixed(2) : null;

  const data = {
    us10y: q10
      ? {
          value: q10.close,
          change: +(q10.close - q10.open).toFixed(3),
          changePct: chg(q10.close, q10.open),
          history: h10y.slice(-30),
          asOf: `${q10.date} ${q10.time}`,
          source: "Stooq (지연 가능)",
          unit: "%",
        }
      : dgsLast
      ? {
          value: dgsLast.value,
          change: null,
          changePct: null,
          history: dgs10Rows.slice(-30).map((r) => r.value),
          asOf: dgsLast.date,
          source: "FRED DGS10 (전일 종가)",
          unit: "%",
        }
      : null,
    dxy: qDx
      ? {
          value: qDx.close,
          change: +(qDx.close - qDx.open).toFixed(2),
          changePct: chg(qDx.close, qDx.open),
          history: hDxy.slice(-30),
          asOf: `${qDx.date} ${qDx.time}`,
          source: "Stooq (지연 가능)",
          unit: "pt",
        }
      : broadLast
      ? {
          value: broadLast.value,
          change: null,
          changePct: null,
          history: broadRows.slice(-30).map((r) => r.value),
          asOf: broadLast.date,
          source: "FRED 연준 광의 달러지수 (DXY 아님)",
          unit: "pt",
        }
      : null,
    brent: brentLast
      ? {
          value: brentLast.value,
          change: null,
          changePct: null,
          history: brentRows.slice(-30).map((r) => r.value),
          asOf: brentLast.date,
          source: "FRED (일일 종가)",
          unit: "$",
        }
      : null,
    usdkrw: qKrw
      ? {
          value: qKrw.close,
          change: +(qKrw.close - qKrw.open).toFixed(2),
          changePct: chg(qKrw.close, qKrw.open),
          history: hKrw.slice(-30),
          asOf: `${qKrw.date} ${qKrw.time}`,
          source: "Stooq (지연 가능)",
          unit: "원",
        }
      : null,
    btc: btc
      ? { ...btc, source: "Binance (실시간)", unit: "$" }
      : null,
    updatedAt: new Date().toISOString(),
  };

  setCache("quotes", data);
  return NextResponse.json(data);
}
