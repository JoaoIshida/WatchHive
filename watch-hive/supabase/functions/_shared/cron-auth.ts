export function assertCronOrServiceRequest(req: Request): Response | null {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return null;
  const h = req.headers.get("x-cron-secret");
  if (h !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

/** Alias for enqueue / process / send_due — same rules as `assertCronOrServiceRequest`. */
export const assertCronAuthorized = assertCronOrServiceRequest;
