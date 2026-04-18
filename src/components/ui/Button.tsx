import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const btn = cva(
  "inline-flex items-center justify-center gap-2 font-heading uppercase tracking-wider text-sm transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-ember-500 text-obsidian-900 hover:bg-ember-400 border border-ember-600 shadow-[0_2px_0_0_rgba(0,0,0,0.6)]",
        rune:
          "bg-rune-500 text-white hover:bg-rune-400 border border-rune-600 shadow-[0_2px_0_0_rgba(0,0,0,0.6)]",
        ghost:
          "bg-transparent text-ash-100 hover:bg-obsidian-500 border border-obsidian-400 hover:border-obsidian-300",
        outline:
          "bg-obsidian-700 text-ash-100 border border-steel-500 hover:border-spectral-500 hover:text-spectral-500",
        danger:
          "bg-crimson-600 text-white hover:bg-crimson-500 border border-crimson-600",
        link:
          "text-spectral-500 hover:text-spectral-400 underline-offset-4 hover:underline bg-transparent border-0",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof btn> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(btn({ variant, size }), "rounded-pixel", className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
