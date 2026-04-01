/**
 * Register a one-shot background sync so the service worker can nudge the app
 * when connectivity returns (e.g. flush queued writes). No-op if unsupported.
 */
export async function registerWatchHiveBackgroundSync() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!("sync" in reg) || !reg.sync) return false;
    await reg.sync.register("watchhive-sync");
    return true;
  } catch {
    return false;
  }
}
