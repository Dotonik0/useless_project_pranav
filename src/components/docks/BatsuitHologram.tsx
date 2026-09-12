import React from 'react';

/**
 * Rotating hologram of the batsuit: bat emblem core, armor frame lines,
 * counter-rotating dashed containment rings, vertical scan sweep.
 * Pure SVG + CSS — no assets.
 */
export const BatsuitHologram: React.FC = () => {
  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 200 230" className="w-44 xl:w-52 holo-flicker" role="img" aria-label="Batsuit hologram">
        <defs>
          <linearGradient id="holoBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#00e5ff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff1e27" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="holoFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0" />
            <stop offset="35%" stopColor="#00e5ff" stopOpacity="0.7" />
            <stop offset="65%" stopColor="#00e5ff" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
          </linearGradient>
          <filter id="holoGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* containment rings (counter-rotating) */}
        <g className="holo-spin" style={{ transformOrigin: '100px 105px' }}>
          <circle cx="100" cy="105" r="88" fill="none" stroke="#00e5ff" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="26 10 6 10" />
          <circle cx="100" cy="105" r="88" fill="none" stroke="#ff1e27" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 14" strokeDashoffset="30" />
        </g>
        <g className="holo-spin-rev" style={{ transformOrigin: '100px 105px' }}>
          <circle cx="100" cy="105" r="74" fill="none" stroke="#00e5ff" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 7" />
          {[0, 90, 180, 270].map((a) => (
            <circle key={a} cx={100 + 74 * Math.cos((a * Math.PI) / 180)} cy={105 + 74 * Math.sin((a * Math.PI) / 180)} r="2.5" fill="#ff1e27" />
          ))}
        </g>

        {/* armor frame: helm + torso + legs */}
        <g stroke="url(#holoBody)" strokeWidth="1.6" fill="none" filter="url(#holoGlow)">
          {/* cowl */}
          <path d="M88 34 L84 18 L92 26 L100 24 L108 26 L116 18 L112 34 Z" />
          <path d="M88 34 Q86 48 92 54 L108 54 Q114 48 112 34" />
          {/* bat emblem chest */}
          <path
            d="M100 62 C97 65 92 66 87 65 C82 64 79 65 76 66 C79 68 84 70 88 70 C86 72 84 74 83 77 C87 76 91 76 94 77 C95 80 96 84 100 89 C104 84 105 80 106 77 C109 76 113 76 117 77 C116 74 114 72 112 70 C116 70 121 68 124 66 C121 65 118 64 113 65 C108 66 103 65 100 62 Z"
            fill="#00e5ff"
            fillOpacity="0.25"
          />
          {/* torso plating */}
          <path d="M84 58 L116 58 L120 96 L112 132 L88 132 L80 96 Z" />
          <path d="M92 62 L92 128 M108 62 L108 128 M84 78 L116 78 M82 98 L118 98" strokeOpacity="0.6" strokeWidth="1" />
          {/* pauldrons */}
          <path d="M78 60 L70 74 L80 78 M122 60 L130 74 L120 78" />
          {/* gauntlets */}
          <path d="M72 80 L66 116 M128 80 L134 116" />
          {/* legs */}
          <path d="M90 132 L88 178 M110 132 L112 178 M88 178 L82 196 M112 178 L118 196" />
          {/* utility belt */}
          <path d="M86 112 L114 112" stroke="#ff1e27" strokeWidth="2" />
        </g>

        {/* vertical scan sweep */}
        <rect x="20" y="100" width="160" height="10" fill="url(#holoFade)" className="holo-scan" style={{ transformOrigin: '100px 105px' }} />

        {/* holo projector base */}
        <ellipse cx="100" cy="208" rx="52" ry="8" fill="none" stroke="#00e5ff" strokeOpacity="0.6" />
        <ellipse cx="100" cy="208" rx="30" ry="4.5" fill="#00e5ff" fillOpacity="0.25" className="animate-beacon" style={{ transformOrigin: '100px 208px' }} />
        <path d="M70 208 L100 188 L130 208" fill="none" stroke="#00e5ff" strokeOpacity="0.25" strokeDasharray="3 4" />
      </svg>
      <div className="mt-1 text-center font-mono">
        <div className="text-[10px] font-bold tracking-[0.25em] text-bat-cyan glow-text-cyan">BATSUIT MK-VII</div>
        <div className="text-[8px] tracking-[0.3em] text-bat-text/40">HOLO-PROJECTION // STABLE</div>
      </div>
    </div>
  );
};
