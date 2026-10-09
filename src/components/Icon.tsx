import type { Category } from '../engine';

type Name = Category | 'phone' | 'copy' | 'share' | 'print' | 'check' | 'clock' | 'alert' | 'edit' | 'camera' | 'message' | 'chevron' | 'plus' | 'x' | 'lock';

const PATHS: Record<Name, React.ReactNode> = {
  transport: (
    <>
      <path d="M5 16V11l2-5h10l2 5v5" />
      <path d="M3 16h18" />
      <circle cx="7.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
      <path d="M7 11h10" />
    </>
  ),
  meals: (
    <>
      <path d="M4 12h16a8 8 0 0 1-16 0Z" />
      <path d="M9 8c0-1.5 1-1.5 1-3M14 8c0-1.5 1-1.5 1-3" />
    </>
  ),
  household: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  appointments: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 10h16M9 3.5v4M15 3.5v4" />
      <path d="M9.5 14.5 11 16l3.5-3.5" />
    </>
  ),
  equipment: (
    <>
      <path d="M8 4h8" />
      <path d="M9 4 6 20M15 4l3 16" />
      <path d="M7.5 12h9" />
      <circle cx="6" cy="20" r="0.8" />
      <circle cx="18" cy="20" r="0.8" />
    </>
  ),
  relief: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />,
  coordination: (
    <>
      <circle cx="8.5" cy="9" r="3" />
      <circle cx="16.5" cy="10" r="2.5" />
      <path d="M3.5 19c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5" />
      <path d="M14 15.2c.8-.5 1.6-.7 2.5-.7 2 0 3.5 1.3 4 4.5" />
    </>
  ),
  providers: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  coverage: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M12 9v6M9 12h6" />
    </>
  ),
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V4M8 8l4-4 4 4" />
      <path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V4h10v5" />
      <rect x="4" y="9" width="16" height="7" rx="1.5" />
      <path d="M7 14h10v6H7Z" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 21 19.5H3Z" />
      <path d="M12 10v4.5M12 17v.5" />
    </>
  ),
  edit: <path d="M4.5 19.5h4L19 9l-4-4L4.5 15.5Zm9-13 4 4" />,
  camera: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2.5h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  message: <path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4.5 3.5v-3.5h-1Z" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
};

export function Icon({ name, size = 20, className }: { name: Name; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
