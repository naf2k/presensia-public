/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Presensia tokens — PRD §21.2. Mirror: @presensia/constants COLOR_TOKENS.
      colors: {
        primary: {
          DEFAULT: "#B85C42",
          deep: "#944631",
          soft: "#F4E2DC",
          ink: "#823C2A",
        },
        secondary: {
          DEFAULT: "#74866A",
          deep: "#55664E",
          soft: "#E5EBE1",
        },
        background: "#F7F4EF",
        surface: "#FFFFFF",
        ink: "#252421",
        muted: "#6D6963",
        line: "#DED8CF",
        "line-soft": "#ECE7DF",
        "surface-2": "#F0ECE6",
        success: "#52705A",
        "success-soft": "#E3ECE5",
        "success-ink": "#3E5D47",
        warning: "#D58A32",
        danger: "#C34F4F",
        "danger-soft": "#F8E2DF",
        "danger-ink": "#99302B",
        "amber-soft": "#F8E8CF",
        "amber-ink": "#7B4C0E",
        "slate-soft": "#E8E6E2",
        "slate-ink": "#504C47",
      },
      fontFamily: {
        sans: ["PlusJakartaSans_400Regular"],
        medium: ["PlusJakartaSans_500Medium"],
        semibold: ["PlusJakartaSans_600SemiBold"],
        bold: ["PlusJakartaSans_700Bold"],
        extrabold: ["PlusJakartaSans_800ExtraBold"],
      },
      borderRadius: {
        card: "16px",
        panel: "20px",
      },
    },
  },
  plugins: [],
};
