<script lang="ts">
	/**
	 * J8 — where the trace terminates. The bottom of the page is the board's edge, with an edge
	 * connector; the copper lead runs down the rail and lands on finger 1, the email net.
	 * The lead is drawn complete, never stretched with scroll (scroll-linked drawing lags and jitters in
	 * Firefox); scroll only decides when the email net lights up. Under /lab the forced progress is used.
	 */
	import { getContext, onMount } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import { FORCED_PROGRESS, clamp } from '../kit/motion';
	import { person, resumePdf } from '../content';

	const forced = getContext<number | undefined>(FORCED_PROGRESS);
	let p = $state(forced ?? 0);
	let root: HTMLElement;
	let edgeEl: HTMLElement;
	let w = $state(1440);

	// edge-connector geometry (px, in the edge strip's own coordinates)
	const EH = 132; // strip height
	const EDGE = 78; // board edge line
	const FT = EDGE - 26; // finger top
	const FB = EH - 6; // finger bottom (card edge)
	const PITCH = 22;
	const FW = 13;

	const wide = $derived(w > 820);
	const x0 = $derived(wide ? 58 : 23); // finger 1 centre; 58 = the trace's lane on desktop
	const n = $derived(Math.max(8, Math.min(20, Math.floor((w * (wide ? 0.42 : 0.86)) / PITCH))));
	const tabL = $derived(x0 - 24);
	const tabR = $derived(x0 + (n - 1) * PITCH + 24);
	const nets = ['Mail', 'GitHub', 'LinkedIn', 'Résumé', 'Simple'];

	const landed = $derived(p >= 0.985);

	onMount(() => {
		if (forced !== undefined) return;
		const update = () => {
			const ih = innerHeight;
			const remaining = document.documentElement.scrollHeight - scrollY - ih;
			// etch point: just below mid-screen (like the main trace), sliding to the bottom on the last screen
			const tip = ih * (0.58 + 0.42 * (1 - clamp(remaining / (ih * 0.42))));
			const r = root.getBoundingClientRect();
			const e = edgeEl.getBoundingClientRect();
			const start = wide ? r.top + 40 : e.top;
			const end = e.top + FT;
			p = clamp((tip - start) / Math.max(1, end - start));
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

<div class="chapter" id="contact" data-chapter="contact" bind:this={root} class:landed>
	{#if wide}
		<i class="lead" aria-hidden="true" style:left="{x0 - 1.75}px" style:bottom="{EH - FT}px"></i>
	{/if}

	<div class="body">
		<p class="mono ref"><i class="via" aria-hidden="true"></i>J8 · Signal out</p>

		<p class="seeking">
			<span class="mono k">Seeking</span>
			{person.seeking.replace('co-ops', 'co\u2011ops')}.
		</p>

		<a class="email" href="mailto:{person.email}">
			<span class="mono net">J8-1 · {nets[0]}</span>
			<span class="addr">{person.email}</span>
		</a>

		<ul class="links">
			<li>
				<a href={person.github} rel="me noopener" target="_blank">
					<span class="mono net">J8-2</span>GitHub<span class="mono path">{person.github.replace('https://', '')}</span>
				</a>
			</li>
			<li>
				<a href={person.linkedin} rel="me noopener" target="_blank">
					<span class="mono net">J8-3</span>LinkedIn<span class="mono path">{person.linkedin.replace('https://www.', '')}</span>
				</a>
			</li>
			<li>
				<a href={asset(resumePdf)} download>
					<span class="mono net">J8-4</span>Résumé<span class="mono path">PDF download</span>
				</a>
			</li>
			<li>
				<a href={resolve('/simple')}>
					<span class="mono net">J8-5</span>Simple view<span class="mono path">same content, no animation</span>
				</a>
			</li>
		</ul>

		<p class="mono note">Built with SvelteKit and three.js.</p>
	</div>

	<div class="edge" bind:this={edgeEl} bind:clientWidth={w} style:height="{EH}px" aria-hidden="true">
		<svg width={w} height={EH} viewBox="0 0 {w} {EH}">
			<!-- board outline with the connector tab protruding to the card edge -->
			<path
				class="cut"
				d="M0 {EDGE} H{tabL} V{FB - 8} L{tabL + 8} {FB} H{tabR - 8} L{tabR} {FB - 8} V{EDGE} H{w}"
			/>
			<!-- lead into finger 1 (phones: the rail trace is hidden, so it starts here) -->
			{#if !wide}
				<line class="cu" x1={x0} y1="0" x2={x0} y2={FT} />
			{/if}
			{#each Array(n) as _, i}
				{@const x = x0 + i * PITCH}
				<rect class="finger" class:sig={i === 0 && landed} class:net={i < nets.length} x={x - FW / 2} y={FT} width={FW} height={FB - FT - 4} />
				<text class="num" x={i === 0 ? x - 6 : x} y={FT - 8} text-anchor={i === 0 ? 'end' : 'middle'}>{i + 1}</text>
			{/each}
			<text class="silk" x={tabR + 14} y={EDGE - 12}>J8 · Edge conn · 1×{n}</text>
			{#if wide}
				<text class="silk dim" x={tabR + 14} y={EDGE + 22}>{nets.map((name, i) => `${i + 1} ${name}`).join(' · ')} · {nets.length + 1}–{n} GND</text>
			{/if}
		</svg>
	</div>
</div>

<style>
	.chapter {
		position: relative;
		min-height: 100vh;
		min-height: 100svh;
		display: flex;
		flex-direction: column;
		padding: 120px var(--gutter) 0 var(--rail);
	}
	.lead {
		position: absolute;
		top: 40px;
		width: 3.5px;
		background: var(--accent);
		z-index: 7;
	}
	.body {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding-bottom: 56px;
	}
	.ref {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--accent);
		margin-bottom: 28px;
	}
	.via {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 3px solid var(--accent);
		background: var(--paper);
	}
	.seeking {
		max-width: 26ch;
		font-size: clamp(1.5rem, 2.8vw, 2.4rem);
		font-stretch: 80%;
		font-weight: 600;
		line-height: 1.08;
	}
	.k {
		display: block;
		color: var(--ink-2);
		font-size: 11px;
		margin-bottom: 8px;
		font-stretch: 100%;
	}
	.net {
		display: block;
		color: var(--ink-2);
		font-size: 10.5px;
	}

	.email {
		display: block;
		width: fit-content;
		max-width: 100%;
		margin-top: clamp(36px, 7vh, 72px);
		text-decoration: none;
	}
	.addr {
		display: block;
		font-size: clamp(2.5rem, 10.6vw, 11.5rem);
		font-stretch: 62%;
		font-weight: 820;
		line-height: 0.9;
		letter-spacing: -0.015em;
		padding-bottom: 0.08em;
		border-bottom: 4px solid var(--ink);
		overflow-wrap: anywhere;
		transition: border-color 0.3s;
	}
	.landed .addr,
	.email:hover .addr,
	.email:focus-visible .addr {
		border-bottom-color: var(--accent);
	}
	.email:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 6px;
	}

	.links {
		list-style: none;
		margin: 28px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0;
		border-top: 1px solid var(--rule);
		max-width: 1100px;
	}
	.links li {
		flex: 1 1 200px;
	}
	.links a {
		display: block;
		padding: 12px 24px 12px 0;
		text-decoration: none;
		font-size: clamp(1.4rem, 2.4vw, 2rem);
		font-stretch: 70%;
		font-weight: 700;
		line-height: 1.1;
	}
	.links a:hover,
	.links a:focus-visible {
		color: var(--accent);
		outline: none;
	}
	.path {
		display: block;
		margin-top: 4px;
		font-size: 10.5px;
		color: var(--ink-2);
		text-transform: none;
		font-weight: 400;
	}
	.note {
		margin-top: 40px;
		color: var(--ink-2);
		font-size: 10.5px;
		text-transform: none;
		letter-spacing: 0.02em;
	}

	.edge {
		position: relative;
		z-index: 7;
		margin: 0 calc(-1 * var(--gutter)) 0 calc(-1 * var(--rail));
	}
	.edge svg {
		display: block;
		overflow: visible;
	}
	.cut {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	.cu {
		stroke: var(--accent);
		stroke-width: 3.5;
	}
	.finger {
		fill: var(--paper-2);
		stroke: var(--ink);
		stroke-opacity: 0.45;
		stroke-width: 1;
	}
	.finger.net {
		stroke-opacity: 1;
	}
	.finger.sig {
		fill: var(--accent);
		stroke: var(--accent);
	}
	text {
		font-family: var(--mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.num {
		font-size: 8.5px;
		fill: var(--ink-2);
	}
	.silk {
		font-size: 10px;
		fill: var(--ink);
	}
	.silk.dim {
		fill: var(--ink-2);
	}

	@media (max-width: 820px) {
		.chapter {
			padding-top: 96px;
		}
		.body {
			padding-bottom: 36px;
		}
		.silk {
			display: none;
		}
		.addr {
			font-size: 12vw;
			border-bottom-width: 3px;
		}
	}
</style>
