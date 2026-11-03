<script lang="ts">
	/**
	 * J5 · Otsego Public Schools — the USB keystroke tool.
	 * 2,200 marks (canvas) fill in along an 8-week ruler. Enrollment starts by hand (slow, hollow marks);
	 * then the Arduino HID tool plugs in, keyboard reports stream past, and the fill rate jumps 12×.
	 * An inventory log scrolls as devices land. At the end the facts land on the J5 pin header.
	 * The week the tool comes online, the HID sequence, tags and serials are illustrative placeholders.
	 */
	import Pinned from '../kit/Pinned.svelte';
	import ChapterHead from '../kit/ChapterHead.svelte';
	import { chapters, otsego as data } from '../content';
	import { clamp, seg, ease } from '../kit/motion';

	const ref = chapters.find((c) => c.id === 'otsego')!.ref;
	const { devices: N, schools: S, weeks: WEEKS, team: TEAM, speedup: X } = data.stats;

	// ── Throughput model (illustrative timing, real totals) ─────────────────────────────────────
	const T1 = 1.5; // week the tool comes online (illustrative)
	const R = N / (T1 + X * (WEEKS - T1)); // manual rate, devices / week
	const MANUAL = R * T1;
	const P0 = 0.04;
	const P1 = 0.86;
	const weekAt = (p: number) => WEEKS * seg(p, P0, P1);
	const devicesAt = (w: number) => (w <= T1 ? R * w : Math.min(N, MANUAL + X * R * (w - T1)));
	const fmt = (n: number) => n.toLocaleString('en-US');

	// ── Ruler / cumulative trace (x: 0..1000 = 8 weeks, y: 0..64) ───────────────────────────────
	const RH = 64;
	const kx = (T1 / WEEKS) * 1000;
	const ky = RH - (MANUAL / N) * RH;
	const curve = `M0 ${RH}L${kx} ${ky}L1000 0`;

	// ── HID keyboard reports per enrollment (boot-protocol report: mod, reserved, 6 keys) ───────
	const SEQ: [string, string][] = [
		['05 00 08', 'Ctrl+Alt+E'],
		['00 00 2B', 'Tab'],
		['00 00 2B', 'Tab'],
		['00 00 28', 'Enter'],
		['00 00 ··', 'account'],
		['00 00 28', 'Enter'],
		['00 00 ··', 'password'],
		['00 00 28', 'Enter'],
		['-- -- --', 'wait'],
		['00 00 28', 'Enter']
	];
	const K = SEQ.length;
	const LINES = 7;

	function hash(n: number) {
		let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
		h ^= h >>> 13;
		h = Math.imul(h, 0xc2b2ae35);
		return (h ^ (h >>> 16)) >>> 0;
	}
	const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
	function serial(i: number) {
		let h = hash(i + 7);
		let s = '';
		for (let k = 0; k < 10; k++) {
			s += ALNUM[h % ALNUM.length];
			h = k === 4 ? hash(h) : Math.floor(h / ALNUM.length) + 3;
		}
		return s;
	}

	// ── Canvas: 5 blocks × (20 × 22) marks ──────────────────────────────────────────────────────
	const BC = 20;
	const BR = N / S / BC; // 22 rows
	const GAP = 3;
	const COLS = S * BC + (S - 1) * GAP;
	const LABEL = 18;
	type Fill = { d: number; recent: number };

	function grid(node: HTMLCanvasElement, initial: Fill) {
		let cur = initial;
		const ctx = node.getContext('2d')!;
		const css = getComputedStyle(node);
		const col = (v: string) => css.getPropertyValue(v).trim();
		const C = { ink: col('--ink'), ink2: col('--ink-2'), rule: col('--rule'), accent: col('--accent') };
		let w = 0;
		let h = 0;

		function draw() {
			const dpr = devicePixelRatio || 1;
			if (!w || !h) return;
			if (node.width !== Math.round(w * dpr) || node.height !== Math.round(h * dpr)) {
				node.width = Math.round(w * dpr);
				node.height = Math.round(h * dpr);
			}
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, w, h);
			const cell = Math.min(w / COLS, (h - LABEL) / BR);
			const oy = Math.max(0, (h - LABEL - cell * BR) / 2);
			const m = Math.max(1.6, cell * 0.64);
			const dot = Math.max(1, cell * 0.16);
			const filled = Math.floor(cur.d);

			ctx.font = `${cell > 6 ? 10 : 8.5}px "IBM Plex Mono", monospace`;
			ctx.textBaseline = 'top';
			for (let b = 0; b < S; b++) {
				const bx = b * (BC + GAP) * cell;
				const done = cur.d >= (b + 1) * BC * BR;
				ctx.fillStyle = done ? C.ink : C.ink2;
				ctx.fillText(`SCHOOL ${b + 1}`, bx, oy);
				ctx.fillStyle = C.rule;
				ctx.fillRect(bx, oy + LABEL - 5, BC * cell - (cell - m), 1);
			}

			const off = (cell - m) / 2;
			const doff = (cell - dot) / 2;
			ctx.lineWidth = 1;
			for (let i = 0; i < N; i++) {
				const b = Math.floor(i / (BC * BR));
				const j = i % (BC * BR);
				const x = (b * (BC + GAP) + (j % BC)) * cell;
				const y = oy + LABEL + Math.floor(j / BC) * cell;
				if (i < filled) {
					const hot = i >= filled - cur.recent;
					if (i < MANUAL) {
						ctx.strokeStyle = hot ? C.accent : C.ink;
						ctx.strokeRect(x + off + 0.5, y + off + 0.5, m - 1, m - 1);
					} else {
						ctx.fillStyle = hot ? C.accent : C.ink;
						ctx.fillRect(x + off, y + off, m, m);
					}
				} else {
					ctx.fillStyle = C.rule;
					ctx.fillRect(x + doff, y + doff, dot, dot);
				}
			}
		}

		const ro = new ResizeObserver(([e]) => {
			w = e.contentRect.width;
			h = e.contentRect.height;
			draw();
		});
		ro.observe(node);
		return {
			update(v: Fill) {
				cur = v;
				draw();
			},
			destroy() {
				ro.disconnect();
			}
		};
	}

	const facts = [
		{ pin: 1, k: 'Devices', v: '2,200+', u: 'Chromebooks' },
		{ pin: 2, k: 'Schools', v: String(S), u: 'buildings' },
		{ pin: 3, k: 'Window', v: String(WEEKS), u: 'weeks' },
		{ pin: 4, k: 'IT team', v: String(TEAM), u: 'people' },
		{ pin: 5, k: 'Enrollment', v: `${X}×`, u: 'faster, Arduino HID' },
		{ pin: 6, k: 'Inventory', v: 'All', u: 'tagged + logged' }
	];
</script>

<div class="chapter" id="otsego" data-chapter="otsego">
	<Pinned length={260}>
		{#snippet children(p)}
			{@const wk = weekAt(p)}
			{@const d = devicesAt(wk)}
			{@const tool = wk >= T1}
			{@const plug = ease(seg(wk, T1 - 0.5, T1 - 0.05))}
			{@const done = p >= P1}
			{@const fin = ease(seg(p, 0.87, 0.95))}
			{@const kidx = tool ? Math.floor((d - MANUAL) * K) : -1}
			{@const last = Math.floor(d)}
			<div class="wrap">
				<header class="top">
					<ChapterHead {ref} org={data.org} role={data.role} when={data.when} where={data.where} compact />
					<div class="count">
						<p class="mono lab">Devices enrolled <span class:hot={tool}>rate ×{tool ? X : 1}</span></p>
						<p class="big">
							{done ? '2,200+' : fmt(last)}{#if !done}<span class="of">/ {fmt(N)}+</span>{/if}
						</p>
					</div>
				</header>

				<figure class="ruler">
					<svg viewBox="0 0 1000 {RH}" preserveAspectRatio="none" height={RH} aria-label="Devices enrolled over eight weeks">
						<defs>
							<clipPath id="otsego-done"><rect x="0" y="-2" width={(wk / WEEKS) * 1000} height={RH + 4} /></clipPath>
						</defs>
						{#each Array(WEEKS + 1) as _, i}
							<line x1={i * 125} x2={i * 125} y1="0" y2={RH} class="grid" />
						{/each}
						<line x1={kx} x2={kx} y1="0" y2={RH} class="mark" />
						<path d={curve} class="c future" />
						<path d={curve} class="c now" clip-path="url(#otsego-done)" />
						<line x1={(wk / WEEKS) * 1000} x2={(wk / WEEKS) * 1000} y1="0" y2={RH + 10} class="cursor" />
					</svg>
					<span class="mono ann a1" style:left="0">By hand ×1</span>
					<span class="mono ann a2" class:hot={tool} style:left="{(T1 / WEEKS) * 100}%">HID tool online ×{X}</span>
					<div class="dim mono" aria-hidden="true">
						<i class="arr l"></i><span>{WEEKS} weeks · Jun – Aug 2022</span><i class="arr r"></i>
					</div>
					<div class="ticks mono" aria-hidden="true">
						{#each Array(WEEKS) as _, i}
							<span style:left="{((i + 0.5) / WEEKS) * 100}%" class:on={wk > i}>W{i + 1}</span>
						{/each}
					</div>
				</figure>

				<div class="field">
					<canvas use:grid={{ d, recent: tool ? 26 : 2 }} aria-label="{fmt(last)} of {fmt(N)} Chromebooks enrolled"></canvas>
					<p class="mono legend"><span><i class="sq hollow"></i>by hand</span><span><i class="sq"></i>by HID tool</span><span><i class="sq hot"></i>just landed</span><span class="one">1 mark = 1 Chromebook</span></p>
				</div>

				<div class="bottom">
					<div class="panels" style:opacity={1 - fin} aria-hidden={fin > 0.5}>
						<svg class="usb" viewBox="0 0 220 120" aria-label="Arduino keystroke tool plugged into a Chromebook">
							<rect x="4" y="22" width="96" height="70" class="ln" />
							{#each Array(8) as _, i}
								<circle cx={16 + i * 10} cy="32" r="2" class="ln" />
								<circle cx={16 + i * 10} cy="82" r="2" class="ln" />
							{/each}
							<rect x="34" y="46" width="30" height="22" class="ln" />
							<text x="10" y="16" class="silk">ARDUINO · HID</text>
							<g transform="translate({(1 - plug) * -26} 0)">
								<path d="M100 57H128" class="ln" />
								<rect x="128" y="47" width="24" height="20" class="ln" />
								<rect x="152" y="50" width="22" height="14" class="ln" />
								{#each [0, 1, 2, 3] as i}
									<rect x={156 + i * 4.5} y="53" width="2.5" height="8" class="pin" class:on={plug > 0.98} />
								{/each}
							</g>
							<path d="M150 40V74H216" class="ln" />
							<path d="M150 40H216" class="ln" />
							<text x="152" y="88" class="silk">CHROMEBOOK</text>
							<text x="128" y="106" class="silk" class:hot={plug > 0.98}>{plug > 0.98 ? 'J5 · CONNECTED' : 'J5 · OPEN'}</text>
						</svg>

						<div class="stream">
							<p class="mono head">HID reports <span>mod · res · key</span></p>
							<ol class="mono">
								{#if kidx < 0}
									{#each Array(LINES) as _, i}
										{@const n = last - LINES + 1 + i}
										{#if n >= 1}
											<li class="idle"><span class="dev">#{String(n).padStart(4, '0')}</span><span class="bytes">manual</span><span class="key">typed by hand</span></li>
										{:else}
											<li class="idle"><span class="dev">····</span><span class="bytes">-- -- --</span><span class="key"></span></li>
										{/if}
									{/each}
								{:else}
									{#each Array(LINES) as _, i}
										{@const k = kidx - LINES + 1 + i}
										{#if k >= 0}
											{@const [b, key] = SEQ[k % K]}
											<li class:new={i === LINES - 1}>
												<span class="dev">#{String(Math.ceil(MANUAL) + Math.floor(k / K) + 1).padStart(4, '0')}</span><span class="bytes">{b}&nbsp;<em>00 00 00 00 00</em></span><span class="key">{key}</span>
											</li>
										{:else}
											<li class="idle"><span class="dev">····</span><span class="bytes">-- -- --</span><span class="key"></span></li>
										{/if}
									{/each}
								{/if}
							</ol>
						</div>

						<div class="log">
							<p class="mono head">Inventory DB <span>append-only</span></p>
							<table class="mono">
								<thead><tr><th>Tag</th><th>Serial</th><th>Site</th><th>Status</th></tr></thead>
								<tbody>
									{#each [5, 4, 3, 2, 1] as back}
										{@const i = last - back}
										{#if i >= 0}
											<tr class:new={back === 1}>
												<td>A-{String(i + 1).padStart(5, '0')}</td>
												<td>{serial(i)}</td>
												<td>S{Math.floor(i / (BC * BR)) + 1}</td>
												<td>{back === 1 ? 'logged' : 'ok'}</td>
											</tr>
										{:else}
											<tr class="idle"><td>—</td><td>—</td><td>—</td><td>—</td></tr>
										{/if}
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<div class="header" style:opacity={fin} aria-hidden={fin < 0.5}>
						<p class="mono cap"><i class="via"></i>J5 · Pin assignments</p>
						<ol>
							{#each facts as f, i}
								{@const o = ease(seg(p, 0.87 + i * 0.013, 0.91 + i * 0.013))}
								<li style:opacity={0.15 + 0.85 * o}>
									<span class="mono n">{f.pin}</span>
									<i class="pad" class:on={o > 0.5}></i>
									<b>{f.v}</b>
									<span class="k">{f.k}</span>
									<span class="mono u">{f.u}</span>
								</li>
							{/each}
						</ol>
					</div>
				</div>
			</div>
		{/snippet}
	</Pinned>
</div>

<style>
	.wrap {
		height: 100%;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto;
		row-gap: 18px;
		padding: 72px var(--gutter) 28px var(--rail);
	}

	/* ── header + counter ── */
	.top {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 24px;
	}
	.count {
		text-align: right;
		flex: none;
	}
	.lab {
		color: var(--ink-2);
		font-size: 10.5px;
	}
	.lab span {
		margin-left: 12px;
		padding: 1px 6px;
		border: 1px solid var(--rule);
		color: var(--ink-2);
	}
	.lab span.hot {
		border-color: var(--accent);
		color: var(--accent);
	}
	.big {
		font-size: clamp(56px, 7vw, 108px);
		font-stretch: 62%;
		font-weight: 800;
		line-height: 0.86;
		font-variant-numeric: tabular-nums;
		margin-top: 6px;
	}
	.of {
		font-size: 0.32em;
		font-weight: 560;
		font-stretch: 75%;
		color: var(--ink-2);
		margin-left: 10px;
	}

	/* ── ruler ── */
	.ruler {
		position: relative;
		margin: 0;
		padding-top: 18px;
	}
	.ruler svg {
		display: block;
		width: 100%;
		overflow: visible;
	}
	.grid {
		stroke: var(--rule);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.mark {
		stroke: var(--ink);
		stroke-width: 1;
		stroke-dasharray: 2 3;
		vector-effect: non-scaling-stroke;
	}
	.c {
		fill: none;
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}
	.future {
		stroke: var(--rule);
	}
	.now {
		stroke: var(--ink);
	}
	.cursor {
		stroke: var(--accent);
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}
	.ann {
		position: absolute;
		top: 0;
		font-size: 10px;
		color: var(--ink-2);
		white-space: nowrap;
	}
	.a2 {
		padding-left: 6px;
	}
	.ann.hot {
		color: var(--accent);
	}
	.dim {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 22px;
		font-size: 10px;
		color: var(--ink-2);
	}
	.dim::before,
	.dim::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--ink);
		order: 1;
	}
	.dim::before {
		order: 0;
	}
	.dim span {
		order: 1;
	}
	.dim::after {
		order: 2;
	}
	.arr {
		width: 0;
		height: 0;
		border-top: 4px solid transparent;
		border-bottom: 4px solid transparent;
	}
	.arr.l {
		order: -1;
		border-right: 7px solid var(--ink);
		margin-right: -8px;
	}
	.arr.r {
		order: 3;
		border-left: 7px solid var(--ink);
		margin-left: -8px;
	}
	.ticks {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(18px + 64px + 3px);
		height: 14px;
		font-size: 9.5px;
		color: var(--ink-2);
	}
	.ticks span {
		position: absolute;
		transform: translateX(-50%);
	}
	.ticks span.on {
		color: var(--ink);
	}

	/* ── canvas field ── */
	.field {
		min-height: 0;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		gap: 6px;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
	}
	.legend {
		font-size: 9.5px;
		color: var(--ink-2);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-right: 10px;
	}
	.legend .one {
		margin-left: auto;
		margin-right: 0;
	}
	.sq {
		display: inline-block;
		width: 7px;
		height: 7px;
		background: var(--ink);
	}
	.sq.hollow {
		background: none;
		border: 1px solid var(--ink);
	}
	.sq.hot {
		background: var(--accent);
	}

	/* ── bottom: tool panels → pin header ── */
	.bottom {
		position: relative;
		display: grid;
		border-top: 1px solid var(--ink);
		padding-top: 14px;
	}
	.panels,
	.header {
		grid-area: 1 / 1;
	}
	.panels {
		display: grid;
		align-content: start;
		grid-template-columns: 220px minmax(0, 1.1fr) minmax(0, 1fr);
		gap: 32px;
		align-items: start;
	}
	.usb {
		width: 100%;
		height: auto;
	}
	.ln {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1;
	}
	.pin {
		fill: var(--paper-2);
		stroke: var(--ink);
		stroke-width: 0.6;
	}
	.pin.on {
		fill: var(--accent);
	}
	.silk {
		font-family: var(--mono);
		font-size: 8.5px;
		letter-spacing: 0.06em;
		fill: var(--ink-2);
	}
	.silk.hot {
		fill: var(--accent);
	}
	.head {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		color: var(--ink);
		margin-bottom: 6px;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--rule);
	}
	.head span {
		color: var(--ink-2);
	}
	.stream ol {
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 11px;
		line-height: 17px;
		text-transform: none;
		font-variant-numeric: tabular-nums;
	}
	.stream li {
		display: grid;
		grid-template-columns: 6ch minmax(0, auto) 1fr;
		gap: 14px;
		white-space: nowrap;
		color: var(--ink-2);
	}
	.stream li.new {
		color: var(--accent);
	}
	.stream li:not(.idle):not(.new) .bytes,
	.stream li:not(.idle):not(.new) .key {
		color: var(--ink);
	}
	.stream em {
		font-style: normal;
		opacity: 0.45;
	}
	.stream li.idle {
		opacity: 0.55;
	}
	.log table {
		width: 100%;
		border-collapse: collapse;
		font-size: 11px;
		text-transform: none;
		font-variant-numeric: tabular-nums;
	}
	.log th {
		text-align: left;
		font-weight: 400;
		font-size: 9.5px;
		text-transform: uppercase;
		color: var(--ink-2);
		padding: 0 8px 2px 0;
	}
	.log td {
		padding: 0 8px 0 0;
		line-height: 17px;
		white-space: nowrap;
	}
	.log tr.new td {
		color: var(--accent);
	}
	.log tr.idle td {
		color: var(--ink-2);
		opacity: 0.5;
	}

	.header .cap {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--accent);
		margin-bottom: 10px;
	}
	.via {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 3px solid var(--accent);
	}
	.header ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		border: 1px solid var(--ink);
	}
	.header li {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-rows: auto auto auto auto;
		column-gap: 10px;
		padding: 12px 14px 14px;
		border-left: 1px solid var(--rule);
		align-items: center;
	}
	.header li:first-child {
		border-left: 0;
	}
	.n {
		color: var(--ink-2);
		font-size: 10px;
	}
	.pad {
		justify-self: end;
		width: 14px;
		height: 14px;
		border: 1px solid var(--ink);
		background: var(--paper-2);
	}
	.pad.on {
		background: var(--accent);
		border-color: var(--accent);
	}
	.header b {
		grid-column: 1 / -1;
		font-size: clamp(30px, 3.4vw, 48px);
		font-stretch: 62%;
		font-weight: 800;
		line-height: 1;
		margin-top: 8px;
		font-variant-numeric: tabular-nums;
	}
	.k {
		grid-column: 1 / -1;
		font-weight: 600;
		font-stretch: 85%;
		font-size: 15px;
	}
	.u {
		grid-column: 1 / -1;
		color: var(--ink-2);
		font-size: 9.5px;
	}

	@media (max-width: 1100px) {
		.panels {
			grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		}
		.usb {
			display: none;
		}
	}

	@media (max-width: 820px) {
		.wrap {
			padding-top: 56px;
			padding-bottom: 18px;
			row-gap: 12px;
		}
		.top {
			flex-direction: column;
			align-items: stretch;
			gap: 10px;
		}
		.count {
			text-align: left;
		}
		.legend .one {
			display: none;
		}
		.big {
			font-size: 52px;
		}
		.panels {
			grid-template-columns: minmax(0, 1fr);
			gap: 12px;
		}
		.stream li {
			grid-template-columns: 6ch auto 1fr;
			gap: 10px;
		}
		.stream em {
			display: none;
		}
		.stream ol,
		.log table {
			font-size: 10px;
			line-height: 14px;
		}
		.stream li:nth-child(-n + 3) {
			display: none;
		}
		.log td {
			line-height: 14px;
		}
		.log tbody tr:nth-child(-n + 2) {
			display: none;
		}
		.header ol {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.header li {
			padding: 8px 10px 10px;
			border-top: 1px solid var(--rule);
		}
		.header li:nth-child(-n + 3) {
			border-top: 0;
		}
		.header li:nth-child(4) {
			border-left: 0;
		}
		.header b {
			font-size: 30px;
			margin-top: 4px;
		}
		.k {
			font-size: 13px;
		}
		.ann {
			font-size: 9px;
		}
	}
</style>
