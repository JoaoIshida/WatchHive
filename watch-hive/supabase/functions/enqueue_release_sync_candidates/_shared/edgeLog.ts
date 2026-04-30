/** Structured logs for Supabase Edge (grep-friendly JSON lines). */
export function edgeLog(
  fn: string,
  msg: string,
  data?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      fn,
      msg,
      ...data,
    }),
  );
}
