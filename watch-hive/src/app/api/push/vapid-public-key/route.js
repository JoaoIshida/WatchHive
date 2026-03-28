export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'VAPID not configured' }), { status: 503 });
  }
  return new Response(JSON.stringify({ publicKey: key }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
