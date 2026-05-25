<script lang="ts">
  let { data, form } = $props();
  let openMenu = $state("");
  const hasRuns = $derived(data.runs.length > 0);

  function triggerLabel(trigger: string) {
    if (trigger === "webhook") return "Webhook";
    if (trigger === "cron") return "Cron";
    return "Manual";
  }

  function toggleMenu(runId: string) {
    openMenu = openMenu === runId ? "" : runId;
  }
</script>

<svelte:head>
  <title>Runs | Devo</title>
</svelte:head>

<div class="page">
  <section class="page-header">
    <div>
      <h1>Runs</h1>
      <p>Review task execution history and logs.</p>
    </div>
    {#if form?.message}
      <span class="form-message">{form.message}</span>
    {/if}
  </section>

  <section class="status-grid">
    <div class="panel summary-card">
      <span>Total</span>
      <strong>{data.stats.total}</strong>
      <p>Retained run history</p>
    </div>
    <div class="panel summary-card">
      <span>Queued</span>
      <strong>{data.stats.queued}</strong>
      <p>Waiting for a worker slot</p>
    </div>
    <div class="panel summary-card">
      <span>Running</span>
      <strong>{data.stats.running}</strong>
      <p>{data.queue.active_count} active child processes</p>
    </div>
    <div class="panel summary-card">
      <span>Failed</span>
      <strong>{data.stats.failed}</strong>
      <p>Errors are visible in run logs</p>
    </div>
  </section>

  {#if !hasRuns}
    <section class="empty-panel">
      <h2>No runs yet</h2>
      <p>Run a task manually, trigger a webhook, or wait for a cron task to execute.</p>
      <a class="primary-button" href="/tasks">View tasks</a>
    </section>
  {:else}
    <section class="panel runs-panel">
      <div class="panel-header">
        <h2>Execution history</h2>
        <span class="small-text">page {data.pagination.page} / {data.pagination.total} runs</span>
      </div>
      <div class="runs-table">
        <div class="runs-head">
          <span>Task</span>
          <span>Status</span>
          <span>Trigger</span>
          <span>Started</span>
          <span>Duration</span>
          <span>Actions</span>
        </div>
        {#each data.runs as run}
          <div class="runs-row">
            <div class="task-cell">
              <a href={`/runs/${run.id}`}>{run.task_name}</a>
              <span class="mono">{run.id}</span>
            </div>
            <span class="status-text {run.status}">{run.status}</span>
            <span class="trigger-value {run.trigger}">{triggerLabel(run.trigger)}</span>
            <span>{run.started}</span>
            <span>{run.duration}</span>
            <div class="run-actions">
              <div class="actions-menu">
                <button
                  class="menu-trigger"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={openMenu === run.id}
                  onclick={() => toggleMenu(run.id)}
                >
                  More
                </button>

                {#if openMenu === run.id}
                  <div class="menu-panel" role="menu">
                    <a role="menuitem" href={`/runs/${run.id}`}>Details</a>
                    {#if run.status === "queued" || run.status === "running"}
                      <form method="POST" action="?/cancel">
                        <input type="hidden" name="run_id" value={run.id} />
                        <button class="danger-menu-item" role="menuitem" type="submit">Cancel</button>
                      </form>
                    {:else}
                      <form method="POST" action="?/retry">
                        <input type="hidden" name="run_id" value={run.id} />
                        <button role="menuitem" type="submit">Retry</button>
                      </form>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
      <div class="pagination">
        <span class="small-text">Showing {data.runs.length} of {data.pagination.total}</span>
        <nav class="pager" aria-label="Runs pagination">
          {#if data.pagination.hasPrevious}
            <a href={data.pagination.previousHref}>Prev</a>
          {:else}
            <span class="disabled">Prev</span>
          {/if}

          {#each data.pagination.items as item}
            {#if item.type === "ellipsis"}
              <span class="ellipsis" aria-hidden="true">...</span>
            {:else if item.page === data.pagination.page}
              <span class="current" aria-current="page">{item.page}</span>
            {:else}
              <a href={item.href}>{item.page}</a>
            {/if}
          {/each}

          {#if data.pagination.hasNext}
            <a href={data.pagination.nextHref}>Next</a>
          {:else}
            <span class="disabled">Next</span>
          {/if}
        </nav>
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
  .summary-card p,
  .small-text,
  .form-message,
  .task-cell span,
  .empty-panel p {
    color: var(--muted-foreground);
  }

  .page-header p,
  .summary-card p {
    margin-top: 5px;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .panel,
  .empty-panel {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    overflow: hidden;
  }

  .runs-panel {
    overflow: visible;
  }

  .summary-card {
    padding: 14px;
  }

  .summary-card span {
    color: var(--muted-foreground);
    font-size: 13px;
    font-weight: 650;
  }

  .summary-card strong {
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

  .panel-header {
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-soft);
  }

  .runs-table {
    display: grid;
  }

  .runs-head,
  .runs-row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 82px 84px 128px 72px 140px;
    gap: 12px;
    align-items: center;
    padding: 11px 16px;
    border-bottom: 1px solid var(--border-soft);
  }

  .runs-head {
    background: var(--panel);
    color: var(--muted-foreground);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .runs-head > *,
  .runs-row > * {
    min-width: 0;
  }

  .task-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .task-cell a {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .status-text.success {
    color: #67d46b;
  }

  .status-text.queued,
  .status-text.running {
    color: #f7bd4a;
  }

  .status-text.canceled {
    color: #51d3c5;
  }

  .status-text.failed {
    color: #fb7a7a;
  }

  .run-actions {
    display: flex;
    align-items: center;
  }

  .run-actions {
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
    left: 0;
    width: 150px;
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

  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
  }

  .pager a,
  .pager span {
    min-width: 28px;
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--muted-foreground);
    font-size: 12px;
    font-weight: 700;
  }

  .pager a {
    text-decoration: none;
  }

  .pager a:hover {
    color: var(--foreground);
    text-decoration: underline;
  }

  .pager .current {
    color: var(--foreground);
  }

  .pager .disabled,
  .pager .ellipsis {
    color: color-mix(in srgb, var(--muted-foreground) 55%, transparent);
    cursor: default;
  }

  .small-button {
    min-height: 28px;
    padding: 4px 9px;
    font-size: 12px;
  }

  @media (max-width: 1080px) {
    .status-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .runs-head {
      display: none;
    }

    .runs-row {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .run-actions {
      justify-content: flex-start;
    }
  }

  @media (max-width: 560px) {
    .page-header,
    .panel-header {
      flex-direction: column;
      align-items: stretch;
    }

    .status-grid {
      grid-template-columns: 1fr;
    }

    .primary-button,
    .secondary-button {
      width: 100%;
    }

    .pagination {
      align-items: flex-start;
      flex-direction: column;
    }

    .pager {
      width: 100%;
      justify-content: flex-start;
      flex-wrap: wrap;
    }
  }
</style>
