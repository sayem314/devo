<script lang="ts">
  interface Props {
    class?: string;
    size?: number;
    strokeWidth?: number;
    ariaHidden?: boolean;
  }
  let { class: className = "", size = 16, strokeWidth = 2, ariaHidden = true }: Props = $props();
</script>

<svg
  class={className}
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden={ariaHidden}
>
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
</svg>
