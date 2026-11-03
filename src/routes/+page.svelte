<script lang="ts">
	import { onMount } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import Hero from '../lib/kit/Hero.svelte';
	import Trace from '../lib/kit/Trace.svelte';
	import { registry } from '../lib/chapters/registry';
	import { chapters, person, resumePdf } from '../lib/content';

	let progress = $state(0);

	let current = $state<(typeof chapters)[number] | null>(null);

	const onScroll = () => {
		const max = document.documentElement.scrollHeight - innerHeight;
		progress = max > 0 ? scrollY / max : 0;
	};

	onMount(() => {
		// the 3D scene and canvases read theme colors at startup, so redraw when the OS flips light/dark
		const scheme = matchMedia('(prefers-color-scheme: dark)');
		const onScheme = () => location.reload();
		scheme.addEventListener('change', onScheme);
		// the chapter whose top most recently crossed the upper third of the screen
		const els = [...document.querySelectorAll<HTMLElement>('[data-chapter]')];
		const pick = () => {
			let hit: HTMLElement | null = null;
			for (const el of els) if (el.getBoundingClientRect().top < innerHeight * 0.35) hit = el;
			current = chapters.find((c) => c.id === hit?.dataset.chapter) ?? null;
		};
		pick();
		addEventListener('scroll', pick, { passive: true });
		return () => {
			removeEventListener('scroll', pick);
			scheme.removeEventListener('change', onScheme);
		};
	});
</script>

<svelte:head>
	<title>{person.name}</title>
	<meta
		name="description"
		content="Sean Ernstes: computer engineering at Georgia Tech, software engineer at Speechify, lead maintainer of QuestNav."
	/>
</svelte:head>

<svelte:window onscroll={onScroll} onresize={onScroll} />

<header class="chrome mono">
	<a href="#top" class="mark">S.Ernstes</a>
	<span class="now">
		{#if current}<b>{current.ref}</b> {current.label}{:else}Signal path · Rev 0.2{/if}
	</span>
	<span class="tools">
		<a href={resolve('/simple')}>Simple view</a>
		<a href={asset(resumePdf)} download>PDF</a>
	</span>
	<span class="pct" aria-hidden="true">
		<span class="bar"><span style:transform="scaleX({progress})"></span></span>
		{String(Math.round(progress * 100)).padStart(3, '0')}
	</span>
</header>
<div class="crop" aria-hidden="true"><i></i><i></i><i></i><i></i></div>

<main id="top">
	<Trace />
	<Hero />
	{#each chapters as c (c.id)}
		{@const Chapter = registry[c.id]}
		<Chapter />
	{/each}
</main>

<style>
	main {
		position: relative;
	}
	.chrome {
		position: fixed;
		z-index: 20;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		padding: 14px var(--gutter);
		font-size: 11px;
		mix-blend-mode: var(--chrome-blend);
		pointer-events: none;
	}
	.chrome a {
		pointer-events: auto;
	}
	.tools {
		display: inline-flex;
		align-items: center;
		gap: 18px;
		margin-left: auto;
	}
	.tools a {
		text-decoration: none;
		border-bottom: 1px solid var(--rule);
	}
	.tools a:hover {
		color: var(--accent);
		border-color: var(--accent);
	}
	@media (max-width: 820px) {
		.now,
		.pct {
			display: none;
		}
		.tools {
			gap: 14px;
		}
	}
	.mark {
		text-decoration: none;
		font-weight: 500;
	}
	.now {
		color: var(--ink-2);
	}
	.now b {
		color: var(--accent);
		font-weight: 500;
		margin-right: 6px;
	}
	.pct {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-variant-numeric: tabular-nums;
	}
	.bar {
		width: 72px;
		height: 1px;
		background: var(--rule);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--ink);
		transform-origin: left;
	}
	.crop i {
		position: fixed;
		z-index: 20;
		width: 14px;
		height: 14px;
		pointer-events: none;
		border: 0 solid var(--ink);
	}
	.crop i:nth-child(1) {
		top: 8px;
		left: 8px;
		border-width: 1px 0 0 1px;
	}
	.crop i:nth-child(2) {
		top: 8px;
		right: 8px;
		border-width: 1px 1px 0 0;
	}
	.crop i:nth-child(3) {
		bottom: 8px;
		left: 8px;
		border-width: 0 0 1px 1px;
	}
	.crop i:nth-child(4) {
		bottom: 8px;
		right: 8px;
		border-width: 0 1px 1px 0;
	}
</style>
