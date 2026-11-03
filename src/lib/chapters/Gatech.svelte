<script lang="ts">
	/**
	 * U6 — Georgia Tech. The degree flown as a propulsive-lander descent, drawn as line art.
	 * Altitude is time: the axis runs from launch (Jun 2026) to touchdown (expected 2030).
	 * The vehicle is purely illustrative; it is not any real team's vehicle.
	 */
	import Pinned from '../kit/Pinned.svelte';
	import ChapterHead from '../kit/ChapterHead.svelte';
	import { seg, lerp, ease, clamp } from '../kit/motion';
	import { chapters, gatech as data } from '../content';

	const ref = chapters.find((c) => c.id === 'gatech')!.ref;

	// ---- scene geometry (viewBox units) ----
	const VW = 480;
	const VH = 640;
	const AXIS_X = 64;
	const TOP = 204; // feet y at launch
	const PAD_TOP = 584; // feet y at touchdown
	const GROUND = 592;
	const PAD_X = 318;
	const PAD_W = 150;
	const LAND = 0.84; // p at touchdown

	type Pt = [number, number];
	// feet path: vertical start, divert right, vertical final approach onto the pad
	const P: Pt[] = [
		[196, TOP],
		[196, 350],
		[PAD_X, 400],
		[PAD_X, PAD_TOP]
	];
	const mix = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
	/** de Casteljau: point at u plus the control points of the [0, u] piece. */
	function split(u: number) {
		const a = mix(P[0], P[1], u),
			b = mix(P[1], P[2], u),
			c = mix(P[2], P[3], u);
		const d = mix(a, b, u),
			e = mix(b, c, u);
		const f = mix(d, e, u);
		return { at: f, head: [P[0], a, d, f] as Pt[], tan: [e[0] - d[0], e[1] - d[1]] as Pt };
	}
	const pathD = (q: Pt[]) =>
		`M${q[0][0]} ${q[0][1]} C${q[1][0]} ${q[1][1]} ${q[2][0]} ${q[2][1]} ${q[3][0]} ${q[3][1]}`;
	const planned = pathD(P);

	const years = ['2026', '2027', '2028', '2029', '2030'];
	const yearY = (i: number) => lerp(TOP, PAD_TOP, i / (years.length - 1));
	const minor = Array.from({ length: 17 }, (_, i) => lerp(TOP, PAD_TOP, i / 16));
	const hatch = Array.from({ length: 30 }, (_, i) => 70 + i * 14);

	// leg: hinge at (16, -34), length 40; angle swings from stowed (up) to deployed (foot on y = 0)
	const LEG = 40;
	const STOW = (-88 * Math.PI) / 180;
	const DEPLOY = Math.asin(34 / LEG);
	const SC = 1.35; // vehicle drawing scale

	function frame(p: number) {
		const t = seg(p, 0, LAND);
		const s = t * (1.3 - 0.3 * t); // steady descent, slowing for the landing
		const { at, head, tan } = split(s);
		const speed = Math.hypot(tan[0], tan[1]) || 1;
		const tilt = clamp((tan[0] / speed) * 40, -16, 16) * (1 - ease(seg(t, 0.82, 1)));
		const legs = ease(seg(p, 0.5, 0.63));
		const ang = lerp(STOW, DEPLOY, legs);
		const foot: Pt = [16 + LEG * Math.cos(ang), -34 + LEG * Math.sin(ang)];
		const landed = p >= LAND;
		const thr = landed
			? 0
			: 0.58 + 0.34 * ease(seg(p, 0.28, 0.55)) - 0.38 * ease(seg(p, 0.68, LAND - 0.01));
		// deterministic flicker: a function of p, not of time
		const flick = 1 + 0.07 * Math.sin(p * 780) + 0.04 * Math.sin(p * 2310 + 1);
		const plume = thr * 104 * flick;
		const alt = 1 - s;
		const months = Math.round(t * 48);
		const phase = landed
			? 'Touchdown'
			: p < 0.5
				? 'Powered descent'
				: p < 0.63
					? 'Leg deploy'
					: 'Landing burn';
		const spray = landed ? 0 : clamp((plume * SC - (PAD_TOP - at[1]) + 14) / 60);
		return {
			x: at[0],
			y: at[1],
			tilt,
			legs,
			foot,
			thr,
			plume,
			alt,
			months,
			phase,
			landed,
			spray,
			flown: pathD(head),
			settle: ease(seg(p, LAND, LAND + 0.06))
		};
	}

	const pad2 = (n: number) => String(n).padStart(2, '0');
	const pct = (v: number) => String(Math.round(v * 100)).padStart(3, '0');
</script>

<div class="chapter" id="gatech" data-chapter="gatech">
	<Pinned length={240}>
		{#snippet children(p)}
			{@const f = frame(p)}
			<div class="wrap">
				<div class="head">
					<ChapterHead {ref} org={data.short} role={data.degree} when={data.when} where="Atlanta, GA" compact />
				</div>

				<div class="tlm">
					<dl class="read">
						<div>
							<dt class="mono">T+</dt>
							<dd><b>{Math.floor(f.months / 12)}</b>y <b>{pad2(f.months % 12)}</b>m</dd>
						</div>
						<div>
							<dt class="mono">Alt</dt>
							<dd><b>{pct(f.alt)}</b>%</dd>
						</div>
						<div>
							<dt class="mono">Thr</dt>
							<dd><b>{pct(f.thr)}</b>%</dd>
						</div>
						<div class="phase" class:on={f.landed}>
							<dt class="mono">Phase</dt>
							<dd class="mono">{f.phase}</dd>
						</div>
					</dl>

					<div class="ch">
						<p class="mono lab"><span>CH1 · GPA</span><span class="ok"><i></i>Nominal</span></p>
						<div class="strip">
							<svg viewBox="0 0 200 36" preserveAspectRatio="none" aria-hidden="true">
								<line class="lim" x1="0" y1="6" x2="200" y2="6" />
								<line class="grid" x1="0" y1="21" x2="200" y2="21" />
								<line class="grid" x1="0" y1="35.5" x2="200" y2="35.5" />
								<line class="sig" x1="0" y1="6" x2={Math.max(0.5, seg(p, 0, LAND) * 200)} y2="6" />
							</svg>
							<span class="mono val">{data.gpa}<small> / 4.0</small></span>
						</div>
					</div>

					<div class="list">
						<p class="mono lab">Coursework · checklist</p>
						<ul>
							{#each data.coursework as c, i}
								<li class:go={p >= 0.06 + i * 0.08}>
									<span class="box" aria-hidden="true"></span>{c}<span class="mono st"
										>{p >= 0.06 + i * 0.08 ? 'Go' : '—'}</span
									>
								</li>
							{/each}
						</ul>
					</div>

					<div class="list">
						<p class="mono lab">Crew</p>
						<ul class="crew">
							{#each data.teams as t}
								<li>{t}</li>
							{/each}
						</ul>
					</div>
				</div>

				<figure class="scene">
					<svg viewBox="0 0 {VW} {VH}" preserveAspectRatio="xMidYMax meet" aria-label="A lander descending onto a pad, from Jun 2026 to touchdown in 2030">
						<defs>
							<clipPath id="u6-sky"><rect x="0" y="0" width={VW} height={PAD_TOP} /></clipPath>
						</defs>

						<!-- time / altitude axis -->
						<line class="ax" x1={AXIS_X} y1={TOP - 20} x2={AXIS_X} y2={GROUND} />
						{#each minor as y}
							<line class="tick" x1={AXIS_X - 4} y1={y} x2={AXIS_X} y2={y} />
						{/each}
						{#each years as yr, i}
							<line class="ax" x1={AXIS_X - 10} y1={yearY(i)} x2={AXIS_X} y2={yearY(i)} />
							<text class="yr" x={AXIS_X - 14} y={yearY(i) + 3.5} text-anchor="end">{yr}</text>
						{/each}
						<path class="ptr" d="M{AXIS_X + 3} {f.y} l9 -5 v10 z" />

						<!-- trajectory: plan dashed, flown in copper -->
						<path class="plan" d={planned} />
						<path class="flown" d={f.flown} />

						<!-- ground + pad -->
						<line class="gnd" x1={AXIS_X} y1={GROUND} x2={VW - 8} y2={GROUND} />
						{#each hatch as hx}
							<line class="hatch" x1={hx} y1={GROUND} x2={hx - 9} y2={GROUND + 9} />
						{/each}
						<rect class="pad" x={PAD_X - PAD_W / 2} y={PAD_TOP} width={PAD_W} height={GROUND - PAD_TOP} />
						<line class="cl" x1={PAD_X} y1={PAD_TOP - 14} x2={PAD_X} y2={GROUND + 14} />
						<rect class="lamp" class:on={f.landed} x={PAD_X - PAD_W / 2 + 4} y={PAD_TOP - 5} width="7" height="5" />
						<rect class="lamp" class:on={f.landed} x={PAD_X + PAD_W / 2 - 11} y={PAD_TOP - 5} width="7" height="5" />
						<text class="cap" x={PAD_X} y={GROUND + 28} text-anchor="middle">Touchdown · expected 2030</text>

						<!-- ground spray when the plume reaches the pad -->
						{#if f.spray > 0}
							<g class="spray" style:opacity={f.spray}>
								{#each [1, 2, 3] as k}
									<line x1={f.x + 16 + k * 8} y1={PAD_TOP - k * 3} x2={f.x + 16 + k * 8 + 40 * f.spray} y2={PAD_TOP - k * 5} />
									<line x1={f.x - 16 - k * 8} y1={PAD_TOP - k * 3} x2={f.x - 16 - k * 8 - 40 * f.spray} y2={PAD_TOP - k * 5} />
								{/each}
							</g>
						{/if}

						<!-- plume (clipped at the pad surface) -->
						{#if f.plume > 1}
							<g clip-path="url(#u6-sky)">
								<g class="plume" transform="translate({f.x} {f.y}) rotate({f.tilt}) scale({SC})">
									<path
										d="M-9 -10 Q-13 {-10 + f.plume * 0.42} 0 {-10 + f.plume} Q13 {-10 + f.plume * 0.42} 9 -10"
									/>
									<path d="M-4.5 -10 L0 {-10 + f.plume * 0.6} L4.5 -10" />
									{#each [0.2, 0.38] as k}
										<path
											d="M0 {-10 + f.plume * k - 4} l3.5 4 l-3.5 4 l-3.5 -4 z"
										/>
									{/each}
								</g>
							</g>
						{/if}

						<!-- vehicle -->
						<g class="lander" transform="translate({f.x} {f.y}) rotate({f.tilt}) scale({SC})">
							{#each [1, -1] as side}
								<g transform="scale({side} 1)">
									<line x1="15" y1="-34" x2={f.foot[0]} y2={f.foot[1]} />
									<line class="thin" x1="15" y1="-56" x2={lerp(17, f.foot[0], 0.55)} y2={lerp(-56, f.foot[1], 0.55)} style:opacity={seg(f.legs, 0.6, 1)} />
									<line x1={f.foot[0] - 5} y1={f.foot[1]} x2={f.foot[0] + 5} y2={f.foot[1]} style:opacity={seg(f.legs, 0.85, 1)} />
								</g>
							{/each}
							<path class="body" d="M-15 -88 Q0 -106 15 -88 L15 -38 L-15 -38 Z" />
							<line class="thin" x1="-15" y1="-74" x2="15" y2="-74" />
							<line class="thin" x1="-15" y1="-50" x2="15" y2="-50" />
							<line class="thin" x1="0" y1="-99" x2="0" y2="-112" />
							<text class="tag" x="0" y="-59" text-anchor="middle">U6</text>
							<path class="body" d="M-15 -38 L-10 -28 L10 -28 L15 -38" />
							<path class="body" d="M-4.5 -28 L-9 -10 L9 -10 L4.5 -28 Z" />
						</g>

						<!-- altitude dimension -->
						{#if f.alt > 0.07}
							<g class="dim">
								<line x1={f.x + 64} y1={f.y} x2={f.x + 64} y2={PAD_TOP} />
								<path d="M{f.x + 64} {f.y} l-3 7 h6 z M{f.x + 64} {PAD_TOP} l-3 -7 h6 z" />
								<line class="ext" x1={f.x + 54} y1={f.y} x2={f.x + 70} y2={f.y} />
								<text x={f.x + 72} y={(f.y + PAD_TOP) / 2 + 3.5}>ALT {pct(f.alt)}%</text>
							</g>
						{/if}
					</svg>
				</figure>
			</div>
		{/snippet}
	</Pinned>
</div>

<style>
	.wrap {
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
		grid-template-rows: auto 1fr;
		column-gap: clamp(24px, 4vw, 64px);
		padding: 80px var(--gutter) 28px var(--rail);
	}
	.head {
		grid-column: 1;
		grid-row: 1;
	}
	.tlm {
		grid-column: 1;
		grid-row: 2;
		align-self: end;
		display: grid;
		gap: 22px;
		max-width: 520px;
		padding-bottom: 12px;
	}
	.scene {
		grid-column: 2;
		grid-row: 1 / 3;
		margin: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}
	.scene svg {
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: visible;
	}

	/* ---- telemetry ---- */
	.lab {
		display: flex;
		justify-content: space-between;
		color: var(--ink-2);
		font-size: 10.5px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--ink);
		margin-bottom: 8px;
	}
	.read {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(3, auto) 1fr;
		border-top: 1px solid var(--ink);
		border-bottom: 1px solid var(--rule);
	}
	.read > div {
		padding: 8px 18px 10px 0;
		margin-right: 18px;
		border-right: 1px solid var(--rule);
	}
	.read > div:last-child {
		border-right: 0;
		margin-right: 0;
	}
	dt {
		color: var(--ink-2);
		font-size: 10px;
	}
	dd {
		margin: 2px 0 0;
		font-family: var(--mono);
		font-size: 13px;
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	dd b {
		font-family: var(--sans);
		font-stretch: 62%;
		font-weight: 760;
		font-size: 2rem;
		line-height: 1;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.phase dd {
		font-size: 12px;
		color: var(--ink);
		padding-top: 10px;
	}
	.phase.on dd {
		color: var(--accent);
	}

	.ok {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--ink);
	}
	.ok i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
	}
	.strip {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 16px;
	}
	.strip svg {
		width: 100%;
		height: 36px;
		display: block;
	}
	.strip line {
		vector-effect: non-scaling-stroke;
	}
	.lim {
		stroke: var(--ink);
		stroke-dasharray: 2 4;
		stroke-width: 1;
	}
	.grid {
		stroke: var(--rule);
		stroke-width: 1;
	}
	.sig {
		stroke: var(--accent);
		stroke-width: 2.5;
	}
	.val {
		font-family: var(--sans);
		font-stretch: 62%;
		font-weight: 780;
		font-size: 2.6rem;
		line-height: 1;
		letter-spacing: 0;
		text-transform: none;
	}
	.val small {
		font-family: var(--mono);
		font-size: 11px;
		font-weight: 400;
		color: var(--ink-2);
		vertical-align: top;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 4px;
	}
	.list li {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 16px;
		font-stretch: 85%;
		font-weight: 540;
		color: var(--ink-2);
	}
	.list li.go {
		color: var(--ink);
	}
	.box {
		position: relative;
		flex: none;
		width: 12px;
		height: 12px;
		border: 1px solid var(--ink);
	}
	.go .box::after {
		content: '';
		position: absolute;
		inset: 2px;
		background: var(--ink);
	}
	.st {
		margin-left: auto;
		font-size: 10px;
		color: var(--ink-2);
	}
	.crew li::before {
		content: '';
		width: 12px;
		height: 1px;
		background: var(--ink);
	}

	/* ---- scene ---- */
	svg text {
		font-family: var(--mono);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.ax,
	.gnd {
		stroke: var(--ink);
		stroke-width: 1;
	}
	.tick {
		stroke: var(--ink);
		stroke-opacity: 0.5;
	}
	.yr {
		font-size: 11px;
		fill: var(--ink);
	}
	.cap {
		font-size: 10px;
		fill: var(--ink-2);
	}
	.ptr {
		fill: var(--accent);
	}
	.plan {
		fill: none;
		stroke: var(--ink);
		stroke-opacity: 0.35;
		stroke-dasharray: 3 5;
	}
	.flown {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.5;
	}
	.hatch {
		stroke: var(--ink);
		stroke-opacity: 0.35;
	}
	.pad {
		fill: var(--paper-2);
		stroke: var(--ink);
	}
	.cl {
		stroke: var(--ink);
		stroke-opacity: 0.4;
		stroke-dasharray: 10 3 2 3;
	}
	.lamp {
		fill: var(--paper);
		stroke: var(--ink);
	}
	.lamp.on {
		fill: var(--accent);
		stroke: var(--accent);
	}
	.lander {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.6;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.lander :global(*),
	.plume path {
		vector-effect: non-scaling-stroke;
	}
	.lander .body {
		fill: var(--paper);
	}
	.lander .thin {
		stroke-width: 1;
	}
	.tag {
		font-size: 8px;
		fill: var(--ink);
		stroke: none;
	}
	.plume path {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.4;
		stroke-linejoin: round;
	}
	.spray line {
		stroke: var(--accent);
		stroke-width: 1;
	}
	.dim line,
	.dim path {
		stroke: var(--ink-2);
		fill: var(--ink-2);
		stroke-width: 0.8;
	}
	.dim .ext {
		stroke-opacity: 0.6;
	}
	.dim text {
		font-size: 10px;
		fill: var(--ink);
	}

	@media (max-width: 820px) {
		.wrap {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr) auto;
			padding-top: 60px;
			padding-bottom: 14px;
			row-gap: 10px;
		}
		.head,
		.tlm,
		.scene {
			grid-column: 1;
		}
		.scene {
			grid-row: 2;
		}
		.tlm {
			grid-row: 3;
			gap: 12px;
			max-width: none;
			padding-bottom: 0;
		}
		.read > div {
			padding: 6px 10px 6px 0;
			margin-right: 10px;
		}
		dd b {
			font-size: 1.5rem;
		}
		.phase dd {
			font-size: 10px;
			padding-top: 6px;
		}
		.val {
			font-size: 2rem;
		}
		.strip svg {
			height: 26px;
		}
		.list li {
			font-size: 14px;
		}
		.lab {
			margin-bottom: 4px;
			padding-bottom: 4px;
		}
		.yr {
			font-size: 17px;
		}
		.cap,
		.dim text {
			font-size: 15px;
		}
	}
</style>
