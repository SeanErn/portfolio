<script lang="ts">
	/**
	 * U1 · Speechify. One pinned scene in three movements:
	 *   1. a sentence is read aloud, word by word, while its waveform is recorded underneath;
	 *   2. the analog trace collapses to a single line that fans out into six logic channels;
	 *   3. a logic-analyzer capture of a CI/CD pipeline runs under a sweeping cursor.
	 * Everything is a pure function of the scroll progress p.
	 */
	import Pinned from '../kit/Pinned.svelte';
	import ChapterHead from '../kit/ChapterHead.svelte';
	import { chapters, speechify as data } from '../content';
	import { seg, lerp, ease, easeOut } from '../kit/motion';

	const ref = chapters.find((c) => c.id === 'speechify')!.ref;

	// ---- timeline (fractions of p) -------------------------------------------------------------
	const READ_A = 0.04;
	const READ_B = 0.42;
	const FLAT_A = 0.44;
	const FLAT_B = 0.52;
	const FAN_A = 0.5;
	const FAN_B = 0.6;
	const CAP_A = 0.61;
	const CAP_B = 0.93;

	// ---- the sentence and its (illustrative) word timings --------------------------------------
	const SENTENCE =
		'I just joined Speechify as a software engineer, on the team behind the text-to-speech app.';
	/** Length of the read-aloud clip in seconds (≈180 words a minute). */
	const DUR = 5;

	const syllables = (w: string) => {
		const s = w.toLowerCase().replace(/[^a-z]/g, '');
		let n = (s.match(/[aeiouy]+/g) ?? []).length;
		if (s.length > 3 && s.endsWith('e') && !s.endsWith('le')) n--;
		return Math.max(1, n);
	};

	const WORDS = (() => {
		const raw = SENTENCE.split(' ').map((text) => {
			const syl = syllables(text);
			const pause = /,$/.test(text) ? 0.22 : 0.035;
			return { text, syl, len: 0.07 + syl * 0.17, pause };
		});
		const lead = 0.18;
		const tail = 0.24;
		const total = raw.reduce((a, w) => a + w.len + w.pause, 0);
		const k = (DUR - lead - tail) / total;
		let t = lead;
		return raw.map((w) => {
			const t0 = t;
			const t1 = t0 + w.len * k;
			t = t1 + w.pause * k;
			return { text: w.text, syl: w.syl, t0, t1 };
		});
	})();
	const END = WORDS[WORDS.length - 1].t1;
	/** Word-tier boundaries (contiguous intervals, split in the middle of each pause), Praat-style. */
	const BOUNDS = WORDS.map((w, i) => (i ? (WORDS[i - 1].t1 + w.t0) / 2 : w.t0)).concat(END);

	/** Deterministic pseudo-random 0..1. */
	const rnd = (i: number) => {
		const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
		return x - Math.floor(x);
	};

	/** Speech amplitude envelope 0..1 at time t (s): one bump per syllable, a noise floor between words. */
	const envelope = (t: number) => {
		for (let i = 0; i < WORDS.length; i++) {
			const w = WORDS[i];
			if (t < w.t0 || t >= w.t1) continue;
			const u = ((t - w.t0) / (w.t1 - w.t0)) * w.syl;
			const k = Math.min(w.syl - 1, Math.floor(u));
			const v = u - k;
			const bump = Math.sin(Math.PI * v ** 0.55) ** 1.3;
			return 0.04 + bump * (0.42 + 0.58 * rnd(i * 7 + k));
		}
		return 0.035;
	};

	// ---- the pipeline capture (time in arbitrary units, 0..10) ---------------------------------
	const SPAN = 10;
	const CH = [
		{ id: 'D0', name: 'PUSH', hi: [[0.4, 0.7]] },
		{ id: 'D1', name: 'BUILD', hi: [[0.9, 3.4]] },
		{ id: 'D2', name: 'TEST', hi: [[3.6, 6.2]] },
		{ id: 'D3', name: 'DOCS', hi: [[3.6, 4.9]] },
		{ id: 'D4', name: 'PACKAGE', hi: [[6.4, 7.6]] },
		{ id: 'D5', name: 'RELEASE', hi: [[7.8, 8.3], [8.5, 9.0], [9.2, 9.7]] }
	] as const;
	const T_FIRST = 0.4;
	const T_LAST = 9.7;

	// ---- geometry ------------------------------------------------------------------------------
	let W = $state(0);
	let H = $state(0);
	let stageW = $state(1440);

	const g = $derived.by(() => {
		const w = Math.max(W, 240);
		const h = Math.max(H, 200);
		const narrow = w < 560;
		const x0 = narrow ? 80 : 104;
		const x1 = w - 4;
		const rulerY = 22;
		const top = 34;
		const bottom = h - (narrow ? 30 : 36);
		const rowH = (bottom - top) / CH.length;
		const cy = top + (bottom - top) * 0.42;
		const amp = (bottom - top) * 0.34;
		return {
			w,
			h,
			narrow,
			x0,
			x1,
			rulerY,
			top,
			bottom,
			rowH,
			cy,
			amp,
			tier0: bottom - 24,
			tier1: bottom - 2,
			xs: (t: number) => x0 + (t / DUR) * (x1 - x0),
			xt: (t: number) => x0 + (t / SPAN) * (x1 - x0)
		};
	});

	/** The recorded waveform: a zig-zag carrier under the speech envelope, sampled every pixel. */
	const wave = $derived.by(() => {
		const { x0, x1, cy, amp } = g;
		let d = '';
		for (let x = x0, i = 0; x <= x1; x += 1.6, i++) {
			const t = ((x - x0) / (x1 - x0)) * DUR;
			const c = (i % 2 ? 1 : -1) * (0.35 + 0.65 * rnd(i * 0.37)) ** 0.7;
			const y = cy - envelope(t) * amp * c;
			d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
		}
		return d;
	});

	const ticks = $derived.by(() => {
		const out: { x: number; major: boolean; i: number }[] = [];
		for (let i = 0; i <= 50; i++) out.push({ x: g.x0 + (i / 50) * (g.x1 - g.x0), major: i % 5 === 0, i: i / 5 });
		return out;
	});

	// ---- per-frame state -----------------------------------------------------------------------
	const lowY = (i: number) => g.top + g.rowH * (i + 1) - g.rowH * 0.24;
	const hiAmp = () => g.rowH * 0.46;

	function trace(hi: readonly (readonly number[])[], tc: number, L: number, a: number) {
		let d = `M${g.x0},${L.toFixed(1)}`;
		let fill = '';
		for (const [s, e] of hi) {
			if (s >= tc) break;
			const xs = g.xt(s).toFixed(1);
			const xe = g.xt(Math.min(e, tc)).toFixed(1);
			d += `H${xs}V${(L - a).toFixed(1)}H${xe}`;
			fill += `M${xs},${(L - a).toFixed(1)}H${xe}V${L.toFixed(1)}H${xs}Z`;
			if (e >= tc) return { d, fill };
			d += `V${L.toFixed(1)}`;
		}
		d += `H${g.xt(tc).toFixed(1)}`;
		return { d, fill };
	}

	function frame(p: number) {
		// 1. read-along
		const rt = seg(p, READ_A, READ_B) * DUR;
		let cur = -1;
		for (let i = 0; i < WORDS.length; i++) if (WORDS[i].t0 <= rt) cur = i;
		const spoken = rt >= END;
		const playX = g.xs(rt);
		// 2. hand-off
		const flat = ease(seg(p, FLAT_A, FLAT_B));
		const fan = ease(seg(p, FAN_A, FAN_B));
		// 3. capture
		const cap = seg(p, CAP_A, CAP_B);
		const tc = cap * SPAN;
		const capX = g.xt(tc);
		const a = hiAmp() * fan;
		const rows = CH.map((c, i) => {
			const L = lerp(g.cy, lowY(i), fan);
			const on = cap > 0 && c.hi.some(([s, e]) => tc >= s && tc < e);
			return { ...c, L, on, ...trace(c.hi, tc, L, a) };
		});
		const active = rows.filter((r) => r.on).map((r) => r.name);

		let status: string;
		let readout: string;
		if (p <= READ_A) {
			status = 'Armed';
			readout = `t 0.00 s`;
		} else if (p < FLAT_A) {
			status = spoken ? 'Stop' : 'Play';
			readout = `t ${rt.toFixed(2)} s · word ${String(cur + 1).padStart(2, '0')}/${WORDS.length}`;
		} else if (p < CAP_A) {
			status = 'Trig';
			readout = 'A0 → D0–D5';
		} else if (p < CAP_B) {
			status = 'Run';
			readout = `T+${tc.toFixed(2)} · ${active.length ? active.join(' + ') : 'idle'}`;
		} else {
			status = 'Stop';
			readout = `T+${SPAN.toFixed(2)} · done`;
		}

		return {
			rt,
			cur: spoken ? WORDS.length : cur,
			playX,
			playOn: seg(p, READ_A - 0.02, READ_A) * (1 - seg(p, FLAT_A, FLAT_A + 0.04)),
			flat,
			fan,
			waveOn: 1 - seg(p, FAN_A + 0.02, FAN_A + 0.06),
			secOn: 1 - seg(p, FLAT_A, FLAT_A + 0.04),
			stepOn: seg(p, FAN_B - 0.04, FAN_B),
			voiceOn: 1 - seg(p, FLAT_A, FLAT_A + 0.05),
			busOn: 1 - seg(p, CAP_A, CAP_A + 0.06),
			tierOn: 1 - ease(seg(p, FLAT_A, FLAT_A + 0.05)),
			gridOn: ease(seg(p, FAN_A + 0.04, FAN_B)),
			cap,
			tc,
			capX,
			capOn: seg(p, CAP_A - 0.02, CAP_A),
			rows,
			digital: p >= FAN_A,
			running: (p > READ_A && !spoken && p < FLAT_A) || (p > CAP_A && p < CAP_B),
			status,
			readout,
			trig: tc >= T_FIRST,
			dim: easeOut(seg(p, CAP_B, CAP_B + 0.05)),
			capIn: ease(seg(p, 0.56, 0.68))
		};
	}

	const fmtClock = (t: number) => `0:${t.toFixed(1).padStart(4, '0')}`;
</script>

<div class="chapter" id="speechify" data-chapter="speechify">
	<Pinned length={280}>
		{#snippet children(p)}
			{@const f = frame(p)}
			<div class="wrap" bind:clientWidth={stageW} style:--capin={f.capIn}>
				<div class="head">
					<ChapterHead {ref} org={data.org} role={data.role} when={data.when} where={data.where} compact={stageW < 700} />
				</div>

				<div class="copy">
					<div class="read">
						<p class="mono label">
							<span>Read aloud</span>
							<span class="clock">{fmtClock(f.rt)} / {fmtClock(DUR)}</span>
						</p>
						<p class="sentence">
							{#each WORDS as w, i}<span class="w" class:done={i < f.cur} class:now={i === f.cur}
									>{w.text}</span
								>{' '}{/each}
						</p>
					</div>
					<div class="cap" style:opacity={f.capIn} style:transform="translateY({(1 - f.capIn) * 12}px)">
						<p class="mono label"><span class="k">First project</span><span>Most likely</span></p>
						<p class="lead">CI/CD.</p>
						<p class="body">
							I've built one before: the QuestNav pipeline on GitHub Actions, with automated builds, doc
							generation and multi-target releases.
						</p>
					</div>
				</div>

				<figure class="scope">
					<div class="bar mono">
						<span class="mode">
							{#if f.digital}D0–D5 · Pipeline · 6 ch logic{:else}A0 · Voice · 1 ch analog{/if}
						</span>
						<span class="status" class:run={f.running}><i></i>{f.status}</span>
						<span class="readout">{f.readout}</span>
					</div>

					<div class="plot" bind:clientWidth={W} bind:clientHeight={H}>
						<svg width={g.w} height={g.h} viewBox="0 0 {g.w} {g.h}" aria-hidden="true">
							<defs>
								<pattern id="u1-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
									<line x1="0" y1="0" x2="0" y2="5" class="hatch" />
								</pattern>
								<clipPath id="u1-rec"><rect x={g.x0} y="0" width={Math.max(0, f.playX - g.x0)} height={g.h} /></clipPath>
							</defs>

							<!-- ruler -->
							<g class="ruler">
								<line x1={g.x0} x2={g.x1} y1={g.rulerY} y2={g.rulerY} class="axis" />
								{#each ticks as t}
									<line x1={t.x} x2={t.x} y1={g.rulerY} y2={g.rulerY - (t.major ? 7 : 3)} class="axis" />
									{#if t.major && (!g.narrow || t.i % 2 === 0)}
										<text
											x={t.x}
											y={g.rulerY - 11}
											class="num"
											text-anchor={t.i === 0 ? 'start' : t.i === 10 ? 'end' : 'middle'}
											style:opacity={f.secOn}>{(t.i * 0.5).toFixed(1)}</text
										>
										<text
											x={t.x}
											y={g.rulerY - 11}
											class="num"
											text-anchor={t.i === 0 ? 'start' : t.i === 10 ? 'end' : 'middle'}
											style:opacity={f.stepOn}>{t.i}</text
										>
									{/if}
								{/each}
								<text x="0" y={g.rulerY - 11} class="lbl dim" style:opacity={f.secOn}>t / s</text>
								<text x="0" y={g.rulerY - 11} class="lbl dim" style:opacity={f.stepOn}>{g.narrow ? 'T' : 'T / step'}</text>
								{#if f.trig}
									<g transform="translate({g.xt(T_FIRST)} {g.rulerY})">
										<path d="M-4,-8 L4,-8 L0,-1 Z" class="trig" />
									</g>
								{/if}
							</g>

							<!-- grid: dotted verticals on the majors, hairlines between channels -->
							<g opacity={f.gridOn}>
								{#each ticks as t}
									{#if t.major && t.i > 0}
										<line x1={t.x} x2={t.x} y1={g.top} y2={g.bottom} class="grid" />
									{/if}
								{/each}
								{#each CH as _, i}
									<line x1="0" x2={g.x1} y1={g.top + g.rowH * (i + 1)} y2={g.top + g.rowH * (i + 1)} class="sep" />
								{/each}
							</g>

							<!-- 1. analog: ghost of the whole clip, the recorded part, the word tier -->
							<g opacity={f.waveOn} transform="translate(0 {g.cy}) scale(1 {Math.max(0.001, 1 - f.flat)}) translate(0 {-g.cy})">
								<path d={wave} class="wave ghost" />
								<path d={wave} class="wave" clip-path="url(#u1-rec)" />
							</g>
							{#if f.flat > 0 && f.fan < 1}
								<line x1={g.x0} x2={g.x1} y1={g.cy} y2={g.cy} class="bus" opacity={f.flat * (1 - Math.min(1, f.fan * 3))} />
							{/if}

							<g class="tier" opacity={f.tierOn}>
								<line x1={g.x0} x2={g.x1} y1={g.tier0} y2={g.tier0} class="sep" />
								<line x1={g.x0} x2={g.x1} y1={g.tier1} y2={g.tier1} class="sep" />
								{#each WORDS as w, i}
									{@const a = g.xs(BOUNDS[i])}
									{@const b = g.xs(BOUNDS[i + 1])}
									<line x1={a} x2={a} y1={g.tier0} y2={g.tier1} class="axis" />
									{#if i === WORDS.length - 1}<line x1={b} x2={b} y1={g.tier0} y2={g.tier1} class="axis" />{/if}
									{#if i === f.cur}
										<rect x={a} y={g.tier1 - 2} width={b - a} height="2" class="cur" />
									{/if}
									{#if b - a > w.text.replace(/[,.]$/, '').length * 5.5 + 4}
										<text
											x={(a + b) / 2}
											y={g.tier1 - 7}
											text-anchor="middle"
											class="word"
											class:said={i < f.cur}
											class:saying={i === f.cur}>{w.text.replace(/[,.]$/, '').toLowerCase()}</text
										>
									{/if}
								{/each}
								<text x="0" y={g.tier1 - 7} class="lbl dim">words</text>
							</g>

							<text x="0" y={g.cy + 4} class="lbl" style:opacity={f.voiceOn}><tspan class="dim">A0</tspan> voice</text>

							<!-- playhead -->
							{#if f.playOn > 0}
								<g opacity={f.playOn}>
									<line x1={f.playX} x2={f.playX} y1={g.rulerY} y2={g.tier1} class="cursor" />
									<path d="M{f.playX - 4},{g.rulerY} L{f.playX + 4},{g.rulerY} L{f.playX},{g.rulerY + 6} Z" class="trig" />
								</g>
							{/if}

							<!-- 2–3. logic channels -->
							{#if f.fan > 0}
								{#each f.rows as r}
									<g opacity={f.fan}>
										{#if r.fill}<path d={r.fill} class="fill" />{/if}
										<path d={r.d} class="sig" class:on={r.on} />
										<line x1={f.capX} x2={g.x1} y1={r.L} y2={r.L} class="idle" />
										{#if f.busOn > 0}
											<line x1={f.capX} x2={g.x1} y1={r.L} y2={r.L} class="bus" style:opacity={f.busOn} />
										{/if}
										<text x="0" y={r.L - g.rowH * 0.12} class="lbl" class:on={r.on}
											>{#if !g.narrow}<tspan class="dim">{r.id + '\u00a0'}</tspan>{/if}{r.name}</text
										>
										<text x={g.x0 - 12} y={r.L - g.rowH * 0.12} class="lbl val" class:on={r.on} text-anchor="end"
											>{r.on ? 1 : 0}</text
										>
									</g>
								{/each}
								<line x1={g.x0 - 4} x2={g.x0 - 4} y1={g.top} y2={g.bottom} class="sep" opacity={f.gridOn} />
							{/if}

							<!-- capture cursor -->
							{#if f.capOn > 0}
								<g opacity={f.capOn}>
									<line x1={f.capX} x2={f.capX} y1={g.rulerY} y2={g.bottom} class="cursor" />
									<path d="M{f.capX - 4},{g.rulerY} L{f.capX + 4},{g.rulerY} L{f.capX},{g.rulerY + 6} Z" class="trig" />
								</g>
							{/if}

							<!-- dimension: first edge to last edge -->
							{#if f.dim > 0}
								{@const xa = g.xt(T_FIRST)}
								{@const xb = g.xt(T_LAST)}
								{@const xm = lerp(xa, xb, 0.5)}
								{@const half = ((xb - xa) / 2) * f.dim}
								{@const y = g.bottom + (g.narrow ? 15 : 18)}
								<g opacity={f.dim}>
									<line x1={xa} x2={xa} y1={lowY(0) + 3} y2={y + 5} class="ext" />
									<line x1={xb} x2={xb} y1={lowY(CH.length - 1) + 3} y2={y + 5} class="ext" />
									<line x1={xm - half} x2={xm + half} y1={y} y2={y} class="dimline" />
									<path d="M{xm - half + 6},{y - 3} L{xm - half},{y} L{xm - half + 6},{y + 3}" class="dimline" />
									<path d="M{xm + half - 6},{y - 3} L{xm + half},{y} L{xm + half - 6},{y + 3}" class="dimline" />
									<text x={xm} y={y + 3.5} text-anchor="middle" class="lbl dimtext">push to release</text>
								</g>
							{/if}
						</svg>
					</div>

					<figcaption class="mono">
						<span>Fig. 1 — Voice in, pipeline out</span>
					</figcaption>
				</figure>
			</div>
		{/snippet}
	</Pinned>
</div>

<style>
	.wrap {
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.38fr);
		grid-template-rows: auto minmax(0, 1fr);
		grid-template-areas:
			'head scope'
			'copy scope';
		column-gap: clamp(32px, 4vw, 64px);
		padding: 78px var(--gutter) 40px var(--rail);
	}
	.head {
		grid-area: head;
	}

	/* ---- copy ---- */
	.copy {
		grid-area: copy;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 28px;
		padding-top: 40px;
		min-height: 0;
	}
	.label {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		font-size: 10.5px;
		color: var(--ink-2);
		padding-bottom: 8px;
		margin-bottom: 14px;
		border-bottom: 1px solid var(--rule);
	}
	.clock {
		font-variant-numeric: tabular-nums;
	}
	.sentence {
		font-size: clamp(1.45rem, 2.35vw, 2.25rem);
		font-stretch: 78%;
		font-weight: 600;
		line-height: 1.16;
		letter-spacing: -0.005em;
		max-width: 22ch;
	}
	.w {
		color: var(--ink-2);
		opacity: 0.42;
		padding: 0 0.07em;
		margin: 0 -0.07em;
		-webkit-box-decoration-break: clone;
		box-decoration-break: clone;
	}
	.w.done {
		color: var(--ink);
		opacity: 1;
	}
	.w.now {
		color: var(--paper);
		background: var(--accent);
		opacity: 1;
	}
	.cap .k {
		color: var(--accent);
	}
	.lead {
		font-size: clamp(2.4rem, 4.2vw, 3.8rem);
		font-stretch: 62%;
		font-weight: 800;
		line-height: 0.9;
		text-transform: uppercase;
	}
	.body {
		margin-top: 10px;
		max-width: 40ch;
		font-size: 1rem;
		line-height: 1.42;
		color: var(--ink-2);
	}

	/* ---- the instrument ---- */
	.scope {
		grid-area: scope;
		margin: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-top: 1px solid var(--ink);
		border-bottom: 1px solid var(--ink);
	}
	.bar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas: 'mode status' 'readout readout';
		gap: 4px 16px;
		padding: 9px 0 10px;
		border-bottom: 1px solid var(--rule);
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
	}
	.mode {
		grid-area: mode;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.readout {
		grid-area: readout;
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.status {
		grid-area: status;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		color: var(--ink-2);
	}
	.status i {
		width: 7px;
		height: 7px;
		border: 1px solid var(--ink);
	}
	.status.run {
		color: var(--accent);
	}
	.status.run i {
		background: var(--accent);
		border-color: var(--accent);
	}
	.plot {
		position: relative;
		flex: 1;
		min-height: 0;
		margin-top: 14px;
	}
	.plot svg {
		position: absolute;
		inset: 0;
		display: block;
		overflow: visible;
	}
	figcaption {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 9px 0;
		border-top: 1px solid var(--rule);
		font-size: 10px;
		color: var(--ink-2);
	}

	/* svg marks */
	.axis {
		stroke: var(--ink);
		stroke-width: 1;
	}
	.grid {
		stroke: var(--ink);
		stroke-opacity: 0.28;
		stroke-width: 1;
		stroke-dasharray: 1 4;
	}
	.sep {
		stroke: var(--rule);
		stroke-width: 1;
	}
	.num,
	.lbl {
		font-family: var(--mono);
		font-size: 10.5px;
		letter-spacing: 0.04em;
		fill: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.num {
		fill: var(--ink-2);
		font-size: 10px;
	}
	.lbl {
		text-transform: uppercase;
	}
	.lbl .dim,
	.lbl.dim {
		fill: var(--ink-2);
		opacity: 0.8;
	}
	.lbl.on {
		fill: var(--accent);
	}
	.lbl.val {
		fill: var(--ink-2);
	}
	.lbl.val.on {
		fill: var(--accent);
	}
	.wave {
		fill: none;
		stroke: var(--ink);
		stroke-width: 0.9;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}
	.wave.ghost {
		stroke-opacity: 0.16;
	}
	.bus {
		stroke: var(--ink);
		stroke-width: 1.25;
	}
	.word {
		font-family: var(--mono);
		font-size: 9.5px;
		fill: var(--ink-2);
		opacity: 0.55;
	}
	.word.said {
		fill: var(--ink);
		opacity: 1;
	}
	.word.saying {
		fill: var(--accent);
		opacity: 1;
	}
	.cur,
	.trig {
		fill: var(--accent);
	}
	.cursor {
		stroke: var(--accent);
		stroke-width: 1;
	}
	.sig {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.25;
		stroke-linejoin: miter;
	}
	.fill {
		fill: url(#u1-hatch);
	}
	.hatch {
		stroke: var(--ink);
		stroke-opacity: 0.22;
		stroke-width: 1;
	}
	.idle {
		stroke: var(--ink);
		stroke-opacity: 0.35;
		stroke-width: 1;
		stroke-dasharray: 1 3;
	}
	.ext {
		stroke: var(--ink);
		stroke-opacity: 0.5;
		stroke-width: 0.75;
		stroke-dasharray: 2 2;
	}
	.dimline {
		fill: none;
		stroke: var(--ink);
		stroke-width: 0.9;
	}
	.dimtext {
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 8px;
		stroke-linejoin: round;
	}

	/* ---- phone / narrow ---- */
	@media (max-width: 900px) {
		.wrap {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto auto minmax(0, 1fr);
			grid-template-areas: 'head' 'copy' 'scope';
			row-gap: 18px;
			padding-top: 60px;
			padding-bottom: 26px;
		}
		.copy {
			display: grid;
			padding-top: 0;
		}
		.read,
		.cap {
			grid-area: 1 / 1;
		}
		.read {
			opacity: calc(1 - var(--capin));
		}
		.sentence {
			max-width: none;
			font-size: clamp(1.3rem, 5.4vw, 1.9rem);
		}
		.label {
			margin-bottom: 10px;
			padding-bottom: 6px;
		}
		.lead {
			font-size: 2.2rem;
		}
		.body {
			font-size: 0.95rem;
			margin-top: 6px;
		}
	}
</style>
