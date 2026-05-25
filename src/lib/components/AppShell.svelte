<script lang="ts">
  import { page } from "$app/state";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { IconMenu, IconX } from "$lib/icons";

  let { children, user = null } = $props();
  let mobileNavOpen = $state(false);

  const navItems = $derived([
    { href: "/", label: "Dashboard" },
    { href: "/tasks", label: "Tasks" },
    { href: "/runs", label: "Runs" },
    { href: "/queue", label: "Queue" },
    ...(user?.role === "admin" ? [{ href: "/users", label: "Users" }] : []),
    { href: "/settings", label: "Settings" }
  ]);

  function isActive(href: string) {
    if (href === "/") return page.url.pathname === "/";
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }

  function closeMobileNav() {
    mobileNavOpen = false;
  }
</script>

<div class="app-shell">
  <header class="topbar">
    <div class="topbar-left">
      <button
        class="icon-button mobile-only"
        aria-label="Open navigation"
        type="button"
        onclick={() => (mobileNavOpen = true)}
      >
        <IconMenu size={18} />
      </button>
      <a href="/" class="brand">devo<span>.</span></a>
    </div>
    <div class="topbar-right">
      <ThemeToggle />
    </div>
  </header>

  <div class="main-container">
    <aside class="sidebar" class:open={mobileNavOpen}>
      <div class="sidebar-scroll">
        <div class="sidebar-mobile-head">
          <span class="brand">devo<span>.</span></span>
          <button class="icon-button" aria-label="Close navigation" type="button" onclick={closeMobileNav}>
            <IconX size={18} />
          </button>
        </div>

        <nav class="nav-list" aria-label="Primary navigation">
          {#each navItems as item}
            <a class="nav-item" class:active={isActive(item.href)} href={item.href} onclick={closeMobileNav}>
              {item.label}
            </a>
          {/each}
        </nav>
      </div>

      {#if user}
        <div class="sidebar-footer">
          <div class="sidebar-user-info">
            <span class="sidebar-user-name">{user.name ?? "Unknown"}</span>
            <span class="sidebar-user-email">{user.email}</span>
          </div>
          <form method="POST" action="/logout">
            <button class="sidebar-logout-button" type="submit">Log out</button>
          </form>
        </div>
      {/if}
    </aside>

    <main class="main-content">
      {@render children()}
    </main>
  </div>

  {#if mobileNavOpen}
    <button class="mobile-backdrop" type="button" aria-label="Close navigation" onclick={closeMobileNav}></button>
  {/if}
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: var(--background);
    color: var(--foreground);
    overflow: hidden;
  }

  .topbar {
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 14px;
    border-bottom: 1px solid var(--border-soft);
    background-color: var(--background);
    position: sticky;
    top: 0;
    z-index: 50;
    flex-shrink: 0;
  }

  .topbar-left,
  .topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .brand {
    color: var(--foreground);
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0;
    text-decoration: none;
  }

  .brand span {
    color: var(--primary);
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    min-height: 34px;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: var(--panel);
    color: var(--foreground);
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .icon-button:hover {
    background: var(--panel-strong);
  }

  .mobile-only {
    display: none;
  }

  .main-container {
    min-height: 0;
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .sidebar {
    width: 248px;
    border-right: 1px solid var(--border);
    background-color: var(--sidebar);
    flex-shrink: 0;
    min-height: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
  }

  .sidebar-mobile-head {
    display: none;
  }

  .nav-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    min-height: 30px;
    padding: 5px 10px;
    border-radius: 6px;
    color: color-mix(in srgb, var(--foreground) 76%, var(--muted-foreground));
    font-size: 13px;
    font-weight: 550;
    text-decoration: none;
  }

  .nav-item:hover {
    background: var(--panel-strong);
    color: var(--foreground);
  }

  .nav-item.active {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
    font-weight: 650;
  }

  .sidebar-footer {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    gap: 2px;
    margin-top: auto;
    border-top: 1px solid var(--border-soft);
    padding: 8px;
  }

  .sidebar-user-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 10px 5px;
  }

  .sidebar-user-name,
  .sidebar-user-email {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-user-name {
    color: var(--foreground);
    font-size: 13px;
    font-weight: 675;
    line-height: 1.25;
  }

  .sidebar-user-email {
    color: var(--muted-foreground);
    font-size: 11.5px;
    font-weight: 500;
    line-height: 1.3;
  }

  .sidebar-logout-button {
    width: 100%;
    min-height: 30px;
    display: flex;
    align-items: center;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 72%, var(--muted-foreground));
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    font-weight: 550;
    padding: 5px 10px;
    text-align: left;
  }

  .sidebar-logout-button:hover {
    background: var(--panel-strong);
    color: var(--foreground);
  }

  .main-content {
    flex: 1;
    min-width: 0;
    min-height: 0;
    padding: 28px;
    overflow: auto;
  }

  .mobile-backdrop {
    display: none;
  }

  @media (max-width: 820px) {
    .topbar-right {
      display: none;
    }

    .mobile-only {
      display: inline-flex;
    }

    .sidebar {
      position: fixed;
      top: 56px;
      bottom: 0;
      left: 0;
      z-index: 80;
      height: auto;
      width: min(312px, calc(100vw - 48px));
      transform: translateX(-100%);
      visibility: hidden;
      pointer-events: none;
      transition: transform 0.18s ease;
      box-shadow: 24px 0 48px rgba(0, 0, 0, 0.28);
    }

    .sidebar.open {
      transform: translateX(0);
      visibility: visible;
      pointer-events: auto;
    }

    .sidebar-mobile-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 2px 2px;
    }

    .mobile-backdrop {
      position: fixed;
      top: 56px;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 70;
      display: block;
      border: 0;
      background: rgba(0, 0, 0, 0.48);
    }

    .main-content {
      padding: 18px;
    }
  }
</style>
