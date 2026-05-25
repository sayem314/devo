<script lang="ts">
  import type { AgentMessage, AiProviderOption, AiProviderSettings } from "../task-editor-model";

  type ScheduleInfo = {
    trigger: string;
    expression: string;
    timezone: string;
    next_run: string;
    last_scheduled: string;
    error: string;
    dirty: boolean;
  };

  let {
    isCreate,
    scheduleInfo,
    prompt,
    messages,
    isWorking,
    status,
    providers,
    settings,
    selectedProvider = $bindable("openai"),
    selectedModel = $bindable(""),
    onSubmit,
    chatInput = $bindable("")
  }: {
    isCreate: boolean;
    scheduleInfo?: ScheduleInfo;
    prompt: string;
    messages: AgentMessage[];
    isWorking: boolean;
    status: string;
    providers: AiProviderOption[];
    settings: AiProviderSettings[];
    selectedProvider?: string;
    selectedModel?: string;
    onSubmit: () => void;
    chatInput?: string;
  } = $props();

  const configuredProviders = $derived(
    providers.filter((provider) => settings.some((item) => item.provider === provider.id && item.has_api_key))
  );
  const selectedProviderConfig = $derived(providers.find((item) => item.id === selectedProvider) || providers[0]);
  const selectedSettings = $derived(settings.find((item) => item.provider === selectedProvider));
  const modelOptions = $derived(selectedSettings?.models || []);
</script>

<aside class="panel assistant-panel">
  {#if !isCreate && scheduleInfo?.trigger === "cron"}
    <section class="schedule-panel">
      <div class="schedule-title">
        <span>Schedule</span>
        <em>{scheduleInfo.timezone}</em>
      </div>
      <div class="schedule-grid">
        <span>Expression</span>
        <code>{scheduleInfo.expression}</code>
        <span>Next run</span>
        <strong class:error-value={Boolean(scheduleInfo.error)}>{scheduleInfo.error || scheduleInfo.next_run}</strong>
        <span>Last scheduled</span>
        <strong>{scheduleInfo.last_scheduled}</strong>
      </div>
      {#if scheduleInfo.dirty}
        <p class="schedule-note">Save current edits to recalculate the next run.</p>
      {:else if scheduleInfo.error}
        <p class="schedule-note error-text">{scheduleInfo.error}</p>
      {/if}
    </section>
  {/if}

  <div class="assistant-header">
    <div>
      <h2>Agent</h2>
      <p>Code changes, payloads, behavior</p>
    </div>
    {#if configuredProviders.length > 0}
      <div class="agent-selectors" aria-label="AI provider and model">
        <select bind:value={selectedProvider}>
          {#each configuredProviders as provider}
            <option value={provider.id}>{provider.label}</option>
          {/each}
        </select>
        <select bind:value={selectedModel} disabled={modelOptions.length === 0}>
          {#if modelOptions.length === 0}
            <option value="">{selectedProviderConfig?.default_model || "No models"}</option>
          {:else}
            {#each modelOptions as model}
              <option value={model}>{model}</option>
            {/each}
          {/if}
        </select>
      </div>
    {:else}
      <a class="settings-link" href="/settings">Set up AI</a>
    {/if}
  </div>

  <div class="assistant-body">
    <section class="chat-block" aria-label="Agent chat">
      <div class="messages">
        {#each messages as message}
          <div class="message {message.role}">
            <span>{message.role === "user" ? "User" : "Agent"}</span>
            <p>{message.text}</p>
          </div>
        {/each}
        {#if status}
          <div class="message agent">
            <span>Agent</span>
            <p>{status}</p>
          </div>
        {/if}
      </div>

      <div class="composer">
        <input type="hidden" name="prompt" value={chatInput.trim() || prompt} />
        <label class="sr-only" for="agent-prompt">Agent prompt</label>
        <textarea
          id="agent-prompt"
          rows="7"
          bind:value={chatInput}
          placeholder="Ask for a code change, test payload, or behavior update..."
        ></textarea>
        <button class="primary-button" type="button" disabled={isWorking || !chatInput.trim()} onclick={onSubmit}>
          {isWorking ? "Working..." : "Send"}
        </button>
      </div>
    </section>
  </div>
</aside>

<style>
  h2,
  p {
    margin: 0;
  }

  .panel {
    min-width: 0;
    min-height: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    overflow: hidden;
  }

  .assistant-panel {
    display: flex;
    flex-direction: column;
    background: #1f2329;
  }

  :global(:root.light) .assistant-panel {
    background: #ffffff;
  }

  .assistant-header {
    min-height: 46px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-bottom: 1px solid #343b46;
    background: #1b1f24;
    padding: 6px 12px;
  }

  :global(:root.light) .assistant-header {
    border-bottom-color: #d7dae0;
    background: #fbfbfb;
  }

  .assistant-header h2 {
    color: #d7dae0;
    font-size: 13px;
    line-height: 1.2;
  }

  :global(:root.light) .assistant-header h2 {
    color: #383a42;
  }

  .assistant-header p,
  .message span {
    color: #7f8794;
  }

  :global(:root.light) .assistant-header p,
  :global(:root.light) .message span {
    color: #696c77;
  }

  .assistant-header p {
    margin-top: 2px;
    font-size: 12px;
  }

  .agent-selectors {
    display: grid;
    grid-template-columns: minmax(92px, 0.8fr) minmax(120px, 1fr);
    gap: 6px;
    min-width: 0;
    width: 210px;
  }

  .agent-selectors select {
    min-width: 0;
    min-height: 28px;
    border: 1px solid #343b46;
    border-radius: 5px;
    background: #252a32;
    color: #abb2bf;
    font: inherit;
    font-size: 11px;
    outline: none;
    padding: 0 6px;
  }

  :global(:root.light) .agent-selectors select {
    border-color: #d7dae0;
    background: #ffffff;
    color: #383a42;
  }

  .agent-selectors select:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .settings-link {
    color: #7f8794;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }

  .settings-link:hover {
    color: #d7dae0;
    text-decoration: underline;
  }

  :global(:root.light) .settings-link {
    color: #696c77;
  }

  :global(:root.light) .settings-link:hover {
    color: #1f2329;
  }

  .schedule-panel {
    display: grid;
    gap: 10px;
    border-bottom: 1px solid #343b46;
    background: #1b1f24;
    padding: 10px 12px;
  }

  :global(:root.light) .schedule-panel {
    border-bottom-color: #d7dae0;
    background: #fbfbfb;
  }

  .schedule-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .schedule-title {
    justify-content: space-between;
  }

  .schedule-title > span {
    color: #7f8794;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .schedule-title em,
  .schedule-note {
    margin: 0;
    color: #7f8794;
    font-size: 12px;
    font-style: normal;
  }

  :global(:root.light) .schedule-title > span,
  :global(:root.light) .schedule-title em,
  :global(:root.light) .schedule-note {
    color: #696c77;
  }

  .schedule-grid {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr);
    gap: 6px 10px;
    align-items: center;
    font-size: 12px;
  }

  .schedule-grid > span {
    color: #7f8794;
    font-weight: 750;
  }

  .schedule-grid code,
  .schedule-grid strong {
    min-width: 0;
    overflow: hidden;
    color: #abb2bf;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 12px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(:root.light) .schedule-grid > span {
    color: #696c77;
  }

  :global(:root.light) .schedule-grid code,
  :global(:root.light) .schedule-grid strong {
    color: #383a42;
  }

  .schedule-grid .error-value,
  .error-text {
    color: #fb7a7a;
  }

  .assistant-body {
    min-height: 0;
    flex: 1;
    overflow: auto;
  }

  .chat-block,
  .composer {
    display: flex;
    flex-direction: column;
  }

  .chat-block {
    min-height: 100%;
    justify-content: space-between;
  }

  .messages {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
  }

  .message {
    max-width: 94%;
    border: 1px solid #343b46;
    border-radius: 8px;
    padding: 10px 12px;
    background: #252a32;
  }

  :global(:root.light) .message {
    border-color: #d7dae0;
    background: #f8f9fb;
  }

  .message.user {
    align-self: flex-end;
    background: color-mix(in srgb, #61afef 13%, #252a32);
  }

  :global(:root.light) .message.user {
    background: color-mix(in srgb, #4078f2 10%, #ffffff);
  }

  .message.agent {
    align-self: flex-start;
  }

  .message span {
    display: block;
    margin-bottom: 5px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .message p {
    color: #d7dae0;
  }

  :global(:root.light) .message p {
    color: #383a42;
  }

  .composer {
    gap: 0;
    padding: 0;
    border-top: 1px solid #343b46;
    background: #1b1f24;
  }

  :global(:root.light) .composer {
    border-top-color: #d7dae0;
    background: #fbfbfb;
  }

  .composer textarea {
    width: 100%;
    min-height: 152px;
    border: 0;
    border-radius: 0;
    background: #1f2329;
    color: #abb2bf;
    padding: 12px;
    outline: none;
    resize: vertical;
  }

  .composer .primary-button {
    min-height: 36px;
    margin: 10px;
    border-radius: 5px;
  }

  .composer .primary-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  :global(:root.light) .composer textarea {
    background: #ffffff;
    color: #383a42;
  }

  .composer textarea:focus {
    border-color: #61afef;
  }

  :global(:root.light) .composer textarea:focus {
    border-color: #4078f2;
  }
</style>
