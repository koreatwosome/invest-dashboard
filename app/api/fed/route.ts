import { NextResponse } from "next/server";
import { getCache, setCache } from "@/app/lib/cache";
import { fetchText } from "@/app/lib/sources";

export const dynamic = "force-dynamic";

const QUERY = encodeURIComponent(
  '"Federal Reserve" speech (Williams OR Jefferson OR Barr OR Bowman OR Warsh) when:7d'
);
const RSS_URL = `https://news.google.com/rss/search?q=${QUERY}&hl=en-US&gl=US&ceid=US:en`;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export async function GET() {
  const cached = getCache<any>("fed", 30 * 60_000);
  if (cached) return NextResponse.json(cached);

  try {
    const xml = await fetchText(RSS_URL);
    const items: any[] = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    const cutoff = Date.now() - 4 * 864e5;
    while ((m = re.exec(xml)) !== null && items.length < 15) {
      const body = m[1];
      const t = /<title>([\s\S]*?)<\/title>/.exec(body);
      const l = /<link>([\s\S]*?)<\/link>/.exec(body);
      const p = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(body);
      const s = /<source[^>]*>([\s\S]*?)<\/source>/.exec(body);
      if (!t || !p) continue;
      const ts = Date.parse(p[1]);
      if (!isFinite(ts) || ts < cutoff) continue;
      // CDATA 제거
      const clean = (x: string) =>
        decodeEntities(x.replace(/<!\[CDATA\[|\]\]>/g, "").trim());
      items.push({
        title: clean(t[1]),
        link: clean(l ? l[1] : ""),
        pubDate: new Date(ts).toISOString(),
        source: s ? clean(s[1]) : "",
      });
    }
    const data = {
      items,
      source: "Google News RSS (Federal Reserve speech)",
      updatedAt: new Date().toISOString(),
    };
    setCache("fed", data);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: "연준 발언 조회 실패", detail: String(e?.message || e) },
      { status: 502 }
    );
  }
}
