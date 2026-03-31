"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserData } from "../contexts/UserDataContext";

const THRESHOLD = 56;
const MAX_PULL = 96;
const DAMP = 0.42;
const MIN_REFRESH_MS = 480;
/** Layout offset while refresh runs (spinner strip at top of viewport). */
const REFRESH_SHELF = 52;

/**
 * Mobile pull-to-refresh: entire layout translates down; spinner sits in the gap
 * at the top of the page (Reddit-style).
 */
export default function PullToRefresh({ children }) {
  const router = useRouter();
  const { refreshUserData } = useUserData();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const pullRef = useRef(0);
  const startY = useRef(0);
  const startX = useRef(0);
  const active = useRef(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const check = () => {
      const touch =
        "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
      setEnabled(mq.matches && touch);
    };
    check();
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
  }, []);

  const runRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setPull(REFRESH_SHELF);
    setIsDragging(false);
    const started = performance.now();
    refreshUserData();
    router.refresh();
    window.dispatchEvent(new CustomEvent("refreshNotifications"));
    const elapsed = performance.now() - started;
    if (elapsed < MIN_REFRESH_MS) {
      await new Promise((r) => setTimeout(r, MIN_REFRESH_MS - elapsed));
    }
    setRefreshing(false);
    setPull(0);
    refreshingRef.current = false;
  }, [refreshUserData, router]);

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e) => {
      if (refreshingRef.current) return;
      if (window.scrollY > 4) return;
      const t = e.touches[0];
      if (!t) return;
      if (e.target.closest("input, textarea, select, [contenteditable]")) return;
      startY.current = t.clientY;
      startX.current = t.clientX;
      active.current = true;
      setIsDragging(true);
    };

    const onTouchMove = (e) => {
      if (!active.current || refreshingRef.current) return;
      if (window.scrollY > 4) {
        active.current = false;
        pullRef.current = 0;
        setPull(0);
        setIsDragging(false);
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY.current;
      const dx = t.clientX - startX.current;
      if (dy <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      if (Math.abs(dx) > dy * 1.2) return;

      const next = Math.min(dy * DAMP, MAX_PULL);
      pullRef.current = next;
      setPull(next);
      if (next > 8) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!active.current) return;
      active.current = false;
      const p = pullRef.current;
      pullRef.current = 0;
      setIsDragging(false);

      if (p >= THRESHOLD && !refreshingRef.current) {
        void runRefresh();
      } else {
        setPull(0);
      }
    };

    const onTouchCancel = () => {
      active.current = false;
      pullRef.current = 0;
      setPull(0);
      setIsDragging(false);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });

    const prev = document.documentElement.style.overscrollBehaviorY;
    document.documentElement.style.overscrollBehaviorY = "none";

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
      document.documentElement.style.overscrollBehaviorY = prev;
    };
  }, [enabled, runRefresh]);

  if (!enabled) return children;

  const shelf = refreshing ? REFRESH_SHELF : pull;
  const show = refreshing || pull > 2;
  const progress = Math.min(pull / THRESHOLD, 1);
  const arcRotation = progress * 320;

  return (
    <>
      <div
        className="fixed left-0 right-0 top-0 z-[130] flex items-center justify-center overflow-hidden pointer-events-none bg-[#0d1117]"
        style={{
          height: `${shelf}px`,
          transition: isDragging
            ? "none"
            : "height 0.22s cubic-bezier(0.33, 1, 0.68, 1)",
        }}
        aria-hidden
      >
        {shelf > 0 && (
          <div
            className="flex items-center justify-center"
            style={{
              opacity: show ? Math.min(1, (refreshing ? 1 : pull) / 22) : 0,
            }}
          >
            <svg
              width="34"
              height="34"
              viewBox="0 0 36 36"
              className={refreshing ? "text-amber-500 ptr-spin" : "text-amber-500"}
              style={
                refreshing
                  ? undefined
                  : {
                      transform: `rotate(${arcRotation}deg)`,
                      transition: "transform 0.05s linear",
                    }
              }
            >
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={refreshing ? "22 66" : `${Math.max(8, progress * 44)} 88`}
                strokeDashoffset="0"
                opacity={refreshing ? 1 : 0.82 + progress * 0.18}
              />
            </svg>
          </div>
        )}
      </div>

      <div
        className="flex min-h-screen w-full flex-col flex-grow bg-[#0d1117]"
        style={{
          transform: `translateY(${shelf}px)`,
          transition: isDragging
            ? "none"
            : "transform 0.24s cubic-bezier(0.33, 1, 0.68, 1)",
        }}
      >
        {children}
      </div>
    </>
  );
}
