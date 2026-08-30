# Production Policy Source Matrix — 2026-08-30

| ID | 정책명 | 상태 | 기간 | 계산상 금리 | 공식 출처 |
|---|---|---|---:|---:|---|
| `YFS_GENERAL_2026` | 청년미래적금 일반형 (2026) | UPCOMING | 36개월 | 5.0% | https://www.fsc.go.kr/po010101/87056 |
| `YFS_PREF_SME_EXISTING_2026` | 청년미래적금 우대형 - 중소기업 재직 (2026) | UPCOMING | 36개월 | 5.0% | https://www.fsc.go.kr/po010101/87056 |
| `YFS_PREF_SME_NEW_2026` | 청년미래적금 우대형 - 중소기업 신규취업 (2026) | UPCOMING | 36개월 | 5.0% | https://www.fsc.go.kr/po010101/87056 |
| `YFS_TAX_ONLY_2026` | 청년미래적금 비과세형 - 기여금 미대상 (2026) | UPCOMING | 36개월 | 5.0% | https://www.fsc.go.kr/po010101/87056 |
| `SEOUL_HOPE_DOUBLE_24M_2026` | 서울시 희망두배 청년통장 2년형 (2026) | CLOSED | 24개월 | 0.0% | https://news.seoul.go.kr/welfare/archives/581505 |
| `SEOUL_HOPE_DOUBLE_36M_2026` | 서울시 희망두배 청년통장 3년형 (2026) | CLOSED | 36개월 | 0.0% | https://news.seoul.go.kr/welfare/archives/581505 |
| `INCHEON_DREAMFOR_2026` | 인천 드림For청년통장 (2026) | CLOSED | 36개월 | 0.0% | https://youth.incheon.go.kr/financial/dreamfor.jsp |
| `BUSAN_DOUBLE_24M_2026` | 부산청년 기쁨두배통장 2년형 (2026) | CLOSED | 24개월 | 0.0% | https://www.busan.go.kr/nbgosi/view?gosiGbn=A&sno=78998 |
| `BUSAN_DOUBLE_36M_2026` | 부산청년 기쁨두배통장 3년형 (2026) | CLOSED | 36개월 | 0.0% | https://www.busan.go.kr/nbgosi/view?gosiGbn=A&sno=78998 |
| `JEONBUK_DOUBLE_2026` | 전북청년 함께 두배적금 (2026) | CLOSED | 24개월 | 0.0% | https://www.jeonbuk.go.kr/index.jeonbuk?menuCd=DOM_000000104006005003 |
| `JEONNAM_HOPE_2026` | 전남 청년 희망디딤돌 통장 (2026) | CLOSED | 36개월 | 0.0% | https://www.jeonnam.go.kr/contentsView.do?menuId=brand0401000000 |
| `DAEJEON_FUTURE_DOUBLE_2026` | 대전 미래두배 청년통장 (2026 세부공고 확인필요) | CHECK_REQUIRED | 24개월 | 0.0% | https://www.daejeon.go.kr/edp/EdpContentsHtmlView.do?menuSeq=7462 |
| `ARTIST_SAVINGS_2026` | 청년예술인 예술활동 적립계좌 (2026) | CLOSED | 24개월 | 0.0% | https://www.kawf.kr/notice/sub01View.do?selIdx=19285 |

## Modeling notes

- 지자체 매칭통장 중 공식 페이지에서 수치 금리를 확인하지 못한 경우 정책상품 금리를 0%로 두어 지원효과를 보수적으로 계산한다.
- 기준중위소득·건강보험료·가족재산·증빙조건은 금액으로 임의 환산하지 않고 `manual_requirements`로 보존한다.
- `CLOSED`/`CHECK_REQUIRED`는 조건 분석은 가능하지만 Optimizer에서는 제외한다.
- 청년미래적금은 공식 기본금리 5%만 사용하며 은행별 우대금리는 계산에 넣지 않는다.
- `UPCOMING`인 청년미래적금의 일정 문구는 2026-08-11 금융위의 추가모집 검토 안내를 기준으로 하며 확정 모집일이 아니다.
