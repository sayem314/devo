<script lang="ts">
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";

  let {
    isCreate,
    title,
    status,
    isDirty,
    isSaving,
    hasTemplate,
    isRunning,
    onSettings,
    onRun
  }: {
    isCreate: boolean;
    title: string;
    status: string;
    isDirty: boolean;
    isSaving: boolean;
    hasTemplate: boolean;
    isRunning: boolean;
    onSettings: () => void;
    onRun: () => void;
  } = $props();
</script>

<header class="ide-titlebar">
  <div class="title-left">
    <a class="brand-link" href="/tasks">devo<span>.</span></a>
    <span class="crumb">tasks</span>
    <span class="slash">/</span>
    <strong>{isCreate ? "new task" : title}</strong>
    <span class="status-chip">{isCreate ? "draft" : status}</span>
    {#if isDirty}
      <span class="dirty-chip">unsaved</span>
    {/if}
  </div>
  <div class="title-actions">
    <ThemeToggle />
    <button class="secondary-button" type="button" disabled={!hasTemplate} onclick={onSettings}>Settings</button>
    <a class="secondary-button" href="/tasks">Back</a>
    <button
      class="secondary-button"
      type="submit"
      form="task-editor-form"
      disabled={isSaving || (isCreate && !hasTemplate) || (!isCreate && !isDirty)}
    >
      {isSaving ? "Saving..." : isCreate ? "Save draft" : "Save changes"}
    </button>
    {#if !isCreate}
      <button class="primary-button" type="button" disabled={isSaving || isRunning || isDirty} onclick={onRun}>
        {isRunning ? "Running..." : isDirty ? "Save to run" : "Run task"}
      </button>
    {/if}
  </div>
</header>

<style>
  .ide-titlebar {
    height: 46px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    border-bottom: 1px solid #343b46;
    background: #1b1f24;
    padding: 0 12px;
  }

  :global(:root.light) .ide-titlebar {
    border-bottom-color: #d7dae0;
    background: #fbfbfb;
  }

  .title-left,
  .title-actions {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .title-left {
    overflow: hidden;
    color: #7f8794;
    font-size: 13px;
  }

  :global(:root.light) .title-left {
    color: #696c77;
  }

  .brand-link {
    flex-shrink: 0;
    color: #abb2bf;
    font-size: 14px;
    font-weight: 850;
  }

  .brand-link span {
    color: #98c379;
  }

  :global(:root.light) .brand-link {
    color: #1f2329;
  }

  .slash {
    color: #5c6370;
  }

  .title-left strong {
    min-width: 0;
    color: #d7dae0;
    font-weight: 750;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(:root.light) .title-left strong {
    color: #383a42;
  }

  .status-chip,
  .dirty-chip {
    min-height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #343b46;
    border-radius: 999px;
    background: #252a32;
    color: #e5c07b;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .dirty-chip {
    border-color: color-mix(in srgb, #61afef 35%, #343b46);
    background: color-mix(in srgb, #61afef 10%, #252a32);
    color: #61afef;
  }

  :global(:root.light) .status-chip {
    border-color: #d7dae0;
    background: #f8f9fb;
    color: #986801;
  }

  :global(:root.light) .dirty-chip {
    border-color: color-mix(in srgb, #4078f2 28%, #d7dae0);
    background: color-mix(in srgb, #4078f2 8%, #ffffff);
    color: #4078f2;
  }

  .title-actions {
    flex-shrink: 0;
  }

  .title-actions :global(.theme-toggle) {
    width: 58px;
    height: 30px;
    flex-shrink: 0;
  }

  .title-actions :global(.primary-button),
  .title-actions :global(.secondary-button),
  .title-actions .primary-button,
  .title-actions .secondary-button {
    min-height: 30px;
    border-radius: 5px;
    padding: 5px 10px;
    font-size: 13px;
  }

  .title-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  @media (max-width: 720px) {
    .ide-titlebar {
      height: auto;
      min-height: 46px;
      align-items: stretch;
      flex-direction: column;
      padding: 8px 10px;
    }

    .title-actions {
      width: 100%;
    }

    .title-actions .primary-button,
    .title-actions .secondary-button {
      flex: 1;
    }

    .crumb,
    .slash,
    .status-chip,
    .dirty-chip {
      display: none;
    }
  }
</style>
