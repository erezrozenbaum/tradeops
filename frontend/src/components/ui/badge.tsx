import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-colors border",
  {
    variants: {
      variant: {
        default: "bg-cyber-cyan/10 border-cyber-cyan/20 text-cyber-cyan",
        success: "bg-cyber-emerald/10 border-cyber-emerald/20 text-cyber-emerald",
        warning: "bg-cyber-amber/10 border-cyber-amber/20 text-cyber-amber",
        danger:  "bg-cyber-red/10  border-cyber-red/20  text-cyber-red",
        purple:  "bg-cyber-purple/10 border-cyber-purple/20 text-cyber-purple",
        muted:   "bg-cyber-rule/60 border-cyber-rule text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
