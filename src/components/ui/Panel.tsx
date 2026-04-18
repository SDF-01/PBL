import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const slab = cva(
  "relative transition-colors",
  {
    variants: {
      variant: {
        base:    "slab",
        raised:  "slab-raised",
        quest:   "quest-board",
        hud:     "battle-hud",
        inventory: "inventory-slot",
      },
      glow: {
        none:     "",
        ember:    "shadow-glow-ember",
        rune:     "shadow-glow-rune",
        spectral: "shadow-glow-spectral",
        gold:     "shadow-glow-gold",
      },
      padding: {
        none: "",
        sm:   "p-3",
        md:   "p-4",
        lg:   "p-6",
      },
    },
    defaultVariants: { variant: "base", glow: "none", padding: "md" },
  },
);

export interface PanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof slab> {}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant, glow, padding, ...props }, ref) => (
    <div ref={ref} className={cn(slab({ variant, glow, padding }), className)} {...props} />
  ),
);
Panel.displayName = "Panel";
