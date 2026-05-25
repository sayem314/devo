<script lang="ts">
  let { data, form } = $props();

  const settings = $derived(form?.ai_settings || data.ai_settings);
  const activeProviders = $derived(settings.filter((item) => item.has_api_key));
  let modalOpen = $state(false);
  let modalProvider = $state("openai");
  let accountEditOpen = $state(false);
  const selectedProvider = $derived(
    data.ai_providers.find((item) => item.id === modalProvider) || data.ai_providers[0]
  );
  const selectedSettings = $derived(
    settings.find((item) => item.provider === modalProvider) || {
      provider: modalProvider,
      default_model: selectedProvider.default_model,
      base_url: selectedProvider.default_base_url,
      has_api_key: false,
      models: selectedProvider.default_model ? [selectedProvider.default_model] : [],
      models_updated_at: ""
    }
  );
  const isCustomProvider = $derived(modalProvider === "openai-compatible");
  const modelOptions = $derived(selectedSettings.models || []);

  $effect(() => {
    if (form?.section === "account") {
      accountEditOpen = !form.saved;
    }
  });

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function providerLabel(providerId: string) {
    return data.ai_providers.find((item) => item.id === providerId)?.label || providerId;
  }

  function openAddProvider() {
    modalProvider = settings.find((item) => !item.has_api_key)?.provider || data.ai_providers[0]?.id || "openai";
    modalOpen = true;
  }

  function openEditProvider(providerId: string) {
    modalProvider = providerId;
    modalOpen = true;
  }
</script>

<svelte:head>
  <title>Settings | Devo</title>
</svelte:head>

<div class="page">
  <section class="page-header">
    <div>
      <h1>Settings</h1>
      <p>Manage your account and AI providers.</p>
    </div>
  </section>

  <section class="panel">
    <div class="panel-header">
      <div>
        <h2>Account</h2>
        <p>Update your local profile and password.</p>
      </div>
      {#if !accountEditOpen}
        <button class="secondary-button small-button" type="button" onclick={() => (accountEditOpen = true)}>
          Edit profile
        </button>
      {/if}
    </div>

    {#if form?.message && (form.section === "account" || form.section === "password")}
      <div class:error-message={!form.saved} class:success-message={form.saved}>{form.message}</div>
    {/if}

    {#if accountEditOpen}
      <form method="POST" action="?/updateProfile" class="account-form">
        <input class="hidden-username" name="email" value={data.account.email} autocomplete="username" tabindex="-1" />
        <div class="edit-group">
          <div class="group-title">
            <h3>Profile</h3>
            <p>Visible inside this Devo instance.</p>
          </div>
          <label class="field">
            <span>Name</span>
            <input name="name" value={form?.name || data.account.name} autocomplete="name" required />
          </label>
        </div>

        <div class="edit-group">
          <div class="group-title">
            <h3>Password</h3>
            <p>Leave blank to keep your current password.</p>
          </div>
          <div class="account-edit-grid">
            <label class="field">
              <span>Current password</span>
              <input name="current_password" type="password" autocomplete="current-password" />
            </label>
            <label class="field">
              <span>New password</span>
              <input name="new_password" type="password" autocomplete="new-password" minlength="8" />
            </label>
            <label class="field">
              <span>Confirm new password</span>
              <input name="confirm_password" type="password" autocomplete="new-password" minlength="8" />
            </label>
          </div>
        </div>

        <div class="form-actions">
          <button class="secondary-button" type="button" onclick={() => (accountEditOpen = false)}>Cancel</button>
          <button class="primary-button" type="submit">Save profile</button>
        </div>
      </form>
    {:else}
      <div class="account-summary">
        <div>
          <span>Name</span>
          <strong>{data.account.name}</strong>
        </div>
        <div>
          <span>Email</span>
          <strong>{data.account.email}</strong>
        </div>
        <div>
          <span>Password</span>
          <strong>Configured</strong>
        </div>
      </div>
    {/if}
  </section>

  <section class="panel">
    <div class="panel-header">
      <div>
        <h2>AI providers</h2>
        <p>Active providers are available from the task editor chat.</p>
      </div>
      <button class="primary-button" type="button" onclick={openAddProvider}>Add provider</button>
    </div>

    {#if form?.message && form.section === "ai"}
      <div class:error-message={!form.saved} class:success-message={form.saved}>{form.message}</div>
    {/if}

    {#if activeProviders.length === 0}
      <div class="empty-panel">
        <h3>No active providers</h3>
        <p>Add an API key for OpenAI, Claude, OpenRouter, or a custom OpenAI-compatible provider.</p>
      </div>
    {:else}
      <div class="provider-table">
        <div class="provider-head">
          <span>Provider</span>
          <span>Default model</span>
          <span>Models</span>
          <span>Refreshed</span>
          <span>Actions</span>
        </div>
        {#each activeProviders as item}
          <div class="provider-row">
            <strong>{providerLabel(item.provider)}</strong>
            <span>{item.default_model || "Not selected"}</span>
            <span>{item.models.length}</span>
            <span>{item.models_updated_at ? formatDateTime(item.models_updated_at) : "SDK defaults"}</span>
            <div class="row-actions">
              <form method="POST" action="?/refreshModels">
                <input type="hidden" name="provider" value={item.provider} />
                <button class="secondary-button small-button" type="submit">Refresh</button>
              </form>
              <button
                class="secondary-button small-button"
                type="button"
                onclick={() => openEditProvider(item.provider)}
              >
                Edit
              </button>
              <form
                method="POST"
                action="?/deleteAi"
                onsubmit={(event) => {
                  if (!confirm(`Delete ${providerLabel(item.provider)}?`)) event.preventDefault();
                }}
              >
                <input type="hidden" name="provider" value={item.provider} />
                <button class="secondary-button danger-button small-button" type="submit">Delete</button>
              </form>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

{#if modalOpen}
  <div class="modal-backdrop" role="presentation" onclick={() => (modalOpen = false)}></div>
  <div class="modal-shell" role="dialog" aria-modal="true" aria-labelledby="provider-modal-title">
    <form method="POST" action="?/saveAi" class="modal-card">
      <div class="modal-header">
        <div>
          <h2 id="provider-modal-title">{selectedSettings.has_api_key ? "Edit provider" : "Add provider"}</h2>
          <p>
            {selectedSettings.has_api_key
              ? "Update credentials and default model."
              : "Choose a provider and add an API key."}
          </p>
        </div>
      </div>

      <label class="field">
        <span>Provider</span>
        <select name="provider" bind:value={modalProvider}>
          {#each data.ai_providers as item}
            <option value={item.id}>{item.label}</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span>API key</span>
        <input
          name="api_key"
          type="password"
          autocomplete="off"
          placeholder={selectedSettings.has_api_key ? "Saved. Enter a new key to replace." : "Provider API key"}
        />
      </label>

      {#if isCustomProvider}
        <label class="field">
          <span>Base URL</span>
          <input
            name="base_url"
            value={selectedSettings.base_url}
            placeholder={selectedProvider.default_base_url || "https://api.example.com/v1"}
          />
        </label>
      {:else}
        <input type="hidden" name="base_url" value={selectedSettings.base_url} />
      {/if}

      <label class="field">
        <span>Default model</span>
        <select name="default_model" value={selectedSettings.default_model} disabled={modelOptions.length === 0}>
          {#if modelOptions.length === 0}
            <option value="">Save API key to load models</option>
          {:else}
            {#each modelOptions as model}
              <option value={model}>{model}</option>
            {/each}
          {/if}
        </select>
      </label>

      <div class="model-meta">
        <span>{modelOptions.length} models available</span>
        <span>
          {#if selectedSettings.models_updated_at}
            Refreshed {formatDateTime(selectedSettings.models_updated_at)}
          {:else}
            SDK defaults shown
          {/if}
        </span>
      </div>

      <div class="modal-footer">
        <button class="secondary-button" type="button" onclick={() => (modalOpen = false)}>Cancel</button>
        <button class="primary-button" type="submit">Save provider</button>
      </div>
    </form>
  </div>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .page-header,
  .panel-header,
  .provider-head,
  .provider-row,
  .row-actions,
  .modal-header,
  .modal-footer,
  .model-meta {
    display: flex;
    align-items: flex-start;
  }

  .page-header,
  .panel-header,
  .modal-header {
    justify-content: space-between;
    gap: 18px;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  h1 {
    font-size: 24px;
    line-height: 1.2;
  }

  h2,
  h3 {
    font-size: 15px;
  }

  .page-header p,
  .panel-header p,
  .empty-panel p,
  .provider-row span,
  .model-meta,
  .modal-header p {
    color: var(--muted-foreground);
  }

  .page-header p,
  .panel-header p,
  .modal-header p {
    margin-top: 5px;
  }

  .panel,
  .modal-card {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
  }

  .panel {
    overflow: hidden;
  }

  .panel-header {
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-soft);
  }

  .empty-panel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 22px 16px;
  }

  .account-summary,
  .account-edit-grid {
    display: grid;
    gap: 12px;
  }

  .account-summary {
    grid-template-columns: minmax(160px, 0.8fr) minmax(220px, 1.2fr) 140px;
    padding: 16px;
  }

  .account-summary div {
    min-width: 0;
    display: grid;
    gap: 5px;
  }

  .account-summary span {
    color: var(--muted-foreground);
    font-size: 12px;
    font-weight: 750;
  }

  .account-summary strong {
    min-width: 0;
    overflow: hidden;
    color: var(--foreground);
    font-size: 13px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  .account-edit-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .edit-group {
    display: grid;
    gap: 12px;
  }

  .edit-group + .edit-group {
    border-top: 1px solid var(--border-soft);
    padding-top: 16px;
  }

  .group-title {
    display: grid;
    gap: 5px;
  }

  .group-title p {
    color: var(--muted-foreground);
    font-size: 13px;
  }

  .form-actions {
    border-top: 1px solid var(--border-soft);
    padding-top: 14px;
    display: flex;
    gap: 10px;
    justify-content: flex-start;
  }

  .provider-table {
    display: grid;
  }

  .provider-head,
  .provider-row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) 76px 132px 218px;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-soft);
  }

  .provider-head {
    background: var(--panel);
    color: var(--muted-foreground);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .provider-row > *,
  .provider-head > * {
    min-width: 0;
  }

  .provider-row strong,
  .provider-row span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .provider-row strong {
    font-size: 13px;
  }

  .row-actions {
    justify-content: flex-end;
    gap: 8px;
  }

  .row-actions form {
    display: flex;
  }

  .small-button {
    min-height: 28px;
    padding: 4px 9px;
    font-size: 12px;
  }

  .danger-button {
    color: #fb7a7a;
  }

  .danger-button:hover {
    border-color: color-mix(in srgb, var(--red) 45%, var(--border));
    background: color-mix(in srgb, var(--red) 12%, var(--panel));
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.52);
  }

  .modal-shell {
    position: fixed;
    inset: 0;
    z-index: 110;
    display: grid;
    place-items: center;
    padding: 18px;
    pointer-events: none;
  }

  .modal-card {
    width: min(560px, 100%);
    max-height: min(720px, calc(100vh - 36px));
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: auto;
    padding: 16px;
    pointer-events: auto;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.32);
  }

  .modal-header {
    align-items: flex-start;
    border-bottom: 1px solid var(--border-soft);
    padding-bottom: 14px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: var(--foreground);
    font-size: 13px;
    font-weight: 700;
  }

  input,
  select {
    min-height: 40px;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: var(--panel);
    color: var(--foreground);
    font: inherit;
    font-size: 14px;
    outline: none;
    padding: 0 11px;
  }

  .hidden-username {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  input:focus,
  select:focus {
    border-color: var(--primary);
  }

  input:disabled,
  select:disabled,
  button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .model-meta {
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid var(--border-soft);
    padding-top: 12px;
    font-size: 12px;
  }

  .modal-footer {
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid var(--border-soft);
    padding-top: 14px;
  }

  .error-message,
  .success-message {
    margin: 12px 16px;
    border-radius: 7px;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 700;
  }

  .error-message {
    border: 1px solid rgba(239, 68, 68, 0.35);
    background: rgba(239, 68, 68, 0.08);
    color: #ef4444;
  }

  .success-message {
    border: 1px solid rgba(34, 197, 94, 0.35);
    background: rgba(34, 197, 94, 0.08);
    color: #16a34a;
  }

  @media (max-width: 980px) {
    .account-summary,
    .account-edit-grid {
      grid-template-columns: 1fr;
    }

    .provider-head {
      display: none;
    }

    .provider-row {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .row-actions {
      justify-content: flex-start;
    }
  }

  @media (max-width: 560px) {
    .page-header,
    .panel-header,
    .modal-header,
    .modal-footer,
    .model-meta,
    .row-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .primary-button,
    .secondary-button {
      width: 100%;
    }
  }
</style>
