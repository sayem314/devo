<script lang="ts">
  let { data, form } = $props();

  const payload = $derived(data.run.payload === undefined ? "No payload." : JSON.stringify(data.run.payload, null, 2));
  const result = $derived(data.run.result === undefined ? "No result." : JSON.stringify(data.run.result, null, 2));
  const logs = $derived(
    data.run.logs.length > 0
      ? data.run.logs.map((entry) => `${entry.time} ${entry.level} ${entry.message}`).join("\n")
      : "No logs captured."
  );
</script>

<svelte:head>
  <title>{data.run.id} | Devo</title>
</svelte:head>

<div class="page">
  <section class="page-header">
    <div>
      <a class="back-link" href="/runs">Runs</a>
      <h1>{data.run.id}</h1>
      <p>{data.run.task_name} / {data.run.trigger} / {data.run.worker}</p>
    </div>
    <div class="header-actions">
      {#if form?.message}
        <span class="form-message">{form.message}</span>
      {/if}
      {#if data.run.status === "queued" || data.run.status === "running"}
        <form method="POST" action="?/cancel">
          <button class="secondary-button danger-button" type="submit">Cancel</button>
        </form>
      {:else}
        <form method="POST" action="?/retry">
          <button class="primary-button" type="submit">Retry</button>
        </form>
      {/if}
    </div>
  </section>

  <section class="status-grid">
    <div class="panel summary-card">
      <div class="status-line">
        <span>Status</span>
        <strong class="status-text {data.run.status}">{data.run.status}</strong>
      </div>
      <p>{data.run.error || "No error recorded"}</p>
    </div>
    <div class="panel summary-card">
      <span>Started</span>
      <strong>{data.run.started}</strong>
      <p>Finished: {data.run.finished}</p>
    </div>
    <div class="panel summary-card">
      <span>Duration</span>
      <strong>{data.run.duration}</strong>
      <p>Worker: {data.run.worker}</p>
    </div>
  </section>

  <section class="detail-grid">
    <div class="panel logs-panel">
      <div class="panel-header">
        <h2>Logs</h2>
        <span class="mono small-text">{data.run.logs.length} lines</span>
      </div>
      <pre class="logs mono">{logs}</pre>
    </div>

    <div class="side-column">
      <div class="panel">
        <div class="panel-header">
          <h2>Payload</h2>
        </div>
        <pre class="json-block mono">{payload}</pre>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2>Result</h2>
        </div>
        <pre class="json-block mono">{result}</pre>
      </div>
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
    margin-top: 4px;
    font-size: 24px;
    line-height: 1.2;
  }

  .page-header p,
  .summary-card p,
  .small-text,
  .form-message,
  .back-link {
    color: var(--muted-foreground);
  }

  .back-link {
    font-size: 13px;
    font-weight: 750;
  }

  .back-link:hover {
    color: var(--foreground);
  }

  .page-header p,
  .summary-card p {
    margin-top: 5px;
  }

  .header-actions {
    gap: 10px;
    flex-shrink: 0;
  }

  .header-actions form {
    display: flex;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  .panel {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    overflow: hidden;
  }

  .summary-card {
    padding: 16px;
  }

  .summary-card span {
    color: var(--muted-foreground);
    font-weight: 650;
  }

  .status-line {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .summary-card strong:not(.status-text) {
    display: block;
    margin-top: 8px;
    font-size: 20px;
  }

  .status-text {
    color: var(--muted-foreground);
    font-size: 13px;
    font-weight: 750;
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

  .detail-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
    gap: 16px;
    align-items: start;
  }

  .side-column {
    display: grid;
    gap: 16px;
    min-width: 0;
  }

  .panel-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-soft);
  }

  .panel-header h2 {
    font-size: 15px;
  }

  .logs,
  .json-block {
    margin: 0;
    background: #1f2329;
    color: var(--foreground);
    font-size: 12px;
    line-height: 1.75;
    overflow: auto;
    white-space: pre-wrap;
  }

  .logs {
    min-height: 520px;
    padding: 16px;
  }

  .json-block {
    max-height: 260px;
    padding: 14px;
  }

  :global(:root.light) .logs,
  :global(:root.light) .json-block {
    background: #ffffff;
  }

  .danger-button {
    color: #fb7a7a;
  }

  .danger-button:hover {
    border-color: color-mix(in srgb, var(--red) 45%, var(--border));
    background: color-mix(in srgb, var(--red) 12%, var(--panel));
  }

  @media (max-width: 1080px) {
    .detail-grid,
    .status-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 560px) {
    .page-header,
    .header-actions {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
