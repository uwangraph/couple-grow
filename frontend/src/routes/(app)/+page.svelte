<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.svelte';

  onMount(() => {
    if (auth.token) goto('/home');
    else goto('/login');
  });
</script>
