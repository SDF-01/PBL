"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/firebase";

// Mounts once at the root to initialize Firebase Analytics (gtag) in the
// browser. No-ops during static export / SSR and on environments without
// measurementId.
export function AnalyticsLoader() {
  useEffect(() => {
    void initAnalytics();
  }, []);
  return null;
}
