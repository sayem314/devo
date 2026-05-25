import { browser } from "$app/environment";

export type Theme = "light" | "dark";

class ThemeManager {
  currentTheme = $state<Theme>("light");

  constructor() {
    if (browser) {
      const saved = localStorage.getItem("devo-theme") as Theme | null;
      if (saved === "light" || saved === "dark") {
        this.currentTheme = saved;
      }
    }
  }

  setTheme(theme: Theme) {
    this.currentTheme = theme;
    if (browser) {
      localStorage.setItem("devo-theme", theme);
      this.apply();
    }
  }

  apply() {
    if (!browser) return;
    const root = document.documentElement;

    if (this.currentTheme === "dark") {
      root.classList.remove("light");
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      root.style.colorScheme = "light";
    }
  }
}

export const themeManager = new ThemeManager();
