"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/cn";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed z-[200] flex flex-col gap-2 pointer-events-none bottom-24 left-2 right-2 sm:bottom-auto sm:top-4 sm:right-4 sm:left-auto sm:w-full sm:max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          aria-live={t.variant === "error" ? "assertive" : "polite"}
          className={cn(
            "pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-pixel border shadow-xl backdrop-blur-sm animate-in slide-in-from-right-4 fade-in duration-200",
            t.variant === "success" && "bg-obsidian-800/95 border-ember-500/50",
            t.variant === "error"   && "bg-obsidian-800/95 border-crimson-500/50",
            t.variant === "info"    && "bg-obsidian-800/95 border-obsidian-500",
          )}
        >
          {t.variant === "success" && <CheckCircle2 className="h-4 w-4 text-ember-400 mt-0.5 shrink-0" />}
          {t.variant === "error"   && <AlertCircle  className="h-4 w-4 text-crimson-400 mt-0.5 shrink-0" />}
          {t.variant === "info"    && <Info          className="h-4 w-4 text-ash-400 mt-0.5 shrink-0" />}
          <span className="flex-1 text-sm text-ash-100">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="text-ash-500 hover:text-ash-300 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
