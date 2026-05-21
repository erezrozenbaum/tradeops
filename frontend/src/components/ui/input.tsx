import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-cyber-rule bg-cyber-panel px-3 py-1 text-sm font-mono transition-all",
        "placeholder:text-muted-foreground/40",
        "focus-visible:outline-none focus-visible:border-cyber-cyan/40 focus-visible:ring-1 focus-visible:ring-cyber-cyan/30",
        "focus-visible:shadow-[0_0_0_3px_hsl(199_95%_52%/0.08)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
