<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { themeManager } from "$lib/theme.svelte";

  let { children } = $props();

  onMount(() => {
    themeManager.apply();
  });
</script>

{@render children()}
