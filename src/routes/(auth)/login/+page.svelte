<script lang="ts">
  type LoginForm = {
    email?: string;
    error?: string;
  };

  let { data, form } = $props<{ data: { registrationOpen: boolean }; form?: LoginForm }>();
</script>

<svelte:head>
  <title>Sign in | Devo</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="auth-content">
  <div class="auth-header-text">
    <h1>Welcome back</h1>
    <p>Sign in to your local Devo instance.</p>
  </div>

  {#if form?.error}
    <div class="form-message error">{form.error}</div>
  {/if}

  <form method="POST" action="?/signIn" class="auth-form">
    <div class="form-group">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" value={form?.email ?? ""} required />
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" minlength="8" required />
    </div>

    <button class="btn-primary" type="submit">Sign in</button>
  </form>

  {#if data.registrationOpen}
    <div class="auth-footer-text">
      <p>No admin account yet? <a href="/registration">Create account</a></p>
    </div>
  {/if}
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
    font-size: 14px;
    color: var(--muted-foreground);
  }

  .auth-header-text {
    text-align: center;
    margin-bottom: 24px;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 100%;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    color: var(--foreground);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }

  input {
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    background: var(--input);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--foreground);
    font-size: 14px;
    line-height: 1.4;
  }

  input:focus {
    outline: none;
    border-color: var(--ring);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent);
  }

  .btn-primary {
    width: 100%;
    min-height: 44px;
    border: 0;
    border-radius: var(--radius);
    background: var(--primary);
    color: var(--primary-foreground);
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .form-message {
    margin-bottom: 18px;
    padding: 12px;
    border-radius: var(--radius);
    font-size: 14px;
  }

  .form-message.error {
    background: color-mix(in srgb, var(--destructive) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--destructive) 20%, transparent);
    color: var(--destructive);
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
