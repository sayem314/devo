<script lang="ts">
  import type { TaskEditorForm } from "../task-editor-model";

  let {
    form,
    saveStatus,
    missingPackages
  }: {
    form?: TaskEditorForm;
    saveStatus: string;
    missingPackages: string[];
  } = $props();
</script>

{#if form?.message}
  <div class="error-message ide-error">{form.message}</div>
{/if}

{#if saveStatus}
  <div class="install-message ide-notice">
    <strong>{saveStatus}</strong>
    <span>Keep this tab open while Devo writes the task files.</span>
  </div>
{:else if missingPackages.length > 0}
  <div class="install-message ide-notice">
    <strong>Missing packages: {missingPackages.join(", ")}</strong>
    <span>Open Terminal and run bun add {missingPackages.join(" ")}.</span>
  </div>
{/if}

<style>
  .error-message {
    padding: 12px 14px;
    border: 1px solid color-mix(in srgb, var(--red) 35%, #343b46);
    background: color-mix(in srgb, var(--red) 11%, #1b1f24);
    color: var(--foreground);
  }

  .ide-error,
  .ide-notice {
    flex-shrink: 0;
    border-inline: 0;
    border-radius: 0;
  }

  .install-message {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border: 1px solid color-mix(in srgb, #61afef 32%, #343b46);
    background: color-mix(in srgb, #61afef 10%, #1b1f24);
    color: #abb2bf;
    font-size: 13px;
  }

  .install-message strong {
    color: #61afef;
    white-space: nowrap;
  }

  .install-message span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(:root.light) .install-message {
    border-color: color-mix(in srgb, #4078f2 28%, #d7dae0);
    background: color-mix(in srgb, #4078f2 8%, #ffffff);
    color: #383a42;
  }

  :global(:root.light) .install-message strong {
    color: #4078f2;
  }

  @media (max-width: 720px) {
    .install-message span {
      white-space: normal;
    }

    .install-message {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
