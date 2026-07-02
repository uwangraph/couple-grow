<script lang="ts">
  import { ICONS } from './icons';
  let { name, size = 24, color, style = '', strokeWidth, class: className = '' }: {
    name: string;
    size?: number;
    color?: string;
    style?: string;
    strokeWidth?: number;
    class?: string;
  } = $props();

  let IconComponent = $derived(ICONS[name]);
  let iconClass = $derived(className || style);
</script>

{#if IconComponent}
  <IconComponent {size} {color} {strokeWidth} class={iconClass} />
{/if}
