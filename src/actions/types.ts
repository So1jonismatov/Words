/** Result of a server action. `error` is a message key the client translates. */
export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };
