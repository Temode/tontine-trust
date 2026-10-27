import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["DM Sans", "Inter", "system-ui", "sans-serif"],
        serif: ["'Playfair Display'", "Georgia", "serif"],
      },
      fontSize: {
        "display-lg": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.025em", fontWeight: "700" }],
        "display": ["1.875rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
        "title": ["1.5rem", { lineHeight: "1.25", letterSpacing: "-0.015em", fontWeight: "700" }],
        "subtitle": ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "amount-lg": ["2rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "amount": ["1.5rem", { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "700" }],
        "body": ["1rem", { lineHeight: "1.55" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5" }],
        "caption": ["0.8125rem", { lineHeight: "1.45" }],
        "label": ["0.75rem", { lineHeight: "1.2", letterSpacing: "0.08em", fontWeight: "600" }],
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
          50: "hsl(var(--primary-50))",
          100: "hsl(var(--primary-100))",
          200: "hsl(var(--primary-200))",
          300: "hsl(var(--primary-300))",
          400: "hsl(var(--primary-400))",
          500: "hsl(var(--primary-500))",
          600: "hsl(var(--primary-600))",
          700: "hsl(var(--primary-700))",
          800: "hsl(var(--primary-800))",
          900: "hsl(var(--primary-900))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          50: "hsl(var(--accent-50))",
          100: "hsl(var(--accent-100))",
          300: "hsl(var(--accent-300))",
          500: "hsl(var(--accent-500))",
          600: "hsl(var(--accent-600))",
          700: "hsl(var(--accent-700))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chat: {
          surface: "hsl(var(--chat-surface))",
          in: "hsl(var(--chat-bubble-in))",
          "in-foreground": "hsl(var(--chat-bubble-in-foreground))",
          out: "hsl(var(--chat-bubble-out))",
          "out-foreground": "hsl(var(--chat-bubble-out-foreground))",
          receipt: "hsl(var(--chat-receipt))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      boxShadow: {
        "ring-soft": "inset 0 0 0 1px hsl(var(--border))",
        soft: "0 1px 2px 0 hsl(200 30% 9% / 0.04), 0 1px 1px 0 hsl(200 30% 9% / 0.02)",
        card: "0 1px 2px 0 hsl(200 30% 9% / 0.04), 0 8px 24px -12px hsl(200 30% 9% / 0.08)",
        primary: "0 1px 2px 0 hsl(187 75% 19% / 0.08), 0 12px 28px -16px hsl(187 75% 19% / 0.4)",
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
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
