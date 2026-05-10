"use client";

import {
  getFunctions,
  connectFunctionsEmulator,
  type Functions,
} from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase";

const REGION = "us-central1";

let _functions: Functions | null = null;

export function fns(): Functions {
  if (_functions) return _functions;
  _functions = getFunctions(getFirebaseApp(), REGION);

  if (
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR === "true"
  ) {
    connectFunctionsEmulator(_functions, "127.0.0.1", 5001);
  }

  return _functions;
}
