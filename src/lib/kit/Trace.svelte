<script lang="ts">
	/**
	 * The copper trace down the left rail. It is routed through a via at the top of every chapter
	 * ([data-chapter]), jogging 45° between two lanes, and is "etched" up to just below the middle
	 * of the viewport as you scroll. The unetched remainder shows as a faint ratsnest line.
	 *
	 * The etch is a CSS scroll-driven animation on its own layer, so it moves on the browser's scroll
	 * thread and can't lag behind the page. Browsers without scroll timelines get it fully etched.
	 */
	import { onMount } from 'svelte';
	import { chapters } from '../content';

	const LANES = [30, 58];
	const JOG = LANES[1] - LANES[0];

	let height = $state(0);
	let d = $state('');
	let vias = $state<{ x: number; y: number; ref: string }[]>([]);
	let etched = $state(0);
	/** How far the page can scroll; the etch animation spans exactly this. */
	let travel = $state(0);

	function route() {
		height = document.documentElement.scrollHeight;
		const start = { x: LANES[0], y: Math.round(innerHeight * 0.9) };
		const pts = [...document.querySelectorAll<HTMLElement>('[data-chapter]')].map((el, i) => ({
			x: LANES[(i + 1) % 2],
			y: Math.round(el.getBoundingClientRect().top + scrollY + 40),
			ref: chapters.find((c) => c.id === el.dataset.chapter)?.ref ?? ''
		}));
		let path = `M ${start.x} ${start.y}`;
		let x = start.x;
		for (const v of pts) {
			if (v.x !== x) path += ` L ${x} ${v.y - JOG - 30} L ${v.x} ${v.y - 30}`;
			path += ` L ${v.x} ${v.y}`;
			x = v.x;
		}
		path += ` L ${x} ${height - 40}`;
		d = path;
		vias = pts;
		travel = Math.max(0, height - innerHeight);
	}

	onMount(() => {
		// only decides which vias are lit; a frame of lag on a color change isn't visible
		const onScroll = () => (etched = scrollY + innerHeight * 0.58);
		route();
		onScroll();
		// pinned chapters change height with the viewport, and fonts/3D settle after load
		const ro = new ResizeObserver(() => route());
		ro.observe(document.body);
		addEventListener('scroll', onScroll, { passive: true });
		return () => {
			ro.disconnect();
			removeEventListener('scroll', onScroll);
		};
	});
</script>

<div class="trace" style:height="{height}px" style:--h="{height}px" style:--travel="{travel}px" aria-hidden="true">
	<svg viewBox="0 0 88 {height}"><path class="rat" {d} /></svg>
	<svg class="copper" viewBox="0 0 88 {height}"><path class="cu" {d} /></svg>
	<svg viewBox="0 0 88 {height}">
		{#each vias as v}
			<g class="via" class:on={etched >= v.y}>
				<circle cx={v.x} cy={v.y} r="7" />
				<text x={v.x + 13} y={v.y + 3.5}>{v.ref}</text>
			</g>
		{/each}
	</svg>
</div>

<style>
	.trace {
		position: absolute;
		top: 0;
		left: 0;
		width: 88px;
		pointer-events: none;
		z-index: 6;
	}
	.trace svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	/* etched copper: clipped to 58% down the viewport, driven by the page's own scroll */
	@supports (animation-timeline: scroll()) {
		.copper {
			animation: etch linear both;
			animation-timeline: scroll(root block);
		}
	}
	@keyframes etch {
		from {
			clip-path: inset(0 0 calc(var(--h) - 58vh) 0);
		}
		to {
			clip-path: inset(0 0 calc(var(--h) - 58vh - var(--travel)) 0);
		}
	}
	path {
		fill: none;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.rat {
		stroke: var(--ink);
		stroke-opacity: 0.18;
		stroke-width: 1;
		stroke-dasharray: 2 5;
	}
	.cu {
		stroke: var(--accent);
		stroke-width: 3.5;
	}
	.via circle {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-opacity: 0.35;
		stroke-width: 2;
		transition:
			stroke 0.3s,
			stroke-opacity 0.3s;
	}
	.via text {
		font-family: var(--mono);
		font-size: 9px;
		fill: var(--ink-2);
		letter-spacing: 0.06em;
	}
	.via.on circle {
		stroke: var(--accent);
		stroke-opacity: 1;
		stroke-width: 3.5;
	}
	.via.on text {
		fill: var(--accent);
	}
	@media (max-width: 820px) {
		.trace {
			display: none;
		}
	}
</style>
