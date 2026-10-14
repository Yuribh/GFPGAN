// NativeWind / Tailwind mapping. Use bg-surface text-muted, never raw hex.
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  ...{
  "theme": {
    "extend": {
      "colors": {
        "bg": "#f2f2f2",
        "surface": "#ffffff",
        "surface-muted": "#f9f9f9",
        "border": "#e3e6ea",
        "border-input": "#868e98",
        "text": "#292929",
        "text-muted": "#5b6470",
        "accent": "#b5420c",
        "on-accent": "#ffffff",
        "accent-soft": "#fdeee3",
        "danger": "#c62f2f",
        "success": "#1f7a4d",
        "warning": "#8a5a00"
      },
      "fontSize": {
        "xs": [
          "12px",
          {
            "lineHeight": "16px",
            "fontWeight": "500"
          }
        ],
        "sm": [
          "14px",
          {
            "lineHeight": "20px",
            "fontWeight": "400"
          }
        ],
        "base": [
          "16px",
          {
            "lineHeight": "24px",
            "fontWeight": "400"
          }
        ],
        "lg": [
          "20px",
          {
            "lineHeight": "28px",
            "fontWeight": "600"
          }
        ],
        "xl": [
          "28px",
          {
            "lineHeight": "34px",
            "fontWeight": "700"
          }
        ],
        "display": [
          "40px",
          {
            "lineHeight": "44px",
            "fontWeight": "700"
          }
        ]
      },
      "spacing": {
        "0": "0px",
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "24px",
        "6": "32px",
        "7": "48px",
        "8": "64px"
      },
      "borderRadius": {
        "sm": "8px",
        "md": "12px",
        "lg": "20px",
        "pill": "999px"
      }
    }
  }
}
};
