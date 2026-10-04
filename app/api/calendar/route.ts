import { NextResponse } from "next/server";
import { kstToday, fmtDate, dday } from "@/app/lib/sources";

export const dynamic = "force-dynamic";

// 2026년 중앙은행 통화정책회의 일정 (시작일 기준)
const FOMC_2026 = [
  "2026-01-27", "2026-03-17", "2026-04-28", "2026-06-16",
  "2026-07-28", "2026-09-15", "2026-10-27", "2026-12-08",
];
const BOJ_2026 = [
  "2026-01-22", "2026-03-18", "2026-04-27", "2026-06-15",
  "2026-07-30", "2026-09-17", "2026-10-29", "2026-12-17",
];
const BOK_2026 = [
  "2026-01-15", "2026-02-26", "2026-04-10", "2026-05-28",
  "2026-07-16", "2026-08-27", "2026-10-22", "2026-11-26",
];

function meetingInfo(dates: string[]) {
  const upcoming = dates.filter((d) => dday(d) >= 0).sort();
  const past = dates.filter((d) => dday(d) < 0).sort();
  const next = upcoming[0] || null;
  return {
    next,
    nextDday: next ? dday(next) : null,
    last: past.length ? past[past.length - 1] : null,
    total: dates.length,
  };
}

function secondThursday(y: number, m: number): Date {
  const first = new Date(y, m - 1, 1);
  const offset = (4 - first.getDay() + 7) % 7;
  return new Date(y, m - 1, 1 + offset + 7);
}

function thirdFriday(y: number, m: number): Date {
  const first = new Date(y, m - 1, 1);
  const offset = (5 - first.getDay() + 7) % 7;
  return new Date(y, m - 1, 1 + offset + 14);
}

function nextOption(kind: "kr" | "us") {
  const t = kstToday();
  for (let i = 0; i < 4; i++) {
    const d = new Date(t.getFullYear(), t.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dt = kind === "kr" ? secondThursday(y, m) : thirdFriday(y, m);
    const ymd = fmtDate(dt);
    if (dday(ymd) >= 0) {
      return {
        date: ymd,
        dday: dday(ymd),
        witching: kind === "kr" ? [3, 6, 9, 12].includes(m) : [3, 6, 9, 12].includes(m),
        label:
          kind === "kr"
            ? [3, 6, 9, 12].includes(m)
              ? "쿼드러플위칭데이"
              : "월간 만기"
            : [3, 6, 9, 12].includes(m)
            ? "쿼드러플위칭데이"
            : "월간 만기",
      };
    }
  }
  return null;
}

const EARNINGS = [
  { company: "삼성전자", kind: "잠정실적", expected: "2026-10-08", note: "예상 · 통상 10월 초순" },
  { company: "삼성전자", kind: "확정실적", expected: "2026-10-29", note: "예상 · 통상 10월 하순" },
  { company: "SK하이닉스", kind: "확정실적", expected: "2026-10-29", note: "예상 · 통상 10월 하순" },
  { company: "샌디스크", kind: "실적발표", expected: "2026-10-28", note: "예상 · FY27 Q1" },
  { company: "엔비디아", kind: "실적발표", expected: "2026-11-19", note: "예상 · FY27 Q3" },
  { company: "마이크론", kind: "실적발표", expected: "2026-12-17", note: "예상 · FY27 Q1" },
];

export async function GET() {
  const fomc = meetingInfo(FOMC_2026);
  const boj = meetingInfo(BOJ_2026);
  const bok = meetingInfo(BOK_2026);
  const data = {
    centralBanks: [
      { name: "FOMC", ...fomc, note: "연준 금리결정" },
      { name: "일본은행", ...boj, note: "BOJ 금융정책결정회합" },
      {
        name: "한국은행",
        ...bok,
        note: "금통위 통화정책방향 · 기준금리 2.50% (2026-02-26 확인)",
      },
    ],
    options: [
      { market: "KOSPI200 옵션", rule: "매월 두 번째 목요일", ...nextOption("kr") },
      { market: "미국 옵션", rule: "매월 세 번째 금요일", ...nextOption("us") },
    ],
    earnings: EARNINGS.map((e) => ({ ...e, dday: dday(e.expected) })).sort(
      (a, b) => a.dday - b.dday
    ),
    today: fmtDate(kstToday()),
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(data);
}
