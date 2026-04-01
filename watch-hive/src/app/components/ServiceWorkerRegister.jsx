"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});

    const onSwMessage = (event) => {
      if (event.data?.type === "WATCHHIVE_SYNC") {
        window.dispatchEvent(new CustomEvent("watchhive:sync"));
      }
    };
    navigator.serviceWorker.addEventListener("message", onSwMessage);

    const onOnline = () => {
      window.dispatchEvent(new CustomEvent("watchhive:online"));
    };
    window.addEventListener("online", onOnline);

    return () => {
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
      window.removeEventListener("online", onOnline);
    };
  }, []);
  return null;
}
