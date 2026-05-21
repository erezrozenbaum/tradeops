import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan/60 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-cyber-cyan text-cyber-navy font-semibold hover:bg-cyber-cyan/85 shadow-glow-cyan hover:shadow-[0_0_16px_hsl(199_95%_52%/0.3)]",
        outline:
          "border border-cyber-rule bg-transparent hover:bg-cyber-rule/60 hover:border-cyber-cyan/30 text-foreground",
        ghost:
          "hover:bg-cyber-rule/60 text-foreground",
        destructive:
          "bg-cyber-red/10 border border-cyber-red/30 text-cyber-red hover:bg-cyber-red/20",
        secondary:
          "bg-cyber-panel border border-cyber-rule text-foreground hover:border-cyber-cyan/20 hover:bg-cyber-rule/80",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-7 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = "Button";

export { buttonVariants };
