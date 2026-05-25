<script lang="ts">
  import { IconX } from "$lib/icons";

  type PanelTab = "output" | "terminal";

  type RunLog = {
    time: string;
    level: "info" | "warn" | "error" | "result";
    message: string;
  };

  type RunPreview = {
    id: string;
    status: "queued" | "running" | "success" | "failed" | "canceled";
    error?: string;
    result?: unknown;
    logs: RunLog[];
  };

  let {
    run,
    status,
    isRunning,
    activePanel = $bindable<PanelTab>("output"),
    task_id = "",
    terminalEnabled = false,
    onClose
  }: {
    run?: RunPreview;
    status: string;
    isRunning: boolean;
    activePanel?: PanelTab;
    task_id?: string;
    terminalEnabled?: boolean;
    onClose?: () => void;
  } = $props();

  let command = $state("");
  let terminalText = $state("");
  let terminalRunning = $state(false);
  const resultText = $derived(run?.result === undefined ? "" : JSON.stringify(run.result, null, 2));

  async function runTerminalCommand() {
    const line = command.trim();
    if (!line || terminalRunning || !terminalEnabled || !task_id) return;

    terminalRunning = true;
    activePanel = "terminal";
    command = "";

    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task_id)}/terminal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: line })
      });

      if (!response.ok || !response.body) {
        const message = await response.text().catch(() => "");
        throw new Error(message || "Command failed to start.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        terminalText += decoder.decode(value, { stream: true });
      }
      terminalText += decoder.decode();
    } catch (error) {
      terminalText += `\n${error instanceof Error ? error.message : "Command failed."}\n`;
    } finally {
      terminalRunning = false;
    }
  }
</script>

<section class="run-console" aria-label="Editor bottom panel">
  <div class="console-head">
    <div class="panel-tabs" role="tablist" aria-label="Editor panel tabs">
      <button class:active={activePanel === "output"} type="button" role="tab" onclick={() => (activePanel = "output")}>
        Output
      </button>
      <button
        class:active={activePanel === "terminal"}
        type="button"
        role="tab"
        onclick={() => (activePanel = "terminal")}
      >
        Terminal
      </button>
      {#if activePanel === "output" && run}
        <span>{run.id}</span>
      {/if}
    </div>
    {#if activePanel === "output"}
      <em class:active={isRunning}>{status || run?.status}</em>
    {:else}
      <em class:active={terminalRunning}>{terminalRunning ? "Running" : ""}</em>
    {/if}
    <button
      class="close-button"
      type="button"
      aria-label="Hide run output"
      title="Hide run output"
      onclick={() => onClose?.()}
    >
      <IconX size={14} strokeWidth={2.2} />
    </button>
  </div>

  {#if activePanel === "output"}
    {#if run?.error}
      <div class="run-error">{run.error}</div>
    {/if}

    <div class="console-body">
      {#if run?.logs.length}
        {#each run.logs as log}
          <div class="log-line {log.level}">
            <span>{log.level}</span>
            <code>{log.message}</code>
          </div>
        {/each}
      {:else}
        <div class="log-line muted">
          <span>info</span>
          <code>{status || "No run output yet."}</code>
        </div>
      {/if}
    </div>

    {#if resultText}
      <pre class="run-result">{resultText}</pre>
    {/if}
  {:else}
    <div class="terminal-body">
      <pre>{terminalText ||
          (terminalEnabled ? "Run commands in the saved task directory." : "Save this task to use Terminal.")}</pre>
    </div>

    <form
      class="terminal-input"
      onsubmit={(event) => {
        event.preventDefault();
        void runTerminalCommand();
      }}
    >
      <span>$</span>
      <input
        bind:value={command}
        name="devo-terminal-command"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck={false}
        disabled={!terminalEnabled || terminalRunning}
        placeholder={terminalEnabled ? "bun add zod" : "Save task to use terminal"}
      />
      <button type="submit" disabled={!terminalEnabled || terminalRunning || !command.trim()}>
        {terminalRunning ? "Running" : "Run"}
      </button>
    </form>
  {/if}
</section>

<style>
  .run-console {
    flex-shrink: 0;
    display: grid;
    border-top: 1px solid #343b46;
    background: #1b1f24;
  }

  :global(:root.light) .run-console {
    border-color: #d7dae0;
    background: #fbfbfb;
  }

  .console-head {
    min-height: 34px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 10px;
    padding: 7px 12px;
  }

  .panel-tabs {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .panel-tabs button {
    min-height: 24px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: #7f8794;
    font: inherit;
    font-size: 12px;
    font-weight: 750;
    padding: 3px 8px;
  }

  .panel-tabs button:hover,
  .panel-tabs button.active {
    background: #252a32;
    color: #d7dae0;
  }

  :global(:root.light) .panel-tabs button {
    color: #696c77;
  }

  :global(:root.light) .panel-tabs button:hover,
  :global(:root.light) .panel-tabs button.active {
    background: #edf1f7;
    color: #383a42;
  }

  .console-head span,
  .console-head em {
    color: #7f8794;
    font-size: 11px;
    font-style: normal;
    font-weight: 750;
  }

  :global(:root.light) .console-head span,
  :global(:root.light) .console-head em {
    color: #696c77;
  }

  .console-head em {
    text-transform: uppercase;
  }

  .console-head em.active {
    color: #61afef;
  }

  .close-button {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: #7f8794;
    padding: 0;
  }

  .close-button:hover {
    background: #252a32;
    color: #d7dae0;
  }

  :global(:root.light) .close-button {
    color: #696c77;
  }

  :global(:root.light) .close-button:hover {
    background: #edf1f7;
    color: #383a42;
  }

  .console-body {
    max-height: 180px;
    overflow: auto;
    border-top: 1px solid #343b46;
    padding: 8px 12px;
  }

  :global(:root.light) .console-body {
    border-top-color: #d7dae0;
  }

  .log-line {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    gap: 10px;
    color: #abb2bf;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 12px;
    line-height: 1.55;
  }

  :global(:root.light) .log-line {
    color: #383a42;
  }

  .log-line span {
    color: #7f8794;
  }

  .log-line.error span,
  .run-error {
    color: #fb7a7a;
  }

  .log-line.warn span {
    color: #e5c07b;
  }

  .log-line.result span {
    color: #98c379;
  }

  .log-line code {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .run-error {
    border-top: 1px solid color-mix(in srgb, var(--red) 35%, #343b46);
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 700;
  }

  .run-result {
    max-height: 180px;
    margin: 0;
    overflow: auto;
    border-top: 1px solid #343b46;
    color: #98c379;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 12px;
    line-height: 1.55;
    padding: 8px 12px;
    white-space: pre-wrap;
  }

  :global(:root.light) .run-result {
    border-top-color: #d7dae0;
    color: #2f8f46;
  }

  .terminal-body {
    max-height: 180px;
    overflow: auto;
    border-top: 1px solid #343b46;
    background: #1f2329;
  }

  :global(:root.light) .terminal-body {
    border-top-color: #d7dae0;
    background: #ffffff;
  }

  .terminal-body pre {
    min-height: 120px;
    margin: 0;
    color: #abb2bf;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 12px;
    line-height: 1.55;
    padding: 8px 12px;
    white-space: pre-wrap;
  }

  :global(:root.light) .terminal-body pre {
    color: #383a42;
  }

  .terminal-input {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    border-top: 1px solid #343b46;
    background: #1b1f24;
    padding: 8px 12px;
  }

  :global(:root.light) .terminal-input {
    border-top-color: #d7dae0;
    background: #fbfbfb;
  }

  .terminal-input span {
    color: #98c379;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-weight: 800;
  }

  .terminal-input input {
    min-width: 0;
    border: 0;
    background: transparent;
    color: #abb2bf;
    outline: none;
  }

  :global(:root.light) .terminal-input input {
    color: #383a42;
  }

  .terminal-input button {
    min-height: 26px;
    border: 0;
    background: transparent;
    color: #7f8794;
    font-weight: 750;
    padding: 0;
  }

  .terminal-input button:hover:not(:disabled) {
    color: #d7dae0;
    text-decoration: underline;
  }

  .terminal-input button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  :global(:root.light) .terminal-input button:hover:not(:disabled) {
    color: #383a42;
  }
</style>
