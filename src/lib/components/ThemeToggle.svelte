<script lang="ts">
  import { IconMoon, IconSun } from "$lib/icons";
  import { themeManager } from "$lib/theme.svelte";

  const isDark = $derived(themeManager.currentTheme === "dark");
</script>

<button
  type="button"
  class="theme-toggle"
  onclick={() => themeManager.setTheme(isDark ? "light" : "dark")}
  title={isDark ? "Switch to light mode" : "Switch to dark mode"}
  aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
  aria-pressed={isDark}
>
  <span class="track">
    <span class="handle" class:dark={isDark}></span>
  </span>
  <span class="icons">
    <span class="icon icon-sun" aria-hidden="true">
      <IconSun size={16} />
    </span>
    <span class="icon icon-moon" aria-hidden="true">
      <IconMoon size={16} />
    </span>
  </span>
</button>

<style>
  .theme-toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 9999px;
  }

  .track {
    position: absolute;
    inset: 0;
    background-color: var(--muted);
    border-radius: 9999px;
    border: 1px solid var(--border);
  }

  .handle {
    position: absolute;
    top: 2px;
    left: 2px;
    width: calc(50% - 4px);
    height: calc(100% - 4px);
    background-color: var(--background);
    border-radius: 9999px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s ease;
  }

  .handle.dark {
    transform: translateX(calc(100% + 2px));
  }

  .icons {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    padding: 0 8px;
    pointer-events: none;
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted-foreground);
    transition: color 0.2s;
  }

  :global(.light) .icon-sun {
    color: var(--foreground);
  }

  :global(.light) .icon-moon {
    color: var(--muted-foreground);
  }

  :global(.dark) .icon-sun {
    color: var(--muted-foreground);
  }

  :global(.dark) .icon-moon {
    color: var(--foreground);
  }
</style>
