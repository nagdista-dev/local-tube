/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f0f0f",
          50: "#1a1a1a",
          100: "#212121",
          200: "#2a2a2a",
          300: "#333333",
        },
        brand: {
          DEFAULT: "#e50914",
          hover: "#f40612",
          light: "#ff6b6b",
          dark: "#c41a0b",
          darkHover: "#a01509",
        },
        accent: {
          DEFAULT: "#6c63ff",
          dark: "#5050d0",
          darkHover: "#4040b0",
        },
      },
      fontFamily: {
        sans: ["Inter", "Tajawal", "system-ui", "sans-serif"],
        arabic: ["Tajawal", "system-ui", "sans-serif"],
      },
      animation: {
        shimmer: "shimmer 1.6s infinite linear",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-700px 0" },
          "100%": { backgroundPosition: "700px 0" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
