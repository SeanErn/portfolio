<script lang="ts">
	/**
	 * U3 · FRC 5152. Sheet 1: a path-planner printout of a 15 s autonomous routine, scrubbed by scroll
	 * (field drawing, executed path, waypoint callouts, camera wedge, and a timing diagram of the
	 * subsystems). Sheet 2: the four seasons as a ledger with the career facts landing on it.
	 * The routine is illustrative; the ledger numbers come straight from content.ts.
	 */
	import Pinned from '../kit/Pinned.svelte';
	import ChapterHead from '../kit/ChapterHead.svelte';
	import { chapters, frc } from '../content';
	import { clamp, seg, ease, easeOut, lerp } from '../kit/motion';

	const ref = chapters.find((c) => c.id === 'frc')!.ref;
	/** Scale the field shrinks to when it becomes a detail on sheet 2. */
	const DETAIL = 0.5;
	let fieldH = $state(0);
	let timH = $state(0);

	const notes = [
		'Taught myself Java and WPILib, then led software for four seasons, moving up to Software Lead.',
		'Managed and trained a team of seven, so the work keeps going after I leave.',
		'Programmed the autonomous and vision systems behind 12+ awards; helped the team qualify for the FIRST World Championship twice.'
	];

	// ── Field (metres, y down; our alliance on the left) ─────────────────────────────────────────
	const FW = 16.54;
	const FH = 8.07;
	const VB = { x: -0.55, y: -1.0, w: FW + 1.1, h: FH + 1.55 };
	const pct = (x: number, y: number) => ({
		left: ((x - VB.x) / VB.w) * 100,
		top: ((y - VB.y) / VB.h) * 100
	});
	const T = { x: 4.9, y: FH / 2 }; // our scoring target
	const hex = (cx: number, cy: number, r: number) =>
		Array.from({ length: 6 }, (_, i) => {
			const a = (Math.PI / 3) * i + Math.PI / 6;
			return `${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`;
		}).join(' ');
	const pieces = [
		{ x: 7.6, y: 6.5, taken: 3.95 },
		{ x: 7.6, y: 1.6, taken: 9.55 },
		{ x: 8.27, y: FH / 2, taken: 14.55 }
	];
	const chamfer = 0.9;
	const outline = [
		[chamfer, 0],
		[FW - chamfer, 0],
		[FW, chamfer],
		[FW, FH - chamfer],
		[FW - chamfer, FH],
		[chamfer, FH],
		[0, FH - chamfer],
		[0, chamfer]
	]
		.map((p) => p.join(','))
		.join(' ');

	// ── The routine: cubic legs with times; gaps between legs are dwells ─────────────────────────
	type V = [number, number];
	type Leg = { t0: number; t1: number; p: [V, V, V, V] };
	const legs: Leg[] = [
		{ t0: 0.0, t1: 1.4, p: [[2.4, 6.7], [2.9, 6.7], [3.2, 6.0], [3.45, 5.75]] },
		{ t0: 2.0, t1: 4.0, p: [[3.45, 5.75], [4.4, 6.9], [6.6, 6.6], [7.6, 6.5]] },
		{ t0: 4.2, t1: 5.6, p: [[7.6, 6.5], [7.4, 6.0], [7.1, 5.6], [6.75, 5.45]] },
		{ t0: 7.0, t1: 9.6, p: [[6.75, 5.45], [8.0, 4.9], [8.0, 2.6], [7.6, 1.6]] },
		{ t0: 9.8, t1: 11.4, p: [[7.6, 1.6], [7.4, 2.0], [7.1, 2.45], [6.75, 2.65]] },
		{ t0: 12.8, t1: 14.6, p: [[6.75, 2.65], [7.1, 3.3], [7.2, 4.05], [7.75, 4.05]] }
	];
	const N = 48;
	const bez = (q: Leg['p'], u: number): V => {
		const a = 1 - u;
		const k = [a * a * a, 3 * a * a * u, 3 * a * u * u, u * u * u];
		return [
			k[0] * q[0][0] + k[1] * q[1][0] + k[2] * q[2][0] + k[3] * q[3][0],
			k[0] * q[0][1] + k[1] * q[1][1] + k[2] * q[2][1] + k[3] * q[3][1]
		];
	};
	const pts: V[] = [];
	const legStart: number[] = [];
	for (const leg of legs) {
		legStart.push(pts.length);
		for (let i = 0; i <= N; i++) {
			const q = bez(leg.p, i / N);
			pts.push(q);
		}
	}
	const ptStr = pts.map((q) => `${q[0].toFixed(3)} ${q[1].toFixed(3)}`);
	const pathD = 'M' + ptStr.join('L');
	/** Executed part of the path up to index-float f (rebuilt per frame; dash tricks break under non-scaling strokes). */
	const runD = (f: number, x: number, y: number) =>
		'M' + ptStr.slice(0, Math.floor(f) + 1).join('L') + `L${x.toFixed(3)} ${y.toFixed(3)}`;

	/** Pose sample at index-float f. */
	const at = (f: number) => {
		const i = clamp(Math.floor(f), 0, pts.length - 2);
		const r = clamp(f - i, 0, 1);
		const a = pts[i];
		const b = pts[i + 1];
		return {
			x: lerp(a[0], b[0], r),
			y: lerp(a[1], b[1], r),
			tan: Math.atan2(b[1] - a[1], b[0] - a[0])
		};
	};
	const indexAt = (t: number) => {
		if (t <= legs[0].t0) return 0;
		for (let k = 0; k < legs.length; k++) {
			const L = legs[k];
			if (t < L.t0) return legStart[k - 1] + N - 0.001; // dwelling at the end of the previous leg
			if (t <= L.t1) return legStart[k] + ease(seg(t, L.t0, L.t1)) * N - (k > 0 ? 0 : 0);
		}
		return pts.length - 1.001;
	};

	// Subsystem windows (seconds). Illustrative routine, not a real match log.
	const rows: { name: string; on: [number, number][] }[] = [
		{ name: 'Drive', on: [[0, 1.4], [2.0, 4.0], [4.2, 5.6], [7.0, 9.6], [9.8, 11.4], [12.8, 14.6]] },
		{ name: 'Intake', on: [[3.2, 4.2], [8.8, 9.8], [14.0, 15]] },
		{ name: 'Vision', on: [[4.6, 7.0], [10.2, 12.8]] },
		{ name: 'Align', on: [[5.6, 6.3], [11.4, 12.0]] },
		{ name: 'Score', on: [[1.4, 2.0], [6.3, 7.0], [12.0, 12.8]] }
	];
	const signal = (on: [number, number][], r: number) => {
		const hi = r + 0.22;
		const lo = r + 0.82;
		const out: string[] = [`0,${lo}`];
		for (const [a, b] of on) out.push(`${a},${lo}`, `${a},${hi}`, `${b},${hi}`, `${b},${lo}`);
		out.push(`15,${lo}`);
		return out.join(' ');
	};
	const active = (name: string, t: number) => rows.find((r) => r.name === name)!.on.some(([a, b]) => t >= a && t < b);
	/** 0..1 weight for "facing the target" (preload shot, then each vision window), with 0.45 s ramps. */
	const aimW = (t: number) =>
		Math.max(
			...[
				[0.9, 2.0],
				[4.6, 7.0],
				[10.2, 12.8]
			].map(([a, b]) => ease(seg(t, a, a + 0.45)) * (1 - ease(seg(t, b, b + 0.45))))
		);
	const lerpAngle = (a: number, b: number, w: number) => {
		let d = b - a;
		while (d > Math.PI) d -= 2 * Math.PI;
		while (d < -Math.PI) d += 2 * Math.PI;
		return a + d * w;
	};

	const end = at(pts.length - 1.001);
	const waypoints = [
		{ n: '01', t: 0, label: 'Start', x: 2.4, y: 6.7, side: 's' },
		{ n: '02', t: 1.4, label: 'Score preload', x: 3.45, y: 5.75, side: 'nw' },
		{ n: '03', t: 4.0, label: 'Intake', x: 7.6, y: 6.5, side: 'se' },
		{ n: '04', t: 4.6, label: 'Vision lock', ...xy(4.6), side: 'ne' },
		{ n: '05', t: 5.6, label: 'Align · score', x: 6.75, y: 5.45, side: 's' },
		{ n: '06', t: 9.6, label: 'Intake', x: 7.6, y: 1.6, side: 'ne' },
		{ n: '07', t: 10.2, label: 'Vision lock', ...xy(10.2), side: 'e' },
		{ n: '08', t: 11.4, label: 'Align · score', x: 6.75, y: 2.65, side: 'w' },
		{ n: '09', t: 14.6, label: 'Hold for teleop', x: end.x, y: end.y, side: 'e' }
	] as const;
	function xy(t: number) {
		const q = at(indexAt(t));
		return { x: q.x, y: q.y };
	}

	const pad2 = (n: number) => String(n).padStart(2, '0');
	const fix = (n: number) => n.toFixed(2).padStart(5, ' ');

	// ── Ledger ────────────────────────────────────────────────────────────────────────────────────
	const seasons = frc.seasons;
	const teamN = frc.stats.team;
	const awardsN = parseInt(frc.stats.awards, 10);
	const worldsN = frc.stats.worlds;

	const frame = (p: number) => {
		const t = 15 * seg(p, 0.04, 0.6);
		const fi = indexAt(t);
		const q = at(fi);
		const w = aimW(t);
		const aim = Math.atan2(T.y - q.y, T.x - q.x);
		const h = lerpAngle(q.tan, aim, w);
		const vision = active('Vision', t);
		const scoring = active('Score', t);
		const remaining = 15 - t;
		const X = ease(seg(p, 0.62, 0.69));
		const L = seg(p, 0.68, 0.96);
		const sig = ease(seg(L, 0.1, 0.55));
		const reached = waypoints.filter((wp) => t >= wp.t - 0.001).length;
		const deg = Math.round(((((-h * 180) / Math.PI) % 360) + 360) % 360);
		return {
			t,
			q,
			run: runD(fi, q.x, q.y),
			h,
			deg,
			vision,
			scoring,
			lock: vision && t > 4.9 && t < 13,
			clock: `0:${pad2(Math.ceil(remaining - 1e-6))}`,
			reached,
			X,
			L,
			axis: easeOut(seg(L, 0, 0.25)),
			sig,
			seasonsDone: Math.min(4, Math.max(0, Math.ceil(sig * 4 - 0.03))),
			cell: (i: number) => ease(seg(L, 0.3 + i * 0.1, 0.44 + i * 0.1)),
			team: Math.round(seg(L, 0.45, 0.66) * teamN),
			awards: Math.floor(seg(L, 0.55, 0.86) * awardsN),
			worlds: (L > 0.74 ? 1 : 0) + (L > 0.82 ? 1 : 0),
			note: p < 0.64 ? 2 : L < 0.4 ? 0 : L < 0.6 ? 1 : 2
		};
	};
</script>

<div class="chapter" id="frc" data-chapter="frc">
	<Pinned length={300}>
		{#snippet children(p)}
			{@const f = frame(p)}
			<div class="wrap">
				<div class="copy">
					<ChapterHead {ref} org={frc.org} role={frc.role} when={frc.when} where={frc.where} compact />
					<ol class="notes">
						{#each notes as n, i}
							<li class:on={f.note === i}><span class="mono">{pad2(i + 1)}</span><p>{n}</p></li>
						{/each}
					</ol>
				</div>

				<figure class="sheet" aria-label="Autonomous routine drawing and season ledger">
					<header class="sh-head">
						<span class="mono sh-no">Sheet {f.X < 0.5 ? 1 : 2}/2</span>
						<span class="mono sh-title">{f.X < 0.5 ? 'Autonomous routine · path 01' : 'Season ledger'}</span>
						<span class="clock" style:opacity={1 - f.X}>
							<span class="mono">Auto</span>
							<b class:live={f.t > 0 && f.t < 15}>{f.clock}</b>
						</span>
					</header>

					<div class="body">
						<!-- Sheet 1: autonomous -->
						<div class="auto" aria-hidden="true">
							<div
								class="field"
								bind:clientHeight={fieldH}
								style:transform="translateY({timH * f.X}px) scale({lerp(1, DETAIL, f.X)})"
							>
								<svg viewBox="{VB.x} {VB.y} {VB.w} {VB.h}" preserveAspectRatio="xMidYMid meet">
									<defs>
										<pattern id="frc-grid" width="1" height="1" patternUnits="userSpaceOnUse">
											<circle cx="0" cy="0" r="0.025" class="gdot" />
										</pattern>
									</defs>
									<rect x="0" y="0" width={FW} height={FH} fill="url(#frc-grid)" />
									<polygon points={outline} class="edge" />
									<line x1={FW / 2} y1="0" x2={FW / 2} y2={FH} class="dash" />
									<line x1="3.0" y1="0" x2="3.0" y2={FH} class="thin" />
									<line x1={FW - 3.0} y1="0" x2={FW - 3.0} y2={FH} class="thin dim" />
									<!-- targets -->
									<polygon points={hex(T.x, T.y, 0.62)} class="target" />
									<polygon points={hex(T.x, T.y, 0.3)} class="thin" />
									<polygon points={hex(FW - T.x, T.y, 0.62)} class="target dim" />
									<polygon points={hex(FW - T.x, T.y, 0.3)} class="thin dim" />
									<!-- pieces -->
									{#each pieces as pc}
										<circle cx={pc.x} cy={pc.y} r="0.18" class="piece" style:opacity={f.t >= pc.taken ? 0.18 : 1} />
										<circle cx={FW - pc.x} cy={pc.y} r="0.18" class="piece dim" />
									{/each}
									<!-- dimensions -->
									<g class="dim-lines">
										<line x1="0" y1="-0.55" x2={FW} y2="-0.55" class="thin" />
										<line x1="0" y1="-0.75" x2="0" y2="-0.2" class="thin" />
										<line x1={FW} y1="-0.75" x2={FW} y2="-0.2" class="thin" />
										<line x1="0" y1="-0.55" x2="3.0" y2="-0.55" class="thin" />
										<line x1="3.0" y1="-0.75" x2="3.0" y2="-0.2" class="thin" />
									</g>
									<!-- path: plan, then executed -->
									<path d={pathD} class="plan" />
									<path d={f.run} class="run" />
									{#each waypoints as wp, i}
										{#if i < f.reached}
											<circle cx={wp.x} cy={wp.y} r="0.16" class="wp" class:cur={i === f.reached - 1} />
										{/if}
									{/each}
									<!-- line of sight + shot -->
									{#if f.lock}
										<line x1={f.q.x} y1={f.q.y} x2={T.x} y2={T.y} class="los" />
										<g class="lock">
											<path
												d="M{T.x - 0.9} {T.y - 0.55}v-0.35h0.35 M{T.x + 0.55} {T.y - 0.9}h0.35v0.35 M{T.x + 0.9} {T.y +
													0.55}v0.35h-0.35 M{T.x - 0.55} {T.y + 0.9}h-0.35v-0.35"
											/>
										</g>
									{/if}
									{#if f.scoring}
										<line x1={f.q.x} y1={f.q.y} x2={T.x} y2={T.y} class="shot" />
									{/if}
									<!-- robot -->
									<g transform="translate({f.q.x} {f.q.y}) rotate({(f.h * 180) / Math.PI})">
										{#if f.vision}
											<polygon points="0.47,0 3.1,-1.55 3.1,1.55" class="fov" />
										{/if}
										<rect x="-0.47" y="-0.47" width="0.94" height="0.94" class="bumper" />
										<rect x="-0.36" y="-0.36" width="0.72" height="0.72" class="thin" />
										{#each [[-1, -1], [1, -1], [1, 1], [-1, 1]] as [sx, sy]}
											<rect x={sx * 0.24 - 0.08} y={sy * 0.24 - 0.08} width="0.16" height="0.16" class="module" />
										{/each}
										<path d="M0.12 -0.16 L0.34 0 L0.12 0.16" class="nose" />
									</g>
								</svg>
								<div class="ovl" style:opacity={1 - ease(seg(f.X, 0, 0.5))}>
								<span class="mono dimtxt" style:left="{pct(FW / 2, 0).left}%" style:top="{pct(0, -0.55).top}%">≈16.5 m</span>
								<span class="mono dimtxt small" style:left="{pct(1.5, 0).left}%" style:top="{pct(0, -0.55).top}%">3.0</span>
								<span class="mono fieldtag" style:left="{pct(0.2, 0).left}%" style:top="{pct(0, FH).top}%">Alliance wall</span>
								{#each waypoints as wp, i}
									{#if i < f.reached}
										{@const pos = pct(wp.x, wp.y)}
										<div
											class="wpl {wp.side}"
											class:recent={i >= f.reached - 3}
											class:cur={i === f.reached - 1}
											style:left="{pos.left}%"
											style:top="{pos.top}%"
										>
											<span class="mono"><b>{wp.n}</b><em>{wp.label}</em><i>T+{wp.t.toFixed(1)}</i></span>
										</div>
									{/if}
								{/each}
								</div>
							</div>

							<div class="timing" bind:offsetHeight={timH} style:opacity={1 - f.X}>
								<ul class="names mono">
									{#each rows as r}
										<li class:hi={active(r.name, f.t)}>{r.name}</li>
									{/each}
								</ul>
								<div class="plot">
									<svg viewBox="0 0 15 {rows.length}" preserveAspectRatio="none">
										<defs>
											<clipPath id="frc-clip"><rect x="0" y="0" width={f.t} height={rows.length} /></clipPath>
										</defs>
										{#each Array(16) as _, s}
											<line x1={s} y1="0" x2={s} y2={rows.length} class="tick" class:major={s % 5 === 0} />
										{/each}
										{#each rows as r, i}
											<polyline points={signal(r.on, i)} class="sig future" />
										{/each}
										<g clip-path="url(#frc-clip)">
											{#each rows as r, i}
												<polyline points={signal(r.on, i)} class="sig past" />
											{/each}
										</g>
										<line x1={f.t} y1="0" x2={f.t} y2={rows.length} class="playhead" />
									</svg>
									<div class="secs mono">
										{#each [0, 5, 10, 15] as s}
											<span style:left="{(s / 15) * 100}%">{s}s</span>
										{/each}
									</div>
								</div>
							</div>
						</div>

						<!-- Sheet 2: ledger -->
						<div
							class="ledger"
							style:opacity={f.X}
							style:transform="translateY({14 * (1 - f.X)}px)"
							style:visibility={f.X > 0.001 ? 'visible' : 'hidden'}
						>
							<div class="timeline">
								<div class="cols">
									{#each seasons as s, i}
										<div class="col" class:done={f.seasonsDone > i} style:opacity={ease(seg(f.axis, i * 0.2, i * 0.2 + 0.4))}>
											<span class="mono">Season {pad2(i + 1)}</span>
											<b>{s}</b>
										</div>
									{/each}
								</div>
								<div class="track">
									<span class="mono lane">Software</span>
									<div class="lanebox">
										<svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
											<line x1="0" y1="9" x2={100 * f.axis} y2="9" class="base" />
											<defs>
												<clipPath id="frc-lane"><rect x="-1" y="-5" width={101 * f.sig} height="20" /></clipPath>
											</defs>
											<polyline points="0,9 1.2,9 1.2,2 100,2" class="sw" clip-path="url(#frc-lane)" />
										</svg>
										{#each [0, 1, 2, 3, 4] as b}
											<i class="via" class:lit={f.sig * 100 >= b * 25 - 0.5 && f.sig > 0} style:left="{b * 25}%"></i>
										{/each}
									</div>
								</div>
								<div class="ends mono">
									<span style:opacity={ease(seg(f.L, 0.08, 0.2))}>{frc.when.split('–')[0].trim()} · taught myself Java + WPILib</span>
									<span class="lead" style:opacity={ease(seg(f.L, 0.5, 0.6))}>{frc.when.split('–')[1].trim()} · {frc.role}</span>
								</div>
							</div>

							<p class="mono detail-cap" style:bottom="{fieldH * DETAIL + 6}px" style:opacity={ease(seg(f.L, 0.02, 0.15))}>Detail A · sheet 1, half scale</p>
							<dl class="stats">
								<div style:opacity={f.cell(0)}>
									<dt class="mono">Seasons led</dt>
									<dd><b>{f.seasonsDone}</b></dd>
									<p class="mono cap">2023 – 2026 game years</p>
								</div>
								<div style:opacity={f.cell(1)}>
									<dt class="mono">Team trained</dt>
									<dd><b>{f.team}</b></dd>
									<p class="marks">
										{#each Array(teamN) as _, i}<i class="sq" class:on={i < f.team}></i>{/each}
									</p>
								</div>
								<div style:opacity={f.cell(2)}>
									<dt class="mono">Awards</dt>
									<dd><b>{f.awards}{f.awards >= awardsN ? '+' : ''}</b></dd>
									<p class="marks">
										{#each Array(awardsN) as _, i}<i class="tk" class:on={i < f.awards}></i>{/each}
									</p>
								</div>
								<div style:opacity={f.cell(3)}>
									<dt class="mono">Worlds qualifications</dt>
									<dd><b>×{f.worlds}</b></dd>
									<p class="marks">
										{#each Array(worldsN) as _, i}<i class="dia" class:on={i < f.worlds}></i>{/each}
										<span class="mono cap">FIRST Championship</span>
									</p>
								</div>
							</dl>
							<ol class="mono dwg-notes" style:opacity={ease(seg(f.L, 0.86, 1))}>
								<li>Routine on sheet 1 is illustrative, not a match log.</li>
								<li>Awards and qualifications are career totals, not assigned to seasons.</li>
								<li>Field drawn generic. Not to scale.</li>
							</ol>
						</div>
					</div>

					<footer class="tblock mono">
						<span>Team 5152 · software</span>
						<span>Java · WPILib</span>
						<span class="opt">Units m, s</span>
						<span class="opt">Scale NTS</span>
						<span>Dwg {f.X < 0.5 ? 'AUTO-01' : 'LEDGER'}</span>
					</footer>
				</figure>
			</div>
		{/snippet}
	</Pinned>
</div>

<style>
	.wrap {
		height: 100%;
		display: grid;
		grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
		align-items: center;
		gap: clamp(28px, 4vw, 64px);
		padding: 72px var(--gutter) 28px var(--rail);
	}

	/* ── copy ── */
	.notes {
		list-style: none;
		margin: 28px 0 0;
		padding: 0;
		display: grid;
		gap: 14px;
	}
	.notes li {
		display: grid;
		grid-template-columns: 26px 1fr;
		gap: 8px;
		color: var(--ink-2);
		font-size: 15px;
		line-height: 1.4;
		transition: color 0.3s;
	}
	.notes li .mono {
		font-size: 10px;
		padding-top: 3px;
		color: var(--ink-2);
	}
	.notes li.on {
		color: var(--ink);
	}
	.notes li.on .mono {
		color: var(--accent);
	}

	/* ── sheet frame ── */
	.sheet {
		margin: 0;
		justify-self: end;
		width: min(100%, calc((100svh - 330px) * 1.83));
		container: frc-sheet / inline-size;
		border: 1px solid var(--ink);
		background: var(--paper);
		display: grid;
	}
	.sh-head {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 8px 14px;
		border-bottom: 1px solid var(--ink);
		min-height: 48px;
	}
	.sh-no {
		color: var(--ink-2);
		font-size: 11px;
	}
	.sh-title {
		font-size: 11px;
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.clock {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
	}
	.clock .mono {
		font-size: 10px;
		color: var(--ink-2);
	}
	.clock b {
		font-size: 30px;
		line-height: 1;
		font-weight: 760;
		font-stretch: 62%;
		font-variant-numeric: tabular-nums;
	}
	.clock b.live {
		color: var(--accent);
	}

	.body {
		position: relative;
		padding: 10px 14px 12px;
	}

	/* ── field ── */
	.field {
		position: relative;
		aspect-ratio: 17.64 / 9.62;
		transform-origin: 100% 100%;
	}
	.ovl {
		position: absolute;
		inset: 0;
	}
	.field svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.field svg :global(*) {
		vector-effect: non-scaling-stroke;
	}
	.gdot {
		fill: var(--ink-2);
		opacity: 0.55;
	}
	.edge,
	.thin,
	.dash,
	.target,
	.piece,
	.plan,
	.run,
	.wp,
	.los,
	.shot,
	.fov,
	.bumper,
	.module,
	.nose,
	.lock path {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1;
	}
	.edge {
		stroke-width: 1.5;
	}
	.dash {
		stroke-dasharray: 6 4;
		stroke: var(--ink-2);
	}
	.thin {
		stroke-width: 0.75;
		stroke: var(--ink-2);
	}
	.dim {
		opacity: 0.35;
	}
	.target {
		stroke-width: 1.25;
		fill: var(--paper-2);
	}
	.piece {
		fill: var(--paper);
	}
	.plan {
		stroke: var(--ink-2);
		stroke-dasharray: 2 4;
	}
	.run {
		stroke: var(--accent);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.wp {
		fill: var(--paper);
		stroke-width: 1;
	}
	.wp.cur {
		stroke: var(--accent);
		stroke-width: 1.5;
	}
	.los {
		stroke: var(--accent);
		stroke-dasharray: 3 3;
	}
	.shot {
		stroke: var(--accent);
		stroke-width: 2;
	}
	.lock path {
		stroke: var(--accent);
		stroke-width: 1.5;
	}
	.fov {
		stroke: var(--accent);
		stroke-dasharray: 4 3;
		fill: var(--accent);
		fill-opacity: 0.07;
	}
	.bumper {
		fill: var(--paper);
		stroke-width: 1.5;
	}
	.module {
		fill: var(--ink);
		stroke: none;
	}
	.nose {
		stroke: var(--accent);
		stroke-width: 1.5;
	}

	.dimtxt,
	.fieldtag {
		position: absolute;
		translate: -50% -50%;
		font-size: 10px;
		background: var(--paper);
		padding: 0 6px;
		color: var(--ink-2);
		white-space: nowrap;
	}
	.dimtxt.small {
		padding: 0 3px;
	}
	.fieldtag {
		translate: 0 6px;
		font-size: 9px;
		background: none;
		padding: 0;
	}

	.wpl {
		position: absolute;
		width: 0;
		height: 0;
		pointer-events: none;
	}
	.wpl > span {
		position: absolute;
		display: flex;
		align-items: baseline;
		gap: 6px;
		white-space: nowrap;
		font-size: 10px;
		line-height: 16px;
		background: var(--paper);
		padding: 0 4px;
		border-left: 1px solid var(--ink);
	}
	.wpl b {
		font-weight: 500;
	}
	.wpl em {
		font-style: normal;
	}
	.wpl i {
		font-style: normal;
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
	}
	.wpl:not(.recent) em,
	.wpl:not(.recent) i {
		display: none;
	}
	.wpl:not(.recent) > span {
		color: var(--ink-2);
		border-left-color: var(--rule);
	}
	.wpl.cur > span {
		border-left: 2px solid var(--accent);
	}
	.wpl.cur b {
		color: var(--accent);
	}
	.wpl.e > span {
		left: 26px;
		top: -8px;
	}
	.wpl.w > span {
		right: 38px;
		top: -8px;
	}
	.wpl.ne > span {
		left: 14px;
		bottom: 14px;
	}
	.wpl.nw > span {
		right: 14px;
		bottom: 14px;
	}
	.wpl.se > span {
		left: 14px;
		top: 14px;
	}
	.wpl.sw > span {
		right: 14px;
		top: 14px;
	}
	.wpl.s > span {
		left: -16px;
		top: 34px;
	}
	.wpl.n > span {
		left: -16px;
		bottom: 34px;
	}

	/* ── timing diagram ── */
	.timing {
		display: grid;
		grid-template-columns: 58px 1fr;
		position: relative;
		padding-top: 20px;
		--row: 17px;
	}
	.timing::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 12px;
		border-top: 1px solid var(--rule);
	}
	.names {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.names li {
		height: var(--row);
		line-height: var(--row);
		font-size: 9.5px;
		color: var(--ink-2);
	}
	.names li.hi {
		color: var(--accent);
	}
	.plot {
		position: relative;
		padding-bottom: 16px;
	}
	.plot svg {
		display: block;
		width: 100%;
		height: calc(var(--row) * 5);
		overflow: visible;
	}
	.plot svg :global(*) {
		vector-effect: non-scaling-stroke;
	}
	.tick {
		stroke: var(--rule);
		stroke-width: 1;
	}
	.tick.major {
		stroke: var(--ink-2);
		stroke-opacity: 0.5;
	}
	.sig {
		fill: none;
		stroke-width: 1.25;
		stroke-linejoin: miter;
	}
	.sig.future {
		stroke: var(--ink-2);
		stroke-opacity: 0.35;
	}
	.sig.past {
		stroke: var(--ink);
	}
	.playhead {
		stroke: var(--accent);
		stroke-width: 1.5;
	}
	.secs {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 14px;
	}
	.secs span {
		position: absolute;
		translate: -50% 0;
		font-size: 9px;
		color: var(--ink-2);
	}
	.secs span:first-child {
		translate: 0 0;
	}
	.secs span:last-child {
		translate: -100% 0;
	}

	/* ── ledger ── */
	.ledger {
		position: absolute;
		inset: 10px 14px 12px;
		display: grid;
		grid-template-rows: auto auto 1fr;
		align-content: start;
		gap: 22px;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin-left: 70px;
	}
	.col {
		display: grid;
		gap: 2px;
		padding: 0 0 8px 10px;
		border-left: 1px solid var(--rule);
	}
	.col .mono {
		font-size: 9.5px;
		color: var(--ink-2);
	}
	.col b {
		font-size: clamp(2rem, 4.2vw, 3.6rem);
		line-height: 0.9;
		font-weight: 800;
		font-stretch: 62%;
		font-variant-numeric: tabular-nums;
		color: var(--ink-2);
		transition: color 0.2s;
	}
	.col.done b {
		color: var(--ink);
	}
	.track {
		display: grid;
		grid-template-columns: 70px 1fr;
		align-items: center;
	}
	.lane {
		font-size: 9.5px;
		color: var(--ink-2);
	}
	.lanebox {
		position: relative;
		height: 34px;
	}
	.lanebox svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.lanebox svg :global(*) {
		vector-effect: non-scaling-stroke;
	}
	.base {
		stroke: var(--ink-2);
		stroke-opacity: 0.4;
		stroke-dasharray: 2 3;
	}
	.sw {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
	}
	.via {
		position: absolute;
		top: calc(20% - 5px);
		width: 10px;
		height: 10px;
		margin-left: -5px;
		border-radius: 50%;
		border: 1.5px solid var(--ink-2);
		background: var(--paper);
	}
	.via.lit {
		border: 2.5px solid var(--accent);
	}
	.ends {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		margin: 8px 0 0 70px;
		font-size: 10px;
		color: var(--ink-2);
	}
	.ends .lead {
		color: var(--ink);
		text-align: right;
	}

	.stats {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border-top: 1px solid var(--ink);
	}
	.dwg-notes {
		position: absolute;
		left: 0;
		bottom: 0;
		width: calc(50% - 40px);
		margin: 0;
		padding: 0 0 0 16px;
		font-size: 9.5px;
		line-height: 1.5;
		color: var(--ink-2);
		display: grid;
		gap: 4px;
	}
	.detail-cap {
		position: absolute;
		right: 0;
		font-size: 9.5px;
		color: var(--ink-2);
	}
	.stats > div {
		display: grid;
		align-content: start;
		gap: 6px;
		padding: 12px 12px 4px 14px;
		border-left: 1px solid var(--rule);
	}
	.stats > div:first-child {
		padding-left: 0;
		border-left: 0;
	}
	.stats dt {
		font-size: 9.5px;
		color: var(--ink-2);
	}
	.stats dd {
		margin: 0;
	}
	.stats dd b {
		font-size: clamp(2.6rem, 5.4vw, 4.6rem);
		line-height: 0.88;
		font-weight: 800;
		font-stretch: 62%;
		font-variant-numeric: tabular-nums;
	}
	.cap {
		font-size: 9px;
		color: var(--ink-2);
	}
	.marks {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		min-height: 14px;
	}
	.sq {
		width: 9px;
		height: 9px;
		border: 1px solid var(--ink);
	}
	.sq.on {
		background: var(--ink);
	}
	.tk {
		width: 2px;
		height: 12px;
		background: var(--rule);
	}
	.tk.on {
		background: var(--ink);
	}
	.dia {
		width: 9px;
		height: 9px;
		rotate: 45deg;
		border: 1.5px solid var(--ink-2);
		margin: 0 3px;
	}
	.dia.on {
		border-color: var(--accent);
		background: var(--accent);
	}
	.marks .cap {
		margin-left: 6px;
	}

	.tblock {
		display: flex;
		border-top: 1px solid var(--ink);
		font-size: 9.5px;
		color: var(--ink-2);
	}
	.tblock span {
		flex: 1;
		padding: 7px 10px;
		border-left: 1px solid var(--rule);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tblock span:first-child {
		border-left: 0;
		color: var(--ink);
	}

	/* ── narrow ── */
	@media (max-width: 900px) {
		.wrap {
			grid-template-columns: 1fr;
			align-content: center;
			gap: 20px;
			padding-top: 60px;
		}
		.copy {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
			gap: 24px;
			align-items: end;
		}
		.notes {
			margin: 0;
		}
		.sheet {
			justify-self: center;
			width: min(100%, calc((100svh - 470px) * 1.83));
		}
	}
	@media (max-width: 700px) {
		.wrap {
			gap: 14px;
			padding-top: 52px;
			padding-bottom: 12px;
		}
		.copy {
			grid-template-columns: 1fr;
			gap: 12px;
		}
		.notes {
			gap: 6px;
		}
		.notes li {
			font-size: 12.5px;
			grid-template-columns: 20px 1fr;
			gap: 4px;
		}
		.sh-head {
			min-height: 38px;
			padding: 4px 10px;
			gap: 10px;
		}
		.sh-no {
			display: none;
		}
		.clock b {
			font-size: 24px;
		}
		.body {
			padding: 6px 8px 8px;
		}
		.dimtxt.small,
		.fieldtag {
			display: none;
		}
		.wpl:not(.cur) {
			display: none;
		}
		.ovl .wpl > span {
			font-size: 9px;
			line-height: 14px;
			left: 10px;
			right: auto;
			top: auto;
			bottom: 10px;
		}
		.timing {
			grid-template-columns: 44px 1fr;
			--row: 12px;
			padding-top: 12px;
		}
		.timing::before {
			top: 6px;
		}
		.names li {
			font-size: 8px;
		}
		.ledger {
			inset: 6px 8px 8px;
			gap: 8px;
		}
		.tblock .opt {
			display: none;
		}
		.tblock {
			font-size: 8.5px;
		}
		.tblock span {
			padding: 5px 8px;
		}
	}
	@container frc-sheet (max-width: 660px) {
		.ledger {
			grid-template-rows: auto 1fr;
			gap: 10px;
		}
		.cols,
		.ends {
			margin-left: 0;
		}
		.track {
			grid-template-columns: 1fr;
		}
		.lane {
			display: none;
		}
		.lanebox {
			height: 22px;
		}
		.col {
			padding: 0 0 4px 6px;
		}
		.col .mono {
			font-size: 8px;
		}
		.col b {
			font-size: clamp(1.6rem, 7cqi, 2.6rem);
		}
		.ends {
			font-size: 8.5px;
			margin-top: 4px;
		}
		.stats {
			grid-template-columns: repeat(2, 1fr);
			width: calc(50% - 10px);
			align-self: end;
			border-top: 0;
		}
		.stats > div {
			padding: 5px 6px 6px 0;
			gap: 3px;
			border-left: 0;
			border-top: 1px solid var(--ink);
		}
		.stats > div:nth-child(even) {
			padding-left: 6px;
			border-left: 1px solid var(--rule);
		}
		.dwg-notes {
			display: none;
		}
		.detail-cap {
			font-size: 8px;
		}
		.stats dt {
			font-size: 8px;
			line-height: 1.2;
			min-height: 2.4em;
		}
		.stats dd b {
			font-size: clamp(2rem, 8.5cqi, 3.2rem);
		}
		.stats .cap {
			display: none;
		}
		.sq {
			width: 6px;
			height: 6px;
		}
		.tk {
			height: 8px;
		}
		.marks {
			gap: 3px;
		}
	}
</style>
