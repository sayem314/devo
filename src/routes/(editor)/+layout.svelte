<script lang="ts">
  let { children } = $props();
</script>

<div class="editor-shell">
  {@render children()}
</div>

<style>
  .editor-shell {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--background);
    color: var(--foreground);
  }
</style>
