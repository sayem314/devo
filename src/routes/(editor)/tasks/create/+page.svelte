<script lang="ts">
  import TaskEditor from "../../_components/TaskEditor.svelte";

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Create task | Devo</title>
</svelte:head>

<TaskEditor
  mode="create"
  task={data.task}
  ai_providers={data.ai_providers}
  ai_settings={data.ai_settings}
  {form}
  save_action="?/save"
/>
