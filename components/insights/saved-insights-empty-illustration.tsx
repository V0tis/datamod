/** 저장한 인사이트 빈 상태용 장식 일러스트 (인라인 SVG) */
export function SavedInsightsEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="sie-bg" x1="40" y1="20" x2="160" y2="140" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E0F7F5" />
          <stop offset="1" stopColor="#F0FDFC" />
        </linearGradient>
        <linearGradient id="sie-mint" x1="70" y1="50" x2="130" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2AC1BC" stopOpacity="0.35" />
          <stop offset="1" stopColor="#2AC1BC" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="88" rx="72" ry="56" fill="url(#sie-bg)" />
      <rect x="56" y="48" width="88" height="64" rx="10" fill="white" stroke="#CFF5F2" strokeWidth="2" />
      <rect x="64" y="58" width="48" height="4" rx="2" fill="#94DCD6" opacity="0.7" />
      <rect x="64" y="68" width="72" height="3" rx="1.5" fill="#E2E8F0" />
      <rect x="64" y="76" width="64" height="3" rx="1.5" fill="#E2E8F0" />
      <rect x="64" y="84" width="56" height="3" rx="1.5" fill="#E2E8F0" />
      <path
        d="M118 52 L132 62 L132 96 C132 99.3 129.3 102 126 102 L74 102 C70.7 102 68 99.3 68 96 L68 58 C68 54.7 70.7 52 74 52 Z"
        fill="url(#sie-mint)"
        stroke="#2AC1BC"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M74 52 L100 72 L126 52" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5" />
      <circle cx="156" cy="44" r="18" fill="#FEF3C7" stroke="#FBBF24" strokeWidth="1.5" />
      <path d="M150 44 L154 48 L162 38" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
