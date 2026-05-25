<script lang="ts">
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";

  let { children } = $props();
</script>

<div class="auth-shell">
  <header class="auth-header">
    <a class="brand" href="/" aria-label="Devo home">devo<span>.</span></a>
    <div class="header-actions">
      <ThemeToggle />
    </div>
  </header>

  <main class="auth-main">
    <div class="auth-main-inner">
      {@render children()}
    </div>
  </main>
</div>

<style>
  .auth-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--background);
    color: var(--foreground);
  }

  .auth-header {
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding: 0 24px;
  }

  .brand {
    color: var(--foreground);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0;
    text-decoration: none;
  }

  .brand span {
    color: var(--primary);
  }

  .auth-main {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .auth-main-inner {
    width: 100%;
    min-height: 0;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 520px) {
    .auth-header {
      padding: 0 16px;
    }

    .auth-main {
      padding: 20px 16px;
    }
  }
</style>
