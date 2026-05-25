<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>Queue | Devo</title>
</svelte:head>

<div class="page">
  <section class="page-header">
    <div>
      <h1>Queue</h1>
      <p>Pending and running jobs in the local task execution pool.</p>
    </div>
    {#if form?.message}
      <span class="form-message">{form.message}</span>
    {/if}
  </section>

  <section class="stats-grid">
    <div class="stat-card">
      <span>Queued</span>
      <strong>{data.snapshot.queued.length}</strong>
      <p>Across all task triggers</p>
    </div>
    <div class="stat-card">
      <span>Running</span>
      <strong>{data.snapshot.active_count}</strong>
      <p>Out of {data.snapshot.max_workers} worker slots</p>
    </div>
    <div class="stat-card">
      <span>Idle slots</span>
      <strong>{Math.max(0, data.snapshot.max_workers - data.snapshot.active_count)}</strong>
      <p>Available for immediate execution</p>
    </div>
    <div class="stat-card">
      <span>Scheduler</span>
      <strong>{data.scheduler.started ? "On" : "Off"}</strong>
      <p>{data.scheduler.last_error || `Ticks every ${Math.round(data.scheduler.interval_ms / 1000)}s`}</p>
    </div>
  </section>

  <section class="panel">
    <div class="panel-header">
      <h2>Queue items</h2>
      <span class="mono small-text">last tick: {data.scheduler.last_tick}</span>
    </div>
    <div class="table">
      <div class="table-head">
        <span>Job</span>
        <span>Task</span>
        <span>State</span>
        <span>Worker</span>
        <span>Actions</span>
      </div>
      {#each data.items as item}
        <div class="table-row">
          <span class="mono">{item.run_id}</span>
          <strong>{item.task}</strong>
          <span class="state-text {item.state}">{item.state}</span>
          <span class="mono">{item.worker}</span>
          <form method="POST" action="?/cancel">
            <input type="hidden" name="run_id" value={item.run_id} />
            <button class="cancel-button" type="submit">Cancel</button>
          </form>
        </div>
      {/each}
      {#if data.items.length === 0}
        <div class="empty-state">Queue is empty.</div>
      {/if}
    </div>
  </section>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 22px;
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

  .page-header p,
  .stat-card p,
  .small-text,
  .form-message {
    color: var(--muted-foreground);
  }

  .page-header p,
  .stat-card p {
    margin-top: 5px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .stat-card,
  .panel {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    overflow: hidden;
  }

  .stat-card {
    padding: 16px;
  }

  .stat-card span {
    color: var(--muted-foreground);
    font-weight: 650;
  }

  .stat-card strong {
    display: block;
    margin-top: 8px;
    font-size: 26px;
  }

  .panel-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-soft);
  }

  .panel-header h2 {
    font-size: 15px;
  }

  .table {
    display: grid;
  }

  .table-head,
  .table-row {
    display: grid;
    grid-template-columns: 120px minmax(220px, 1fr) 96px 120px 84px;
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

  .state-text {
    justify-self: start;
    color: var(--muted-foreground);
    font-size: 12px;
    font-weight: 700;
    text-transform: capitalize;
  }

  .state-text.queued,
  .state-text.running {
    color: #f7bd4a;
  }

  .table-row form {
    display: flex;
    align-items: center;
  }

  .cancel-button {
    min-height: 30px;
    border: 0;
    background: transparent;
    color: #fb7a7a;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    padding: 4px 0;
    text-align: left;
  }

  .cancel-button:hover {
    text-decoration: underline;
  }

  .empty-state {
    padding: 18px 16px;
    color: var(--muted-foreground);
  }

  @media (max-width: 1080px) {
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
  }

  @media (max-width: 560px) {
    .page-header {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
