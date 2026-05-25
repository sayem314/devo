<script lang="ts">
  import { fileLabel, type EditorFile, type ValidationIssue } from "$lib/tasks/validation";

  let {
    issues,
    openFile
  }: {
    issues: ValidationIssue[];
    openFile: (file: EditorFile) => void;
  } = $props();
</script>

{#if issues.length > 0}
  <div class="error-message ide-error validation-message">
    <strong>{issues.length} editor {issues.length === 1 ? "error" : "errors"}</strong>
    <button type="button" onclick={() => openFile(issues[0].file)}>
      Open {fileLabel(issues[0].file)}
    </button>
    <span>{fileLabel(issues[0].file)}: {issues[0].message}</span>
  </div>
{/if}

<style>
  .error-message {
    padding: 12px 14px;
    border: 1px solid color-mix(in srgb, var(--red) 35%, #343b46);
    background: color-mix(in srgb, var(--red) 11%, #1b1f24);
    color: var(--foreground);
  }

  .ide-error {
    flex-shrink: 0;
    border-inline: 0;
    border-radius: 0;
  }

  .validation-message {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  .validation-message strong {
    color: #fb7a7a;
    white-space: nowrap;
  }

  .validation-message span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .validation-message button {
    min-height: 28px;
    border: 1px solid color-mix(in srgb, var(--red) 45%, #343b46);
    border-radius: 5px;
    background: color-mix(in srgb, var(--red) 14%, #252a32);
    color: #fb7a7a;
    padding: 4px 9px;
    font-weight: 750;
  }

  @media (max-width: 720px) {
    .validation-message {
      align-items: flex-start;
      flex-direction: column;
    }

    .validation-message span {
      white-space: normal;
    }
  }
</style>
