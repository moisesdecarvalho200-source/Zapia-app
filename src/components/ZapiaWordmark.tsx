import React from 'react';
import { Mail } from 'lucide-react';

export const ZapiaWordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    className="inline-flex items-center gap-1.5"
    aria-label="ZAPIA MS"
    data-testid="zapia-ms-wordmark"
  >
    <svg
      viewBox="0 0 172 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`h-6 w-auto text-[var(--zapia-text)] ${className}`}
    >
      {/* Z */}
      <path d="M2 4H36V11L15 25H36V32H2V25L23 11H2V4Z" fill="currentColor" />
      {/* A */}
      <path d="M41 4H74V32H61V23H54V32H41V4ZM54 11V17H61V11H54Z" fill="currentColor" />
      {/* P */}
      <path d="M79 4H111V22H92V32H79V4ZM92 11V16H99V11H92Z" fill="currentColor" />
      {/* I */}
      <path d="M116 4H130V32H116V4Z" fill="currentColor" />
      {/* A */}
      <path d="M135 4H168V32H155V23H148V32H135V4ZM148 11V17H155V11H148Z" fill="currentColor" />
    </svg>
    <span className="px-1.5 py-0.5 rounded-md bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] font-mono-tabular text-[11px] font-bold tracking-wider leading-none">
      MS
    </span>
  </span>
);

export const ZapiaProGraphic: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 144 44"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={`h-10 w-auto ${className}`}
  >
    {/* P */}
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4 2H34C40.6 2 45 6.4 45 14C45 21.6 40.6 26 34 26H18V42H4V2ZM18 11V17H30C32 17 33 15.8 33 14C33 12.2 32 11 30 11H18Z"
      fill="#121311"
    />
    {/* R */}
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M50 2H80C86.6 2 91 6.4 91 13.5C91 18.6 88.2 22.3 83.8 24L92 42H77L70 26H64V42H50V2ZM64 11V17H76C78 17 79 15.6 79 14C79 12.4 78 11 76 11H64Z"
      fill="#121311"
    />
    {/* O */}
    <rect x="96" y="2" width="46" height="40" rx="14" fill="#121311" />
    <rect x="110" y="16" width="18" height="10" rx="5" fill="#C4F16E" />
  </svg>
);

export const ThreadGlyph: React.FC<{
  colorHex: string;
  variant: number;
  isMail?: boolean;
}> = ({ colorHex, variant, isMail }) => {
  if (isMail) {
    return (
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: colorHex }}
      >
        <Mail className="w-4 h-4 text-[#141416]" />
      </span>
    );
  }

  const v = Math.abs(variant) % 4;
  return (
    <span
      className="w-7 h-7 rounded-lg relative overflow-hidden shrink-0 inline-flex items-center justify-center"
      style={{ backgroundColor: colorHex }}
      aria-hidden="true"
    >
      {v === 0 && (
        <>
          <span className="w-1.5 h-3 bg-[#141416] rounded-full -translate-x-1 -translate-y-0.5" />
          <span className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-[#050506] rounded-tl-md" />
        </>
      )}
      {v === 1 && (
        <>
          <span className="w-2.5 h-0.5 bg-[#141416] rotate-[-18deg]" />
          <span className="absolute left-0 top-0 w-2 h-2 bg-[#050506] rounded-br-md" />
        </>
      )}
      {v === 2 && (
        <>
          <span className="w-full h-[1.5px] bg-[#141416] rotate-[12deg]" />
          <span className="w-[1.5px] h-full bg-[#141416] absolute left-2.5 top-0" />
        </>
      )}
      {v === 3 && (
        <span className="w-3 h-3 rounded-sm bg-[#141416]/85 translate-x-1.5 translate-y-1.5" />
      )}
    </span>
  );
};
