/**
 * An inline <script> that runs while the HTML is parsed (before first paint).
 * React never executes scripts it renders on the client and warns about them, so
 * the tag is `text/plain` on the client; `suppressHydrationWarning` accepts the
 * server's `text/javascript`. See the Next guide "Preventing flash before hydration".
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
