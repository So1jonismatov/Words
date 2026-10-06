/** Original mark: a tiny association network (a cue connected to its answers). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className} fill="none">
      <path d="M16 16 7 9M16 16l10-5M16 16l-3 10M16 16l9 7" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="7" cy="9" r="2.6" fill="currentColor" fillOpacity=".55" />
      <circle cx="26" cy="11" r="2.2" fill="currentColor" fillOpacity=".55" />
      <circle cx="13" cy="26" r="2.2" fill="currentColor" fillOpacity=".55" />
      <circle cx="25" cy="23" r="1.8" fill="currentColor" fillOpacity=".55" />
      <circle cx="16" cy="16" r="4.4" fill="currentColor" />
    </svg>
  );
}
