"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Panel } from "./Panel";

interface ConfirmDialogProps {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  submitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  submitting = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-sm"
      onClick={() => !submitting && onCancel()}
    >
      <Panel
        variant="quest"
        padding="lg"
        className="w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-pixel bg-crimson-500/15 shrink-0">
            <AlertTriangle className="h-5 w-5 text-crimson-400" />
          </div>
          <div>
            <h2 className="heading-fantasy text-ash-100 text-base">{title}</h2>
            {description && (
              <p className="text-ash-400 text-sm mt-1">{description}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={variant}
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? "Working…" : confirmLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
