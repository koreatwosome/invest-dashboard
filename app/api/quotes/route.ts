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

// 비트코인: Coinbase(미국 서버에서도 접속 가능) → CoinGecko 백업
async function btcQuote(): Promise<any> {
  try {
    const j = await fetchJson("https://api.exchange.coinbase.com/products/BTC-USD/stats");
    const last = parseFloat(j.last);
    const open = parseFloat(j.open);
    if (!isFinite(last)) throw new Error("no price");
    return {
      price: last,
      changePct: open ? +(((last - open) / open) * 100).toFixed(2) : null,
      high: parseFloat(j.high),
      low: parseFloat(j.low),
      source: "Coinbase (실시간)",
    };
  } catch {}
  try {
    const j = await fetchJson(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true"
    );
    return {
      price: j.bitcoin.usd,
      changePct: +Number(j.bitcoin.usd_24h_change).toFixed(2),
      high: null,
      low: null,
      source: "CoinGecko",
    };
  } catch {}
  return null;
}

// 원/달러: Yahoo Finance(시장 환율) → 네이버(하나은행 고시) → FRED DEXKOUS(전일)
async function usdKrw(): Promise<any> {
  try {
    const j = await fetchJson(
      "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?range=2mo&interval=1d"
    );
    const r = j.chart.result[0];
    const m = r.meta;
    const closes: number[] = (r.indicators.quote[0].close || []).filter(
      (v: any) => typeof v === "number" && isFinite(v)
    );
    const value = Number(m.regularMarketPrice);
    if (!isFinite(value)) throw new Error("no price");
    const prev = closes.length >= 2 ? closes[closes.length - 2] : null;
    return {
      value: +value.toFixed(2),
      change: prev ? +(value - prev).toFixed(2) : null,
      changePct: prev ? +(((value - prev) / prev) * 100).toFixed(2) : null,
      history: closes.slice(-30),
      asOf: new Date(m.regularMarketTime * 1000).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
      source: "Yahoo Finance (시장 환율)",
      unit: "원",
    };
  } catch {}
  try {
    const j = await fetchJson("https://api.stock.naver.com/marketindex/exchange/FX_USDKRW");
    const e = j.exchangeInfo;
    const num = (s: any) => parseFloat(String(s).replace(/,/g, ""));
    const value = num(e.closePrice);
    if (!isFinite(value)) throw new Error("no price");
    return {
      value,
      change: num(e.fluctuations),
      changePct: num(e.fluctuationsRatio),
      history: [],
      asOf: e.localTradedAt,
      source: "네이버 (하나은행 고시)",
      unit: "원",
    };
  } catch {}
  try {
    const rows = await fredSeries("DEXKOUS", 60);
    const last = rows[rows.length - 1];
    if (!last) throw new Error("no data");
    return {
      value: last.value,
      change: null,
      changePct: null,
      history: rows.slice(-30).map((r) => r.value),
      asOf: last.date,
      source: "FRED DEXKOUS (전일)",
      unit: "원",
    };
  } catch {}
  return null;
}

export async function GET() {
  const cached = getCache<any>("quotes", 60_000);
  if (cached) return NextResponse.json(cached);

  const [q, h10y, hDxy, hKrw, brentRows, dgs10Rows, broadRows, btc, krw] =
    await Promise.all([
      stooqQuotes(),
      stooqHist("10usy.b"),
      stooqHist("dx.f"),
      stooqHist("usdkrw"),
      fredRows("DCOILBRENTEU"),
      fredRows("DGS10"),
      fredRows("DTWEXBGS"),
      btcQuote(),
      usdKrw(),
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
    usdkrw: krw
      ? krw
      : qKrw
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
      ? { ...btc, unit: "$" }
      : null,
    updatedAt: new Date().toISOString(),
  };

  setCache("quotes", data);
  return NextResponse.json(data);
}
