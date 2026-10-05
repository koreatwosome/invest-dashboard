# 투자 대시보드

미국채 10년물, 브렌트유, 달러인덱스, 원/달러, BTC, 닛케이·대만 가권지수, DDR4 시세 링크, 코스피 월봉, 미국 주요 경제지표,
연준 위원 발언, 중앙은행 금리일정, 옵션만기일, 반도체 실적일정을 한 화면에서 보여주는 대시보드.

## 데이터 제공처 (서버에서 조회, API 키 불필요)

| 지표 | 제공처 |
|---|---|
| 미 10년물 / 달러인덱스 / 원달러 | Stooq (실패 시 FRED 폴백) |
| 브렌트유 | FRED DCOILBRENTEU (일일) |
| BTC | Coinbase (실시간, 실패 시 CoinGecko) |
| 닛케이 225 / 대만 가권(TAIEX) | Yahoo Finance (지연 시세, 실패 시 네이버 해외지수) |
| PC용 D램 DDR4 가격 | DRAMeXchange 링크 버튼 (공식 API 없음) |
| 코스피 월봉 | 네이버 금융 (KRX 원천) |
| 비농업고용/CPI/PCE/실업률/JOLTS | FRED (BLS·BEA 원천) |
| 연준 발언 | Google News RSS |
| FOMC/BOJ/BOK 일정 | 2026년 공개 일정 + 자동 D-day 계산 |

## 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

## Vercel 배포 (무료)

1. 이 폴더를 GitHub 저장소에 push
2. [vercel.com](https://vercel.com)에서 GitHub 계정으로 가입 → 저장소 선택 → Deploy
3. 기본 도메인 `프로젝트명.vercel.app`으로 바로 접속 가능

별도 환경변수 없이 동작합니다.

## 갱신 주기

- 시장 지표(10년물/브렌트/달러/환율/BTC/닛케이/대만/코스피): 60초 자동갱신
- 경제지표/연준발언: 10분 자동갱신 (서버 캐시: 지표 6시간, 발언 30분)
- 금리/옵션/실적 일정: 접속 시 계산
