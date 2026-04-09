export function VestlineLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Vestline"
    >
      {/* Background tile */}
      <rect width="40" height="40" rx="10" fill="#3ee8b5" fillOpacity="0.12" />

      {/* Subtle grid lines */}
      <line x1="7" y1="22" x2="33" y2="22" stroke="#3ee8b5" strokeOpacity="0.12" strokeWidth="1" />
      <line x1="7" y1="15" x2="33" y2="15" stroke="#3ee8b5" strokeOpacity="0.08" strokeWidth="1" />

      {/* Area fill under vesting curve */}
      <path
        d="M 7 29 L 16 29 C 20 29 22 11 33 11 L 33 29 Z"
        fill="#3ee8b5"
        fillOpacity="0.08"
      />

      {/* Vesting curve: flat cliff → smooth ascent */}
      <path
        d="M 7 29 L 16 29 C 20 29 22 11 33 11"
        stroke="#3ee8b5"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Cliff break marker */}
      <circle cx="16" cy="29" r="2" fill="#3ee8b5" fillOpacity="0.5" />

      {/* End dot — fully vested */}
      <circle cx="33" cy="11" r="2.8" fill="#3ee8b5" />
      <circle cx="33" cy="11" r="5" fill="#3ee8b5" fillOpacity="0.18" />
    </svg>
  )
}
