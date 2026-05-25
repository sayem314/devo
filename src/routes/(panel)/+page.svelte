<script lang="ts">
  type TriggerType = "webhook" | "cron" | "manual";
  let { data } = $props();

  const hasTasks = $derived(data.tasks.length > 0);

  function triggerLabel(trigger: TriggerType) {
    if (trigger === "webhook") return "Webhook";
    if (trigger === "cron") return "Cron";
    return "Manual";
  }
</script>

<svelte:head>
  <title>Dashboard | Devo</title>
</svelte:head>

<div class="dashboard-page">
  <section class="page-header">
    <div>
      <h1>Dashboard</h1>
      <p>Recent task activity and local runtime status.</p>
    </div>
    <div class="header-actions">
      <a class="primary-button" href="/tasks/create">Create task</a>
    </div>
  </section>

  <section class="stats-grid" aria-label="Runtime stats">
    <div class="stat-card">
      <span>Tasks</span>
      <strong>{data.stats.tasks}</strong>
      <p>{data.stats.deployed} deployed</p>
    </div>
    <div class="stat-card">
      <span>Running</span>
      <strong>{data.stats.running}</strong>
      <p>{Math.max(0, data.queue.max_workers - data.queue.active_count)} idle worker slots</p>
    </div>
    <div class="stat-card">
      <span>Queued</span>
      <strong>{data.stats.queued}</strong>
      <p>Waiting for the local task pool</p>
    </div>
    <div class="stat-card">
      <span>Failed runs</span>
      <strong>{data.stats.failures}</strong>
      <p>Across retained run history</p>
    </div>
  </section>

  <section class="runtime-strip" aria-label="Scheduler status">
    <div>
      <span>Scheduler</span>
      <strong>{data.scheduler.started ? "On" : "Off"}</strong>
    </div>
    <div>
      <span>Task runtime</span>
      <strong>{data.queue.runtime}</strong>
    </div>
    <div>
      <span>Last tick</span>
      <strong>{data.scheduler.last_tick}</strong>
    </div>
    <div>
      <span>Status</span>
      <strong>{data.scheduler.last_error || `every ${Math.round(data.scheduler.interval_ms / 1000)}s`}</strong>
    </div>
  </section>

  {#if !hasTasks}
    <section class="empty-panel">
      <h2>No tasks yet</h2>
      <p>Create a task from a trigger template, then edit the generated files in the task editor.</p>
      <div class="empty-actions">
        <a class="primary-button" href="/tasks/create">Create task</a>
      </div>
    </section>
  {:else}
    <section class="bottom-grid">
      <div class="panel">
        <div class="section-header">
          <h2>Recent tasks</h2>
          <a class="view-link" href="/tasks">View all</a>
        </div>
        <div class="task-list">
          {#each data.tasks.slice(0, 6) as task}
            <a class="task-row" href={`/tasks/${task.id}`}>
              <span class="task-main">
                <span class="task-name">{task.name}</span>
                <span class="task-meta">
                  {triggerLabel(task.trigger)} / {task.last_run}
                </span>
              </span>
              <span class="status-text {task.status}">{task.status}</span>
            </a>
          {/each}
        </div>
      </div>

      <div class="panel">
        <div class="section-header">
          <h2>Recent runs</h2>
          <a class="view-link" href="/runs">View all</a>
        </div>
        <div class="runs-table">
          <div class="runs-head">
            <span>Run</span>
            <span>Status</span>
            <span>Time</span>
            <span>Duration</span>
          </div>
          {#each data.runs as run}
            <a class="runs-row" href={`/runs/${run.id}`}>
              <span class="mono">{run.id}</span>
              <span class="status-text {run.status}">{run.status}</span>
              <span>{run.time}</span>
              <span>{run.duration}</span>
            </a>
          {/each}
          {#if data.runs.length === 0}
            <div class="empty-row">No runs yet.</div>
          {/if}
        </div>
      </div>
    </section>
  {/if}
</div>

<style>
  .dashboard-page {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .page-header,
  .header-actions,
  .section-header {
    display: flex;
    align-items: flex-start;
  }

  .page-header,
  .section-header {
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
  .task-meta,
  .runtime-strip span,
  .empty-panel p,
  .empty-row {
    color: var(--muted-foreground);
  }

  .page-header p,
  .stat-card p {
    margin-top: 5px;
  }

  .header-actions,
  .empty-actions {
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
  .runtime-strip,
  .empty-panel {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
  }

  .stat-card {
    min-width: 0;
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
    line-height: 1.15;
  }

  .runtime-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0;
    overflow: hidden;
  }

  .runtime-strip div {
    min-width: 0;
    padding: 12px 14px;
    border-right: 1px solid var(--border-soft);
  }

  .runtime-strip div:last-child {
    border-right: 0;
  }

  .runtime-strip span,
  .runtime-strip strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .runtime-strip span {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .runtime-strip strong {
    margin-top: 5px;
    font-size: 13px;
  }

  .empty-panel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 24px;
  }

  .empty-actions {
    display: flex;
    margin-top: 4px;
  }

  .section-header {
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-soft);
  }

  .view-link {
    color: var(--muted-foreground);
    font-size: 13px;
    font-weight: 700;
  }

  .view-link:hover {
    color: var(--foreground);
    text-decoration: underline;
  }

  .bottom-grid {
    display: grid;
    grid-template-columns: minmax(280px, 0.95fr) minmax(360px, 1.05fr);
    gap: 16px;
  }

  .panel {
    overflow: hidden;
  }

  .task-list {
    display: flex;
    flex-direction: column;
  }

  .task-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 64px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-soft);
    color: var(--foreground);
    text-decoration: none;
  }

  .task-row:hover,
  .runs-row:hover {
    background: var(--panel);
  }

  .task-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .task-name {
    font-weight: 700;
  }

  .task-meta {
    font-size: 12px;
  }

  .status-text {
    color: var(--muted-foreground);
    font-size: 12px;
    font-weight: 700;
    text-transform: capitalize;
    white-space: nowrap;
  }

  .status-text.success,
  .status-text.deployed {
    color: #67d46b;
  }

  .status-text.queued,
  .status-text.running,
  .status-text.draft {
    color: #f7bd4a;
  }

  .status-text.canceled {
    color: #51d3c5;
  }

  .status-text.failed {
    color: #fb7a7a;
  }

  .runs-table {
    display: grid;
  }

  .runs-head,
  .runs-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 76px 128px 76px;
    gap: 10px;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border-soft);
  }

  .runs-head > *,
  .runs-row > * {
    min-width: 0;
  }

  .runs-head span:nth-child(3),
  .runs-row span:nth-child(3) {
    white-space: nowrap;
  }

  .runs-head {
    background: var(--panel);
    color: var(--muted-foreground);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .runs-row {
    min-height: 46px;
    color: var(--foreground);
    text-decoration: none;
  }

  .empty-row {
    padding: 16px;
  }

  @media (max-width: 1180px) {
    .stats-grid,
    .runtime-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .runtime-strip div:nth-child(2) {
      border-right: 0;
    }

    .runtime-strip div:nth-child(-n + 2) {
      border-bottom: 1px solid var(--border-soft);
    }

    .bottom-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 820px) {
    .page-header {
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
      justify-content: space-between;
    }
  }

  @media (max-width: 560px) {
    .stats-grid,
    .runtime-strip {
      grid-template-columns: 1fr;
    }

    .runtime-strip div,
    .runtime-strip div:nth-child(2) {
      border-right: 0;
      border-bottom: 1px solid var(--border-soft);
    }

    .runtime-strip div:last-child {
      border-bottom: 0;
    }

    .section-header,
    .header-actions,
    .empty-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .primary-button {
      width: 100%;
    }

    .runs-head,
    .runs-row {
      grid-template-columns: 1fr 86px;
    }

    .runs-head span:nth-child(3),
    .runs-head span:nth-child(4),
    .runs-row span:nth-child(3),
    .runs-row span:nth-child(4) {
      display: none;
    }
  }
</style>
