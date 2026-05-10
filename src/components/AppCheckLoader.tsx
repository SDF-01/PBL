"use client";

import { useEffect } from "react";
import { initAppCheck } from "@/lib/appcheck";

// Mounts at the root to initialize Firebase App Check as early as possible
// so attestation tokens accompany subsequent Firebase product calls.
// No-ops during SSR / static export and on environments without a
// configured reCAPTCHA Enterprise site key.
export function AppCheckLoader() {
  useEffect(() => {
    void initAppCheck();
  }, []);
  return null;
}
