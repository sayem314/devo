<script lang="ts">
  import { page } from "$app/state";

  const error = $derived(
    page.url.searchParams.get("error") ||
      page.url.searchParams.get("message") ||
      "Authentication could not be completed."
  );
</script>

<svelte:head>
  <title>Auth error | Devo</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="auth-content">
  <div class="auth-header-text">
    <h1>Auth error</h1>
    <p>{error}</p>
  </div>

  <div class="auth-footer-text">
    <p><a href="/login">Back to sign in</a></p>
  </div>
</section>

<style>
  .auth-content {
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  h1,
  p {
    margin: 0;
  }

  h1 {
    color: var(--foreground);
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  p {
    color: var(--muted-foreground);
    font-size: 14px;
  }

  .auth-header-text {
    text-align: center;
    margin-bottom: 24px;
  }

  .auth-footer-text {
    text-align: center;
  }

  a {
    color: var(--primary);
    font-weight: 500;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
</style>
