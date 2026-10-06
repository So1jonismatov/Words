/** Participant-facing pages: content centered in the space between header and footer. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full flex-1 flex-col items-center justify-center px-3 py-2 sm:px-6 sm:py-4">{children}</div>;
}
