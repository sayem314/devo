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
  <path d="M4 6h16" />
  <path d="M4 12h16" />
  <path d="M4 18h16" />
</svg>
