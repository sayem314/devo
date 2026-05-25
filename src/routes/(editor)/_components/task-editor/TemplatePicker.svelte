<script lang="ts">
  import type { TaskTemplate, TriggerType } from "../task-editor-model";

  let {
    templates,
    selectedTemplate,
    onSelect
  }: {
    templates: TaskTemplate[];
    selectedTemplate: TriggerType | "";
    onSelect: (trigger: TriggerType) => void;
  } = $props();
</script>

<section class="template-picker" aria-label="Task templates">
  <div class="template-copy">
    <strong>Choose a trigger template</strong>
    <span>Pick one to create task files and settings.</span>
  </div>
  <div class="template-options">
    {#each templates as template}
      <button
        type="button"
        class:active={selectedTemplate === template.trigger}
        onclick={() => onSelect(template.trigger)}
      >
        <strong>{template.label}</strong>
        <span>{template.description}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .template-picker {
    flex: 1;
    min-height: 0;
    display: grid;
    place-content: center;
    gap: 18px;
    padding: 28px;
    background: #1f2329;
  }

  :global(:root.light) .template-picker {
    background: #ffffff;
  }

  .template-copy {
    display: grid;
    gap: 4px;
    align-content: center;
    max-width: 680px;
    padding: 0;
    text-align: center;
  }

  .template-copy strong {
    color: #d7dae0;
    font-size: 18px;
  }

  :global(:root.light) .template-copy strong {
    color: #383a42;
  }

  .template-copy span {
    color: #7f8794;
    font-size: 12px;
  }

  :global(:root.light) .template-copy span {
    color: #696c77;
  }

  .template-options {
    min-width: 0;
    display: grid;
    width: min(760px, calc(100vw - 56px));
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .template-options button {
    min-width: 0;
    min-height: 116px;
    display: grid;
    gap: 3px;
    align-content: center;
    border: 1px solid #343b46;
    border-radius: 8px;
    background: #1b1f24;
    color: #7f8794;
    padding: 16px;
    text-align: left;
  }

  :global(:root.light) .template-options button {
    border-color: #d7dae0;
    background: #fbfbfb;
    color: #696c77;
  }

  .template-options button:hover,
  .template-options button.active {
    background: #252a32;
  }

  :global(:root.light) .template-options button:hover,
  :global(:root.light) .template-options button.active {
    background: #edf1f7;
  }

  .template-options strong {
    color: #d7dae0;
    font-size: 13px;
  }

  :global(:root.light) .template-options strong {
    color: #383a42;
  }

  .template-options span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  @media (max-width: 720px) {
    .template-options {
      grid-template-columns: 1fr;
    }
  }
</style>
