<script lang="ts">
	/**
	 * Debug view: one chapter, frozen at one point of its scroll animation.
	 *   /lab?c=speechify&p=0.4
	 * (QuestNav uses its own ?s= parameter on the main page instead.)
	 */
	import { setContext } from 'svelte';
	import { page } from '$app/state';
	import { FORCED_PROGRESS } from '../../lib/kit/motion';
	import { registry } from '../../lib/chapters/registry';

	const id = page.url.searchParams.get('c') ?? 'speechify';
	setContext(FORCED_PROGRESS, Number(page.url.searchParams.get('p') ?? 0.5));
	const Chapter = registry[id as keyof typeof registry];
</script>

{#if Chapter}
	<Chapter />
{:else}
	<p class="mono">Unknown chapter “{id}”. Try one of: {Object.keys(registry).join(', ')}</p>
{/if}
