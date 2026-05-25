<script lang="ts">
  let { data } = $props();
  let copiedWebhook = $state("");
  let openMenu = $state("");
  const hasTasks = $derived(data.tasks.length > 0);

  function triggerLabel(trigger: string) {
    if (trigger === "webhook") return "Webhook";
    if (trigger === "cron") return "Cron";
    return "Manual";
  }

  async function copyWebhook(task_id: string, endpoint: string) {
    if (!endpoint) return;
    await navigator.clipboard.writeText(endpoint);
    copiedWebhook = task_id;
    openMenu = "";
    setTimeout(() => {
      if (copiedWebhook === task_id) copiedWebhook = "";
    }, 1600);
  }

  function toggleMenu(task_id: string) {
    openMenu = openMenu === task_id ? "" : task_id;
  }
</script>

<svelte:head>
  <title>Tasks | Devo</title>
</svelte:head>

<div class="page">
  <section class="page-header">
    <div>
      <h1>Tasks</h1>
      <p>Create, edit, and run local Bun tasks.</p>
    </div>
    <div class="header-actions">
      <a class="primary-button" href="/tasks/create">Create task</a>
    </div>
  </section>

  <section class="stats-grid">
    <div class="stat-card">
      <span>Total</span>
      <strong>{data.stats.total}</strong>
      <p>Saved local tasks</p>
    </div>
    <div class="stat-card">
      <span>Deployed</span>
      <strong>{data.stats.deployed}</strong>
      <p>Ready for triggers and manual runs</p>
    </div>
    <div class="stat-card">
      <span>Scheduled</span>
      <strong>{data.stats.scheduled}</strong>
      <p>Cron tasks with local scheduler</p>
    </div>
    <div class="stat-card">
      <span>Schedule errors</span>
      <strong>{data.stats.scheduleErrors}</strong>
      <p>Cron expressions needing attention</p>
    </div>
  </section>

  {#if !hasTasks}
    <section class="empty-panel">
      <h2>No tasks yet</h2>
      <p>Create a task from a trigger template, then edit the generated files in the task editor.</p>
      <a class="primary-button" href="/tasks/create">Create task</a>
    </section>
  {:else}
    <section class="panel">
      <div class="panel-header">
        <h2>All tasks</h2>
      </div>
      <div class="table">
        <div class="table-head">
          <span>Task</span>
          <span>Trigger</span>
          <span>Status</span>
          <span>Last run</span>
          <span>Actions</span>
        </div>
        {#each data.tasks as task}
          <div class="table-row">
            <div class="task-cell">
              <a href={`/tasks/${task.id}`}>{task.name}</a>
              <span>{task.description}</span>
            </div>
            <div class="trigger-cell">
              <span class="trigger-value {task.trigger}">{triggerLabel(task.trigger)}</span>
              {#if task.trigger === "cron"}
                <small class:error-text={Boolean(task.schedule_error)}>
                  {task.schedule_error ? task.schedule_error : `Next ${task.next_run}`}
                </small>
              {/if}
            </div>
            <span class="status-text {task.status}">{task.status}</span>
            <span>{task.last_run}</span>
            <div class="row-actions">
              <div class="actions-menu">
                <button
                  class="menu-trigger"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={openMenu === task.id}
                  onclick={() => toggleMenu(task.id)}
                >
                  More
                </button>

                {#if openMenu === task.id}
                  <div class="menu-panel" role="menu">
                    <a role="menuitem" href={`/tasks/${task.id}`}>Edit</a>
                    {#if task.webhook_url}
                      <button role="menuitem" type="button" onclick={() => copyWebhook(task.id, task.webhook_url)}>
                        {copiedWebhook === task.id ? "Copied webhook URL" : "Copy webhook URL"}
                      </button>
                    {/if}
                    <form method="POST" action="?/run">
                      <input type="hidden" name="task_id" value={task.id} />
                      <button role="menuitem" type="submit">Run now</button>
                    </form>
                    <form
                      method="POST"
                      action="?/delete"
                      onsubmit={(event) => {
                        if (!confirm(`Delete ${task.name}? This also deletes its runs and logs.`)) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="task_id" value={task.id} />
                      <button class="danger-menu-item" role="menuitem" type="submit">Delete</button>
                    </form>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .page-header,
  .header-actions,
  .panel-header {
    display: flex;
    align-items: flex-start;
  }

  .page-header,
  .panel-header {
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
  .stat-card p,
  .task-cell span,
  .empty-panel p {
    color: var(--muted-foreground);
  }

  .page-header p,
  .stat-card p {
    margin-top: 5px;
  }

  .header-actions {
    gap: 10px;
    flex-shrink: 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .stat-card,
  .panel,
  .empty-panel {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
  }

  .stat-card {
    padding: 14px;
  }

  .stat-card span {
    color: var(--muted-foreground);
    font-size: 13px;
    font-weight: 650;
  }

  .stat-card strong {
    display: block;
    margin-top: 8px;
    font-size: 26px;
  }

  .empty-panel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 24px;
  }

  .panel {
    overflow: visible;
  }

  .panel-header {
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-soft);
  }

  .table {
    display: grid;
    position: relative;
  }

  .table-head,
  .table-row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 132px 82px 128px 92px;
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

  .table-head > :nth-child(4),
  .table-row > :nth-child(4) {
    white-space: nowrap;
  }

  .task-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .task-cell a {
    color: var(--foreground);
    font-weight: 700;
    text-decoration: none;
  }

  .task-cell a:hover {
    text-decoration: underline;
  }

  .task-cell span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  .trigger-cell {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .trigger-cell small {
    overflow: hidden;
    color: var(--muted-foreground);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trigger-cell small.error-text {
    color: #fb7a7a;
  }

  .trigger-value {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-self: start;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted-foreground);
    font-size: 12px;
    font-weight: 650;
  }

  .trigger-value.webhook::before,
  .trigger-value.cron::before,
  .trigger-value.manual::before {
    content: "";
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    margin-right: 7px;
    border-radius: 999px;
    background: var(--muted-foreground);
  }

  .trigger-value.webhook::before {
    background: #61afef;
  }

  .trigger-value.cron::before {
    background: #d19a66;
  }

  .trigger-value.manual::before {
    background: #98c379;
  }

  .status-text {
    color: var(--muted-foreground);
    font-size: 12px;
    font-weight: 700;
    text-transform: capitalize;
  }

  .status-text.deployed {
    color: #67d46b;
  }

  .status-text.draft {
    color: #f7bd4a;
  }

  .status-text.failed {
    color: #fb7a7a;
  }

  .row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .actions-menu {
    position: relative;
  }

  .menu-trigger {
    min-height: 30px;
    width: 70px;
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    padding: 4px 0;
    text-align: left;
  }

  .menu-trigger:hover {
    color: var(--foreground);
    text-decoration: underline;
  }

  .menu-panel {
    position: absolute;
    z-index: 40;
    top: calc(100% + 6px);
    right: 0;
    width: 178px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18);
  }

  .menu-panel a,
  .menu-panel button {
    width: 100%;
    min-height: 34px;
    display: flex;
    align-items: center;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--foreground);
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    padding: 8px 10px;
    text-align: left;
    text-decoration: none;
  }

  .menu-panel a:hover,
  .menu-panel button:hover {
    background: var(--panel);
  }

  .menu-panel form {
    display: contents;
  }

  .menu-panel .danger-menu-item {
    color: #fb7a7a;
  }

  .menu-panel .danger-menu-item:hover {
    background: rgba(251, 122, 122, 0.08);
  }

  @media (max-width: 920px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .table-head {
      display: none;
    }

    .table-row {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .row-actions {
      justify-content: flex-start;
    }

    .menu-panel {
      right: auto;
      left: 0;
    }
  }

  @media (max-width: 560px) {
    .page-header,
    .header-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .primary-button {
      width: 100%;
    }
  }
</style>
