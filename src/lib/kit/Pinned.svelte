<script lang="ts">
	/**
	 * Scroll-pinned scene. The section is `length` viewport-heights of scrolling; while it passes,
	 * a 100svh stage sticks to the viewport and `children` gets progress p = 0..1.
	 *
	 *   <Pinned length={250}>{#snippet children(p)} …uses p… {/snippet}</Pinned>
	 *
	 * Under the /lab route the progress is forced (context FORCED_PROGRESS) and the section collapses to
	 * one screen, so a chapter can be screenshotted at any point of its animation.
	 */
	import { getContext, onMount, type Snippet } from 'svelte';
	import { FORCED_PROGRESS, clamp } from './motion';

	let {
		length = 250,
		children,
		class: klass = ''
	}: { length?: number; children: Snippet<[number]>; class?: string } = $props();

	const forced = getContext<number | undefined>(FORCED_PROGRESS);
	let el: HTMLElement;
	let p = $state(forced ?? 0);

	onMount(() => {
		if (forced !== undefined) return;
		const update = () => {
			const r = el.getBoundingClientRect();
			const travel = r.height - innerHeight;
			p = travel > 0 ? clamp(-r.top / travel) : 0;
		};
		update();
		addEventListener('scroll', update, { passive: true });
		addEventListener('resize', update);
		return () => {
			removeEventListener('scroll', update);
			removeEventListener('resize', update);
		};
	});
</script>

<section
	bind:this={el}
	class="pinned {klass}"
	style:height={forced !== undefined ? '100svh' : `calc(${length}vh + 100svh)`}
>
	<div class="stage">{@render children(p)}</div>
</section>

<style>
	.pinned {
		position: relative;
	}
	.stage {
		position: sticky;
		top: 0;
		height: 100vh;
		height: 100svh;
		overflow: hidden;
	}
</style>
