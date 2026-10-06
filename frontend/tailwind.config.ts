import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontSize: {
        // 5-step scale. 국내 공공 금융 서비스 본문(14.4~17px) 기준에 맞춰 본문을 15px로 상향.
        hero: ["40px", { lineHeight: "1.2", fontWeight: "800" }],
        display: ["32px", { lineHeight: "1.25", fontWeight: "800" }],
        heading: ["20px", { lineHeight: "1.4", fontWeight: "700" }],
        body: ["15px", { lineHeight: "1.6", fontWeight: "400" }],
        caption: ["13px", { lineHeight: "1.5", fontWeight: "400" }],
      },
      colors: {
        // 기존 arbitrary hex를 값 변경 없이 토큰화.
        accent: "#3182f6", // 지표 숫자·링크·버튼 전용
        ink: "#191f28", // 본문
        muted: "#6b7684", // 보조 텍스트
        subtle: "#8b95a1", // 가장 연한 텍스트
        line: "#edf0f3", // 테두리·구분선
        canvas: "#f7f9fb", // 페이지 배경
        "ok-bg": "#e8f8f1",
        "ok-fg": "#00a86b",
        "warn-bg": "#fff7e6",
        "warn-fg": "#b7791f",
        "danger-bg": "#fff1f0",
        "danger-fg": "#f04452",
        "info-bg": "#eef6ff",
        "soon-bg": "#f3f0ff", // 모집예정 배지용 보라 (accent 파랑과 위계 분리)
        "soon-fg": "#7048e8",
        "neutral-bg": "#f2f4f6",
      },
    },
  },
  plugins: [],
};

export default config;
