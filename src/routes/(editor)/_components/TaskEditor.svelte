<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import AgentPanel from "./task-editor/AgentPanel.svelte";
  import EditorWorkspace from "./task-editor/EditorWorkspace.svelte";
  import InstallStatus from "./task-editor/InstallStatus.svelte";
  import TaskSettingsPanel from "./task-editor/TaskSettingsPanel.svelte";
  import TaskEditorTitlebar from "./task-editor/TaskEditorTitlebar.svelte";
  import TemplatePicker from "./task-editor/TemplatePicker.svelte";
  import ValidationBanner from "./task-editor/ValidationBanner.svelte";
  import { readAgentResponse } from "./task-editor/agent-client";
  import {
    type AgentMessage,
    type AiProviderOption,
    type AiProviderSettings,
    defaultPackageJson,
    formatEnv,
    taskTemplates,
    type EditorTab,
    type EditorTask,
    type RunPreview,
    type TaskEditorForm,
    type TriggerType,
    type TypeLib,
    type WebhookDelivery
  } from "./task-editor-model";
  import { missingPackageImports } from "$lib/tasks/imports";
  import {
    validateCronExpression,
    validateEditorFiles,
    type EditorFile,
    type ValidationIssue
  } from "$lib/tasks/validation";

  type WebhookAction = "rotate" | "disable";

  let {
    task,
    mode,
    ai_providers,
    ai_settings,
    webhook_deliveries = [],
    form,
    save_action = "?/save"
  }: {
    task: EditorTask;
    mode: "create" | "edit";
    ai_providers: AiProviderOption[];
    ai_settings: AiProviderSettings[];
    webhook_deliveries?: WebhookDelivery[];
    form?: TaskEditorForm;
    save_action?: string;
  } = $props();

  const isCreate = $derived(mode === "create");
  let loadedTaskId = $state("");
  let name = $state("");
  let description = $state("");
  let prompt = $state("");
  let code = $state("");
  let env_text = $state("");
  let package_json_text = $state("");
  let activeTab = $state<EditorTab>("task");
  let fileRevision = $state(0);
  let selectedTemplate = $state<TriggerType | "">("");
  let trigger_value = $state("");
  let timezone = $state("UTC");
  let chatInput = $state("");
  let agentMessages = $state<AgentMessage[]>([]);
  let isAgentWorking = $state(false);
  let agentStatus = $state("");
  let typeLibs = $state<TypeLib[]>([]);
  let typeLibKey = $state("");
  let validationIssues = $state<ValidationIssue[]>([]);
  let isSaving = $state(false);
  let saveStatus = $state("");
  let savedName = $state("");
  let savedDescription = $state("");
  let savedPrompt = $state("");
  let savedSelectedTemplate = $state<TriggerType | "">("");
  let savedTriggerValue = $state("");
  let savedTimezone = $state("UTC");
  let savedCode = $state("");
  let saved_env_text = $state("");
  let saved_package_json_text = $state("");
  let runPreview = $state<RunPreview | undefined>();
  let runStatus = $state("");
  let bottomPanelOpen = $state(true);
  let bottomPanelTab = $state<"output" | "terminal">("output");
  let isRunStarting = $state(false);
  let runPollToken = $state(0);
  let webhook_path = $state("");
  let webhook_url = $state("");
  let webhookManageStatus = $state("");
  let webhookStatusToken = $state(0);
  let isWebhookManaging = $state(false);
  let selectedAiProvider = $state("openai");
  let selectedAiModel = $state("");
  let isSettingsOpen = $state(false);
  let settingsError = $state("");
  const hasTemplate = $derived(!isCreate || selectedTemplate !== "");
  const selectedAiSettings = $derived(ai_settings.find((item) => item.provider === selectedAiProvider));
  const selectedAiModels = $derived(selectedAiSettings?.models || []);
  const blockingValidationIssues = $derived(validationIssues.filter((issue) => issue.severity !== "warning"));
  const envDiagnostics = $derived(validationIssues.filter((issue) => issue.file === "env"));
  const packageDiagnostics = $derived(validationIssues.filter((issue) => issue.file === "package"));
  const missingPackages = $derived(missingPackageImports(code, package_json_text));
  const isDirty = $derived(
    hasTemplate &&
      (name !== savedName ||
        description !== savedDescription ||
        prompt !== savedPrompt ||
        selectedTemplate !== savedSelectedTemplate ||
        trigger_value !== savedTriggerValue ||
        timezone !== savedTimezone ||
        code !== savedCode ||
        env_text !== saved_env_text ||
        package_json_text !== saved_package_json_text)
  );
  const isRunActive = $derived(isRunStarting || runPreview?.status === "queued" || runPreview?.status === "running");
  const finishedRunStatuses = new Set(["success", "failed", "canceled"]);

  $effect(() => {
    const key = `${mode}:${task.id}:${task.version}`;
    if (loadedTaskId === key) return;
    loadedTaskId = key;
    name = task.name;
    description = task.description;
    prompt = task.prompt;
    code = task.code;
    env_text = formatEnv(task.env);
    package_json_text = task.package_json || defaultPackageJson(task.id || "task");
    fileRevision += 1;
    activeTab = "task";
    selectedTemplate = isCreate ? "" : task.trigger;
    trigger_value = task.trigger === "cron" ? task.schedule : task.trigger === "webhook" ? task.webhook_path : "";
    timezone = task.timezone || "UTC";
    chatInput = "";
    agentStatus = "";
    agentMessages = [
      { role: "user", text: task.prompt || "Describe what this task should do." },
      {
        role: "agent",
        text: "I can revise main.ts, .env, and package.json. Changes stay in the editor until you save."
      }
    ];
    selectedAiProvider = ai_settings.find((item) => item.has_api_key)?.provider || ai_providers[0]?.id || "openai";
    runPreview = undefined;
    runStatus = "";
    bottomPanelOpen = true;
    bottomPanelTab = "output";
    webhook_path = task.webhook_path || "";
    webhook_url = task.webhook_url || "";
    webhookManageStatus = "";
    isSettingsOpen = false;
    settingsError = "";
    markCurrentClean();
  });

  $effect(() => {
    const models = selectedAiModels;
    const fallback = selectedAiSettings?.default_model || models[0] || "";
    if (!selectedAiModel || (models.length > 0 && !models.includes(selectedAiModel))) {
      selectedAiModel = fallback;
    }
  });

  $effect(() => {
    const id = task.id;
    if (isCreate || !id || id === "new") {
      typeLibKey = "";
      typeLibs = [];
      return;
    }

    const key = `${id}:${task.version}:${package_json_text}`;
    if (typeLibKey === key) return;
    typeLibKey = key;
    typeLibs = [];
    void loadTypeLibs(id, key, task.version);
  });

  $effect(() => {
    env_text;
    package_json_text;
    hasTemplate;
    validationIssues = hasTemplate ? validateEditorFiles({ env_text, package_json_text }) : [];
  });

  $effect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  });

  function markCurrentClean() {
    savedName = name;
    savedDescription = description;
    savedPrompt = prompt;
    savedSelectedTemplate = selectedTemplate;
    savedTriggerValue = trigger_value;
    savedTimezone = timezone;
    savedCode = code;
    saved_env_text = env_text;
    saved_package_json_text = package_json_text;
  }

  async function loadTypeLibs(task_id: string, key: string, version: number) {
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task_id)}/types?v=${version}`);
      if (!response.ok) return;
      const data = (await response.json()) as { libs?: TypeLib[] };
      if (typeLibKey === key) typeLibs = data.libs || [];
    } catch {
      if (typeLibKey === key) typeLibs = [];
    }
  }

  function applyTemplate(trigger: TriggerType) {
    const template = taskTemplates.find((item) => item.trigger === trigger);
    if (!template) return;

    selectedTemplate = template.trigger;
    name = template.name;
    description = template.description;
    prompt = template.prompt;
    code = template.code;
    package_json_text = template.package_json;
    fileRevision += 1;
    trigger_value = template.trigger === "cron" ? template.schedule : "";
    timezone = template.trigger === "cron" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC";
    activeTab = "task";
    chatInput = "";
    prompt = template.prompt;
    agentStatus = "";
    settingsError = "";
    agentMessages = [
      { role: "user", text: template.prompt },
      { role: "agent", text: "Template files are ready. Ask for a change and I will update the open buffers." }
    ];
    runPreview = undefined;
    runStatus = "";
    bottomPanelOpen = true;
    bottomPanelTab = "output";
  }

  async function askAgent() {
    const message = chatInput.trim();
    if (!message || isAgentWorking) return;

    const previousMessages = agentMessages;
    const nextMessages: AgentMessage[] = [...previousMessages, { role: "user", text: message }];
    agentMessages = nextMessages;
    prompt = message;
    chatInput = "";

    const activeAiSettings = selectedAiSettings?.has_api_key
      ? selectedAiSettings
      : ai_settings.find((item) => item.has_api_key);
    if (!activeAiSettings) {
      agentMessages = [
        ...nextMessages,
        {
          role: "agent",
          text: "No AI provider is set up yet. Go to Settings, add an API key, then come back here to send agent prompts."
        }
      ];
      agentStatus = "";
      return;
    }

    selectedAiProvider = activeAiSettings.provider;
    isAgentWorking = true;
    agentStatus = "Preparing request...";

    try {
      const response = await fetch("/api/tasks/agent", {
        method: "POST",
        headers: { accept: "text/event-stream", "content-type": "application/json" },
        body: JSON.stringify({
          message,
          mode,
          messages: previousMessages,
          task: {
            id: task.id,
            name: name || task.name,
            description,
            trigger: selectedTemplate || task.trigger,
            timezone,
            webhook_path
          },
          files: {
            code,
            env_text,
            package_json_text
          },
          ai: {
            provider: activeAiSettings.provider,
            model: selectedAiModel || activeAiSettings.default_model
          }
        })
      });
      const data = await readAgentResponse(response, (message) => {
        agentStatus = message;
      });

      if (data.files?.code !== undefined) code = data.files.code;
      if (data.files?.env_text !== undefined) env_text = data.files.env_text;
      if (data.files?.package_json_text !== undefined) package_json_text = data.files.package_json_text;
      fileRevision += 1;
      activeTab = "task";
      agentMessages = [...agentMessages, { role: "agent", text: data.message || "Updated task files." }];
      agentStatus = "Agent changes applied. Save when ready.";
    } catch (error) {
      agentMessages = [
        ...agentMessages,
        { role: "agent", text: error instanceof Error ? error.message : "Agent failed to update task." }
      ];
      agentStatus = "";
    } finally {
      isAgentWorking = false;
    }
  }

  async function runTask() {
    if (isCreate || isRunActive || isDirty) return;

    isRunStarting = true;
    bottomPanelOpen = true;
    bottomPanelTab = "output";
    runStatus = "Queueing run...";
    runPreview = undefined;
    const token = runPollToken + 1;
    runPollToken = token;

    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "task-editor", at: new Date().toISOString() })
      });
      const data = (await response.json().catch(() => ({}))) as { run?: RunPreview; message?: string };
      if (!response.ok || !data.run) throw new Error(data.message || "Could not queue task run.");

      const run = data.run;
      runPreview = run;
      runStatus = "Run queued.";
      await pollRun(run.id, token);
    } catch (error) {
      runStatus = error instanceof Error ? error.message : "Could not run task.";
    } finally {
      isRunStarting = false;
    }
  }

  async function pollRun(runId: string, token: number) {
    while (runPollToken === token) {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
      const data = (await response.json().catch(() => ({}))) as { run?: RunPreview; message?: string };
      if (!response.ok || !data.run) throw new Error(data.message || "Could not load run output.");

      runPreview = data.run;
      runStatus =
        data.run.status === "queued"
          ? "Waiting for worker..."
          : data.run.status === "running"
            ? "Running task..."
            : `Run ${data.run.status}.`;

      if (finishedRunStatuses.has(data.run.status)) return;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }

  async function manageWebhook(action: WebhookAction) {
    if (isCreate || isDirty || isWebhookManaging) return;

    const statusToken = webhookStatusToken + 1;
    webhookStatusToken = statusToken;
    isWebhookManaging = true;
    webhookManageStatus = action === "rotate" ? "Rotating webhook URL..." : "Disabling webhook...";

    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = (await response.json().catch(() => ({}))) as {
        task?: {
          trigger: TriggerType;
          schedule: string;
          timezone: string;
          webhook_path: string;
          webhook_url: string;
        };
        message?: string;
      };
      if (!response.ok || !data.task) throw new Error(data.message || "Could not update webhook.");

      selectedTemplate = data.task.trigger;
      webhook_path = data.task.webhook_path;
      webhook_url = data.task.webhook_url;
      trigger_value = data.task.trigger === "cron" ? data.task.schedule : data.task.webhook_path;
      timezone = data.task.timezone || "UTC";
      markCurrentClean();
      webhookManageStatus = action === "rotate" ? "Webhook URL rotated." : "Webhook disabled.";
      setTimeout(() => {
        if (webhookStatusToken === statusToken) webhookManageStatus = "";
      }, 2400);
    } catch (error) {
      webhookManageStatus = error instanceof Error ? error.message : "Could not update webhook.";
    } finally {
      isWebhookManaging = false;
    }
  }

  function openSettings() {
    settingsError = "";
    isSettingsOpen = true;
  }

  function validateTaskSettings() {
    if (!name.trim()) throw new Error("Task name is required.");
    if (selectedTemplate === "cron") {
      validateCronExpression(trigger_value);
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone || "UTC" }).format(new Date());
      } catch {
        throw new Error(`Invalid timezone "${timezone}".`);
      }
    }
  }

  const enhanceSave: SubmitFunction = ({ cancel }) => {
    try {
      settingsError = "";
      validateTaskSettings();
    } catch (error) {
      settingsError = error instanceof Error ? error.message : "Task settings are invalid.";
      isSettingsOpen = true;
      cancel();
      return;
    }

    const issues = validateEditorFiles({ env_text, package_json_text });
    validationIssues = issues;
    const firstIssue = issues.find((issue) => issue.severity !== "warning");
    if (firstIssue) {
      cancel();
      activeTab = firstIssue.file;
      return;
    }

    isSaving = true;
    saveStatus = "Saving task...";

    return async ({ update }) => {
      isSaving = false;
      saveStatus = "";
      await update();
    };
  };
</script>

<div class="ide-page">
  <TaskEditorTitlebar
    {isCreate}
    title={name || task.name}
    status={task.status}
    {isSaving}
    {isDirty}
    {hasTemplate}
    isRunning={isRunActive}
    onSettings={openSettings}
    onRun={runTask}
  />

  <InstallStatus {form} {saveStatus} {missingPackages} />

  <ValidationBanner issues={blockingValidationIssues} openFile={(file: EditorFile) => (activeTab = file)} />

  {#if isCreate && !hasTemplate}
    <TemplatePicker templates={taskTemplates} {selectedTemplate} onSelect={applyTemplate} />
  {/if}

  {#if hasTemplate}
    <form id="task-editor-form" method="POST" action={save_action} class="ide-grid" use:enhance={enhanceSave}>
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="trigger" value={selectedTemplate || "manual"} />
      <input type="hidden" name="trigger_value" value={selectedTemplate === "manual" ? "" : trigger_value} />
      <input type="hidden" name="timezone" value={selectedTemplate === "cron" ? timezone || "UTC" : "UTC"} />

      <EditorWorkspace
        bind:activeTab
        bind:code
        bind:env_text
        bind:package_json_text
        {fileRevision}
        {typeLibs}
        {envDiagnostics}
        {packageDiagnostics}
        run={isCreate ? undefined : runPreview}
        runStatus={isCreate ? "" : runStatus}
        runIsRunning={!isCreate && isRunActive}
        task_id={task.id}
        terminalEnabled={!isCreate}
        bind:bottomPanelOpen
        bind:bottomPanelTab
        onCloseRun={() => (bottomPanelOpen = false)}
      />

      <AgentPanel
        {isCreate}
        scheduleInfo={{
          trigger: selectedTemplate || task.trigger,
          expression: selectedTemplate === "cron" ? trigger_value : "",
          timezone,
          next_run: task.next_run,
          last_scheduled: task.last_scheduled,
          error: task.schedule_error || "",
          dirty: isDirty
        }}
        {prompt}
        messages={agentMessages}
        isWorking={isAgentWorking}
        status={agentStatus}
        providers={ai_providers}
        settings={ai_settings}
        bind:selectedProvider={selectedAiProvider}
        bind:selectedModel={selectedAiModel}
        onSubmit={askAgent}
        bind:chatInput
      />

      {#if isSettingsOpen}
        <TaskSettingsPanel
          bind:name
          bind:description
          bind:trigger={selectedTemplate}
          bind:trigger_value
          bind:timezone
          {webhook_url}
          deliveries={webhook_deliveries}
          webhookStatus={webhookManageStatus}
          webhookBusy={isWebhookManaging}
          webhookManageDisabled={isDirty || isSaving}
          onRotateWebhook={() => manageWebhook("rotate")}
          onDisableWebhook={() => manageWebhook("disable")}
          error={settingsError}
          onClose={() => {
            settingsError = "";
            isSettingsOpen = false;
          }}
        />
      {/if}
    </form>
  {/if}
</div>

<style>
  .ide-page {
    height: 100vh;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #1f2329;
    color: #abb2bf;
  }

  :global(:root.light) .ide-page {
    background: #ffffff;
    color: #383a42;
  }

  .ide-grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(340px, 390px);
    gap: 0;
    align-items: stretch;
  }

  @media (max-width: 1080px) {
    .ide-grid {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(540px, 1fr) minmax(360px, 42vh);
      overflow: auto;
    }
  }

  @media (max-width: 720px) {
    .ide-page {
      overflow: auto;
    }

    .ide-grid {
      min-height: 980px;
      grid-template-rows: 620px 360px;
    }
  }
</style>
