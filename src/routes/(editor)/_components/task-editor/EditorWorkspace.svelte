<script lang="ts">
  import CodeEditor from "$lib/components/CodeEditor.svelte";
  import { parseEnvText, type EditorTab, type TypeLib } from "../task-editor-model";
  import RunConsole from "./RunConsole.svelte";
  import type { ValidationIssue } from "$lib/tasks/validation";

  type PanelTab = "output" | "terminal";

  type RunPreview = {
    id: string;
    status: "queued" | "running" | "success" | "failed" | "canceled";
    error?: string;
    result?: unknown;
    logs: Array<{
      time: string;
      level: "info" | "warn" | "error" | "result";
      message: string;
    }>;
  };

  let {
    activeTab = $bindable<EditorTab>("task"),
    code = $bindable(""),
    env_text = $bindable(""),
    package_json_text = $bindable(""),
    fileRevision = 0,
    typeLibs = [],
    envDiagnostics = [],
    packageDiagnostics = [],
    run,
    runStatus = "",
    runIsRunning = false,
    task_id = "",
    terminalEnabled = false,
    bottomPanelOpen = $bindable(true),
    bottomPanelTab = $bindable<PanelTab>("output"),
    onCloseRun
  }: {
    activeTab?: EditorTab;
    code?: string;
    env_text?: string;
    package_json_text?: string;
    fileRevision?: number;
    typeLibs?: TypeLib[];
    envDiagnostics?: ValidationIssue[];
    packageDiagnostics?: ValidationIssue[];
    run?: RunPreview;
    runStatus?: string;
    runIsRunning?: boolean;
    task_id?: string;
    terminalEnabled?: boolean;
    bottomPanelOpen?: boolean;
    bottomPanelTab?: PanelTab;
    onCloseRun?: () => void;
  } = $props();

  const parsed_env = $derived(parseEnvText(env_text));
  const env_json = $derived(JSON.stringify(parsed_env));
  const env_usage = $derived(parsed_env[0]?.name ? `process.env.${parsed_env[0].name}` : "process.env.KEY");
</script>

<section class="panel code-panel">
  <input type="hidden" name="env" value={env_json} />
  <input type="hidden" name="env_text" value={env_text} />
  <div class="editor-workbench">
    <aside class="file-explorer" aria-label="Task files">
      <div class="explorer-title">Files</div>
      <button
        class:active={activeTab === "env"}
        class:invalid={envDiagnostics.length > 0}
        type="button"
        onclick={() => (activeTab = "env")}
      >
        <span class="file-dot env"></span>
        .env
      </button>
      <button
        class:active={activeTab === "package"}
        class:invalid={packageDiagnostics.length > 0}
        type="button"
        onclick={() => (activeTab = "package")}
      >
        <span class="file-dot package"></span>
        package.json
      </button>
      <button class:active={activeTab === "task"} type="button" onclick={() => (activeTab = "task")}>
        <span class="file-dot task"></span>
        main.ts
      </button>
      <div class="explorer-title panel-title">Panel</div>
      <button
        class:active={bottomPanelOpen && bottomPanelTab === "output"}
        type="button"
        onclick={() => {
          bottomPanelTab = "output";
          bottomPanelOpen = true;
        }}
      >
        Output
      </button>
      <button
        class:active={bottomPanelOpen && bottomPanelTab === "terminal"}
        type="button"
        onclick={() => {
          bottomPanelTab = "terminal";
          bottomPanelOpen = true;
        }}
      >
        Terminal
      </button>
    </aside>

    <div class="editor-main">
      <input type="hidden" name="package_json" value={package_json_text} />
      <div class:active={activeTab === "task"} class="tab-panel">
        <label class="sr-only" for="task-code">Task code</label>
        {#key `task-${fileRevision}`}
          <CodeEditor name="code" bind:value={code} extraLibs={typeLibs} />
        {/key}
      </div>

      <div class:active={activeTab === "env"} class="tab-panel settings-panel">
        <div class="env-editor mono">
          {#key `env-${fileRevision}`}
            <CodeEditor bind:value={env_text} language="dotenv" name={null} diagnostics={envDiagnostics} />
          {/key}
          <div class="env-footer">
            <span
              >Use <code>KEY=value</code> lines. Blank lines and lines starting with <code>#</code> are ignored.</span
            >
            <code>{env_usage}</code>
          </div>
        </div>
      </div>

      <div class:active={activeTab === "package"} class="tab-panel settings-panel">
        {#key `package-${fileRevision}`}
          <CodeEditor bind:value={package_json_text} language="json" name={null} diagnostics={packageDiagnostics} />
        {/key}
      </div>
    </div>
  </div>

  {#if bottomPanelOpen}
    <RunConsole
      {run}
      status={runStatus}
      isRunning={runIsRunning}
      bind:activePanel={bottomPanelTab}
      {task_id}
      {terminalEnabled}
      onClose={onCloseRun}
    />
  {/if}
</section>

<style>
  .panel {
    min-width: 0;
    min-height: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    overflow: hidden;
  }

  .code-panel {
    display: flex;
    flex-direction: column;
    border-right: 1px solid #343b46;
  }

  :global(:root.light) .code-panel {
    border-right-color: #d7dae0;
  }

  .editor-workbench {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .file-explorer {
    width: 172px;
    flex-shrink: 0;
    border-right: 1px solid #343b46;
    background: #1b1f24;
    padding: 10px 8px;
    overflow: auto;
  }

  :global(:root.light) .file-explorer {
    border-right-color: #d7dae0;
    background: #fbfbfb;
  }

  .explorer-title {
    padding: 0 8px 8px;
    color: #7f8794;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  :global(:root.light) .explorer-title {
    color: #696c77;
  }

  .panel-title {
    margin-top: 14px;
  }

  .file-explorer button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 32px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: #abb2bf;
    padding: 6px 8px;
    text-align: left;
    font-weight: 750;
  }

  :global(:root.light) .file-explorer button {
    color: #383a42;
  }

  .file-explorer button:hover,
  .file-explorer button.active {
    background: #252a32;
    color: #ffffff;
  }

  .file-explorer button.invalid {
    color: #fb7a7a;
  }

  :global(:root.light) .file-explorer button:hover,
  :global(:root.light) .file-explorer button.active {
    background: #edf1f7;
    color: #1f2329;
  }

  :global(:root.light) .file-explorer button.invalid {
    color: #d1242f;
  }

  .file-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #5c6370;
    flex-shrink: 0;
  }

  .file-dot.env {
    background: #98c379;
  }

  .file-dot.package {
    background: #c678dd;
  }

  .file-dot.task {
    background: #61afef;
  }

  .editor-main {
    min-width: 0;
    min-height: 0;
    flex: 1;
    display: flex;
  }

  .tab-panel {
    display: none;
  }

  .tab-panel.active {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .settings-panel {
    background: #1f2329;
    overflow: auto;
  }

  :global(:root.light) .settings-panel {
    background: #ffffff;
  }

  .env-editor {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
  }

  .env-editor :global(.editor-frame) {
    min-height: 0;
    flex: 1;
  }

  .env-footer {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 14px;
    border-top: 1px solid #343b46;
    color: #7f8794;
    font-size: 12px;
  }

  .env-footer code {
    color: #61afef;
    white-space: nowrap;
  }

  :global(:root.light) .env-footer {
    border-top-color: #d7dae0;
    color: #696c77;
  }

  :global(:root.light) .env-footer code {
    color: #4078f2;
  }

  @media (max-width: 1080px) {
    .code-panel {
      border-right: 0;
      border-bottom: 1px solid #343b46;
    }

    :global(:root.light) .code-panel {
      border-bottom-color: #d7dae0;
    }
  }

  @media (max-width: 720px) {
    .editor-workbench {
      flex-direction: column;
    }

    .file-explorer {
      width: auto;
      display: flex;
      gap: 8px;
      border-right: 0;
      border-bottom: 1px solid #343b46;
      overflow-x: auto;
    }

    :global(:root.light) .file-explorer {
      border-bottom-color: #d7dae0;
    }

    .explorer-title {
      display: none;
    }

    .file-explorer button {
      width: auto;
      white-space: nowrap;
    }

    .env-footer {
      flex-direction: column;
    }
  }
</style>
