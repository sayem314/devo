<svelte:head>
  <title>Verify email | Devo</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="auth-content">
  <div class="auth-header-text">
    <h1>Verify email</h1>
    <p>Email verification is not required for this local Devo instance.</p>
  </div>

  <div class="notice">
    <p>When email delivery is configured, verification links and status will be handled here.</p>
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

  .notice {
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--secondary) 88%, transparent);
  }

  .auth-footer-text {
    margin-top: 28px;
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
