<script lang="ts">
  import TaskEditor from "../../_components/TaskEditor.svelte";

  let { data, form } = $props();
</script>

<svelte:head>
  <title>{data.task.name} | Devo</title>
</svelte:head>

<TaskEditor
  mode="edit"
  task={data.task}
  ai_providers={data.ai_providers}
  ai_settings={data.ai_settings}
  webhook_deliveries={data.webhook_deliveries}
  {form}
/>
