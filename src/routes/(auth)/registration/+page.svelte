<script lang="ts">
  type RegistrationForm = {
    name?: string;
    email?: string;
    error?: string;
  };

  let { form } = $props<{ form?: RegistrationForm }>();
</script>

<svelte:head>
  <title>Create account | Devo</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="auth-content">
  <div class="auth-header-text">
    <div class="step-badge">Local account</div>
    <h1>Create admin account</h1>
    <p>The first account becomes the admin for this Devo instance.</p>
  </div>

  {#if form?.error}
    <div class="form-message error">{form.error}</div>
  {/if}

  <form method="POST" action="?/signUp" class="auth-form">
    <div class="form-group">
      <label for="name">Name</label>
      <input id="name" name="name" type="text" autocomplete="name" value={form?.name ?? ""} required />
    </div>

    <div class="form-group">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" value={form?.email ?? ""} required />
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required />
    </div>

    <button class="btn-primary" type="submit">Create account</button>
  </form>

  <div class="auth-footer-text">
    <p>Already have an account? <a href="/login">Sign in</a></p>
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

  .step-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 5px 10px;
    margin-bottom: 12px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
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
