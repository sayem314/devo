<script lang="ts">
  let { data, form } = $props();

  const users = $derived(form?.users || data.users);
  let modalOpen = $state(false);

  $effect(() => {
    if (form?.message && !form.saved && (form.name || form.email || form.role)) {
      modalOpen = true;
    }
  });

  function formatDate(value: number) {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
</script>

<svelte:head>
  <title>Users | Devo</title>
</svelte:head>

<div class="page">
  <section class="page-header">
    <div>
      <h1>Users</h1>
      <p>Manage local accounts for this Devo instance.</p>
    </div>
    <button class="primary-button" type="button" onclick={() => (modalOpen = true)}>Add user</button>
  </section>

  {#if form?.message}
    <div class:error-message={!form.saved} class:success-message={form.saved}>{form.message}</div>
  {/if}

  <section class="panel">
    <div class="panel-header">
      <div>
        <h2>All users</h2>
        <p>{users.length} {users.length === 1 ? "account" : "accounts"}</p>
      </div>
    </div>

    <div class="table">
      <div class="table-head">
        <span>User</span>
        <span>Role</span>
        <span>Created</span>
        <span>Actions</span>
      </div>
      {#each users as user}
        <div class="table-row">
          <div class="user-cell">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <span class="role-text {user.role}">{user.role}</span>
          <span class="date-cell">{formatDate(user.created_at)}</span>
          <div class="row-actions">
            {#if user.id === data.current_user_id}
              <span class="current-user">Current user</span>
            {:else}
              <form
                method="POST"
                action="?/delete"
                onsubmit={(event) => {
                  if (!confirm(`Delete ${user.email}? This also deletes their tasks and runs.`)) {
                    event.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="user_id" value={user.id} />
                <button class="secondary-button danger-button small-button" type="submit">Delete</button>
              </form>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>

{#if modalOpen}
  <div class="modal-backdrop" role="presentation" onclick={() => (modalOpen = false)}></div>
  <div class="modal-shell" role="dialog" aria-modal="true" aria-labelledby="add-user-title">
    <form method="POST" action="?/create" class="modal-card">
      <div class="modal-header">
        <div>
          <h2 id="add-user-title">Add user</h2>
          <p>Created users can sign in immediately with email and password.</p>
        </div>
      </div>

      <label class="field">
        <span>Name</span>
        <input name="name" value={form?.name || ""} autocomplete="name" required />
      </label>
      <label class="field">
        <span>Email</span>
        <input name="email" type="email" value={form?.email || ""} autocomplete="email" required />
      </label>
      <label class="field">
        <span>Password</span>
        <input name="password" type="password" autocomplete="new-password" minlength="8" required />
      </label>
      <label class="field">
        <span>Role</span>
        <select name="role" value={form?.role || "user"}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </label>

      <div class="modal-footer">
        <button class="secondary-button" type="button" onclick={() => (modalOpen = false)}>Cancel</button>
        <button class="primary-button" type="submit">Add user</button>
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
  .row-actions,
  .modal-header,
  .modal-footer {
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
  p {
    margin: 0;
  }

  h1 {
    font-size: 24px;
    line-height: 1.2;
  }

  h2 {
    font-size: 15px;
  }

  .page-header p,
  .panel-header p,
  .modal-header p,
  .user-cell span,
  .date-cell,
  .current-user {
    color: var(--muted-foreground);
  }

  .page-header p,
  .panel-header p,
  .modal-header p {
    margin-top: 5px;
  }

  .panel,
  .modal-card {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
  }

  .panel-header {
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-soft);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 7px;
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

  input:focus,
  select:focus {
    border-color: var(--primary);
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
    width: min(520px, 100%);
    max-height: min(680px, calc(100vh - 36px));
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

  .modal-footer {
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid var(--border-soft);
    padding-top: 14px;
  }

  .table {
    display: grid;
  }

  .table-head,
  .table-row {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) 90px 146px 120px;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-soft);
  }

  .table-head {
    background: var(--panel);
    color: var(--muted-foreground);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .table-head > *,
  .table-row > * {
    min-width: 0;
  }

  .user-cell {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  }

  .user-cell strong,
  .user-cell span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .role-text {
    color: var(--muted-foreground);
    font-size: 12px;
    font-weight: 700;
    text-transform: capitalize;
  }

  .role-text.admin {
    color: #61afef;
  }

  .date-cell,
  .current-user {
    font-size: 12px;
    font-weight: 650;
    white-space: nowrap;
  }

  .row-actions {
    justify-content: flex-end;
  }

  .row-actions form {
    display: flex;
  }

  .small-button {
    min-height: 30px;
    padding: 5px 10px;
  }

  .danger-button {
    color: #fb7a7a;
  }

  .danger-button:hover {
    border-color: color-mix(in srgb, var(--red) 45%, var(--border));
    background: color-mix(in srgb, var(--red) 12%, var(--panel));
  }

  .error-message,
  .success-message {
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

  @media (max-width: 760px) {
    .table-row {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .table-head {
      display: none;
    }

    .row-actions {
      justify-content: flex-start;
    }
  }

  @media (max-width: 560px) {
    .page-header,
    .modal-header,
    .modal-footer {
      flex-direction: column;
      align-items: stretch;
    }

    .primary-button {
      width: 100%;
    }
  }
</style>
