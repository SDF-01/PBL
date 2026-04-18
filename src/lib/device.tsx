"use client";

// Device detection — synchronous on first render via UA sniff, then kept in
// sync with matchMedia on resize/rotate. This gives us a zero-flash initial
// render for mobile users landing from a phone while remaining reactive to
// window resizes for dev tools.
//
// We treat "mobile" as viewport-first (<= 767px) with UA as a tiebreaker.
// Tablet (768–1023px) is considered desktop for layout purposes.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const MOBILE_MAX_WIDTH = 767;

const MOBILE_UA =
  /iPhone|iPod|Android.+Mobile|BlackBerry|IEMobile|Opera Mini|Mobile Safari|webOS/i;

function detectFromUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return MOBILE_UA.test(navigator.userAgent);
}

function detectFromViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
}

export function detectMobile(): boolean {
  // Viewport wins when available (dev-tools toggle, resize); UA is fallback.
  if (typeof window === "undefined") return false;
  return detectFromViewport() || detectFromUserAgent();
}

interface DeviceCtx {
  isMobile: boolean;
  ready: boolean;
}

const DeviceContext = createContext<DeviceCtx>({ isMobile: false, ready: false });

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIsMobile(detectMobile());
    setReady(true);

    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    const handler = () => setIsMobile(detectMobile());
    // addEventListener is the standard; fall back to addListener for Safari < 14.
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  const value = useMemo(() => ({ isMobile, ready }), [isMobile, ready]);
  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice(): DeviceCtx {
  return useContext(DeviceContext);
}

export function useIsMobile(): boolean {
  return useContext(DeviceContext).isMobile;
}
