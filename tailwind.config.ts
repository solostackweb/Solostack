import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      // Extra `xs` breakpoint so we can tune the smallest phones (≈360–414px)
      // independently of `sm` (640px). Everything below `xs` falls back to
      // the mobile-first base styles.
      screens: {
        xs: "420px",
      },
      fontSize: {
        // Hard floor is 12px — nothing smaller ships. `micro` replaces the
        // 545 uses of text-[11px] and 216 of text-[10px] found in the audit.
        micro: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
        xs: ["0.75rem", { lineHeight: "1.125rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "5xl": ["3rem", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "6xl": ["3.75rem", { lineHeight: "1.02", letterSpacing: "-0.025em" }],
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          subtle: "hsl(var(--destructive-subtle))",
          strong: "hsl(var(--destructive-strong))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          subtle: "hsl(var(--success-subtle))",
          strong: "hsl(var(--success-strong))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          subtle: "hsl(var(--warning-subtle))",
          strong: "hsl(var(--warning-strong))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          subtle: "hsl(var(--info-subtle))",
          strong: "hsl(var(--info-strong))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "slide-up-fade": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down-fade": {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        // ── Brand loading system ────────────────────────────────────────────
        // Calm pulse: the icon breathes — scale + opacity, never jarring.
        "brand-breathe": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(0.94)" },
        },
        // The two white bars slide in from left with stagger applied via delay
        "bar-reveal": {
          from: { opacity: "0", transform: "translateX(-6px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        // Page-level content fade+lift — after route lands
        "page-enter": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        // Route progress bar fill
        "progress-fill": {
          from: { transform: "translateX(-100%)" },
          to:   { transform: "translateX(-5%)" },
        },
        // Splash exit — the whole screen fades away
        "splash-exit": {
          from: { opacity: "1" },
          to:   { opacity: "0", pointerEvents: "none" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        shimmer: "shimmer 1.8s infinite",
        "slide-up-fade": "slide-up-fade 0.22s cubic-bezier(0.22,1,0.36,1)",
        "slide-down-fade": "slide-down-fade 0.18s cubic-bezier(0.22,1,0.36,1)",
        "scale-in": "scale-in 0.18s cubic-bezier(0.22,1,0.36,1)",
        // Brand loading system
        "brand-breathe":  "brand-breathe 2.2s cubic-bezier(0.45,0,0.55,1) infinite",
        "bar-reveal":     "bar-reveal 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "page-enter":     "page-enter 0.28s cubic-bezier(0.22,1,0.36,1) both",
        "progress-fill":  "progress-fill 2.4s cubic-bezier(0.25,1,0.5,1) forwards",
        "splash-exit":    "splash-exit 0.5s cubic-bezier(0.4,0,1,1) forwards",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
