import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        border:      "hsl(var(--border))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        /* semantic finance colors */
        up:   "hsl(var(--up))",
        down: "hsl(var(--down))",
        warn: "hsl(var(--warn))",
        /* named cyber palette — use directly in className */
        cyber: {
          cyan:    "#0dcaf0",
          emerald: "#10b981",
          amber:   "#f59e0b",
          red:     "#ef4444",
          purple:  "#8b5cf6",
          blue:    "#3b82f6",
          navy:    "#090d14",
          surface: "#0d1320",
          panel:   "#111827",
          rule:    "#1e2a3a",
        },
        risk: {
          low:    "#10b981",
          medium: "#f59e0b",
          high:   "#ef4444",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "glow-cyan":    "0 0 0 1px hsl(199 95% 52% / 0.3), 0 0 20px hsl(199 95% 52% / 0.12)",
        "glow-emerald": "0 0 0 1px hsl(160 84% 39% / 0.35), 0 0 20px hsl(160 84% 39% / 0.12)",
        "glow-red":     "0 0 0 1px hsl(0 84% 60% / 0.35), 0 0 16px hsl(0 84% 60% / 0.12)",
        "glow-amber":   "0 0 0 1px hsl(38 92% 50% / 0.35), 0 0 16px hsl(38 92% 50% / 0.10)",
        "card-dark":    "0 1px 3px hsl(220 30% 3% / 0.8), 0 4px 16px hsl(220 30% 3% / 0.5)",
        "card-hover":   "0 2px 8px hsl(199 95% 52% / 0.1), 0 0 0 1px hsl(199 95% 52% / 0.15)",
      },
      animation: {
        "pulse-dot":  "pulse-dot 1.8s ease-in-out infinite",
        "shimmer":    "shimmer 2s linear infinite",
        "count-up":   "count-up 0.4s ease-out forwards",
        "fade-up":    "fade-in-up 0.35s ease-out forwards",
        "border-flow":"border-flow 4s ease infinite",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":       { opacity: "0.4", transform: "scale(0.75)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "border-flow": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":       { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
