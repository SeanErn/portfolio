<script lang="ts">
	import { onMount } from 'svelte';
	import { CALLOUTS, STORY_LENGTH, createStage, windowed, type Frame } from '../scene/stage';
	import ChapterHead from '../kit/ChapterHead.svelte';
	import { questnav } from '../content';

	let section: HTMLElement;
	let stageEl: HTMLDivElement;
	let canvas: HTMLCanvasElement;

	let frame = $state.raw<Frame | null>(null);
	let vw = $state(1200);
	let failed = $state(false);

	const meta = Object.fromEntries(CALLOUTS.map((c) => [c.id, c]));
	/** Where a label goes: its preferred side unless that runs off screen (labels are ≤ ~170px wide). */
	const place = (x: number, dx: number) => {
		const W = 170;
		let left = dx < 0;
		if (left && x - W - 12 < 0) left = false;
		else if (!left && x + W + 12 > vw) left = true;
		const lx = left ? Math.max(x - Math.abs(dx), W + 8) : Math.min(x + Math.abs(dx), vw - W - 8);
		return { lx: left ? Math.min(lx, x - 12) : Math.max(lx, x + 12), left };
	};
	const fmt = (n: number) => (n >= 0 ? ' ' : '') + n.toFixed(2);
	const deg = (r: number) => {
		const d = Math.round(((((r * 180) / Math.PI) % 360) + 360) % 360);
		return String(d).padStart(3, ' ') + '°';
	};

	onMount(() => {
		let stage: ReturnType<typeof createStage> | undefined;
		let raf = 0;
		let smooth = 0;
		const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

		const ro = new ResizeObserver(() => {
			vw = stageEl.clientWidth;
			stage?.resize(stageEl.clientWidth, stageEl.clientHeight);
		});
		const onPointer = (e: PointerEvent) =>
			stage?.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);

		const tick = () => {
			const raw = (-section.getBoundingClientRect().top / innerHeight) * 100;
			const s = pin ? Number(pin) : Math.min(Math.max(raw, 0), STORY_LENGTH);
			smooth += (s - smooth) * (reducedMotion ? 1 : 0.12);
			// snap on big jumps (reload mid-page, anchor links) instead of replaying the story
			if (Math.abs(s - smooth) < 0.01 || Math.abs(s - smooth) > 60) smooth = s;
			frame = stage!.frame(smooth, (performance.now() - t0) / 1000);
			raf = requestAnimationFrame(tick);
		};
		const t0 = performance.now();
		// ?s=NNN pins the 3D to one story position (in viewport heights × 100), for screenshots
		const pin = new URLSearchParams(location.search).get('s');
		try {
			stage = createStage(canvas, { reducedMotion });
			ro.observe(stageEl);
			stage.resize(stageEl.clientWidth, stageEl.clientHeight);
			tick();
		} catch {
			failed = true;
		}
		addEventListener('pointermove', onPointer);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			removeEventListener('pointermove', onPointer);
			stage?.dispose();
		};
	});

	const s = $derived(frame?.s ?? 0);
	const hudOpacity = $derived(windowed(s, 470, 495, 700, 701));
</script>

<section class="story chapter" id="questnav" data-chapter="questnav" bind:this={section} style:height="{STORY_LENGTH + 100}vh">
	<div class="stage" bind:this={stageEl}>
		<canvas bind:this={canvas} aria-hidden="true"></canvas>

		{#if failed}
			<p class="fallback mono">WebGL is unavailable here, so the headset stays in the drawer.</p>
		{/if}

		<svg class="leaders" aria-hidden="true">
			{#each frame?.callouts ?? [] as c (c.id)}
				{#if c.o > 0.01}
					{@const m = meta[c.id]}
					{@const p = place(c.x, m.dx)}
					<g style:opacity={c.o}>
						<polyline
							points="{c.x},{c.y} {c.x + (p.lx - c.x) * 0.55},{c.y + m.dy} {p.lx},{c.y + m.dy}"
							pathLength="1"
							stroke-dasharray="1"
							stroke-dashoffset={1 - c.o}
						/>
						<circle cx={c.x} cy={c.y} r="5" class="ring" />
						<circle cx={c.x} cy={c.y} r="2" class="dot" />
					</g>
				{/if}
			{/each}
		</svg>
		{#each frame?.callouts ?? [] as c (c.id)}
			{#if c.o > 0.01}
				{@const m = meta[c.id]}
				{@const p = place(c.x, m.dx)}
				<div
					class="label"
					class:left={p.left}
					style:opacity={c.o}
					style:transform="translate({p.lx}px, {c.y + m.dy}px)"
				>
					<span class="mono">{m.label}</span>
					<span class="sub">{m.sub}</span>
				</div>
			{/if}
		{/each}

		{#if frame?.hud}
			{@const h = frame.hud}
			<div class="hud mono" style:opacity={hudOpacity}>
				<div class="row head"><span>pose</span><span>x m</span><span>y m</span><span>θ</span></div>
				<div class="row est">
					<span><i class="sw solid"></i>QuestNav</span>
					<span>{fmt(h.est.x)}</span><span>{fmt(-h.est.z)}</span><span>{deg(h.est.heading)}</span>
				</div>
				<div class="row">
					<span><i class="sw dashed"></i>Odometry</span>
					<span>{fmt(h.odo.x)}</span><span>{fmt(-h.odo.z)}</span><span>{deg(h.odo.heading)}</span>
				</div>
				<div class="row err">
					<span>drift</span><span>{Math.round(h.err * 100)} cm</span><span></span><span
						>{Math.round(h.t * 100)}%</span
					>
				</div>
			</div>
		{/if}
	</div>

	<div class="steps">
		<div class="step" style:top="0vh" style:height="100vh">
			<article class="card intro">
				<ChapterHead ref="U2" org={questnav.org} role={questnav.role} when={questnav.when} where={questnav.where} compact />
				<p class="lede">
					Good robot localization used to take expensive sensors, hard-to-find parts and an expert to tune
					them. QuestNav swaps all three for a headset you can buy off the shelf. Scroll to take it apart.
				</p>
			</article>
		</div>

		<div class="step" style:top="105vh" style:height="150vh">
			<article class="card">
				<p class="mono fig">Fig. 1 — The sensor</p>
				<h2>Good localization, off the shelf.</h2>
				<p>
					A VR headset already knows exactly where it is: inside-out tracking fuses camera frames and IMU
					data into a full 6-DoF pose, with no markers on the walls. It's mass-produced, in stock and
					calibrated at the factory.
				</p>
				<dl class="pipe cost mono">
					<dt></dt><dd class="what head">The usual way</dd><dd class="head">QuestNav</dd>
					<dt>Money</dt><dd class="what">specialist sensors</dd><dd>one consumer headset</dd>
					<dt>Parts</dt><dd class="what">niche vendors, lead times</dd><dd>any electronics store</dd>
					<dt>Skill</dt><dd class="what">calibration and SLAM tuning</dd><dd>mount it, add a library</dd>
				</dl>
			</article>
		</div>

		<div class="step" style:top="270vh" style:height="160vh">
			<article class="card">
				<p class="mono fig">Fig. 2 — Teardown</p>
				<h2>QuestNav points that stack at a robot.</h2>
				<p>
					I lead the open-source project. It was built for FIRST Robotics teams, students on tight budgets,
					and has since spread to other robots that need localization without the price tag. Four parts,
					four languages:
				</p>
				<dl class="pipe mono">
					<dt>Headset</dt><dd>Unity / C#</dd><dd class="what">reads the pose</dd>
					<dt>Wire</dt><dd>Protobuf</dd><dd class="what">ships it</dd>
					<dt>Robot</dt><dd>Java</dd><dd class="what">fuses it</dd>
					<dt>Pit</dt><dd>Vue</dd><dd class="what">configures it</dd>
				</dl>
			</article>
		</div>

		<div class="step" style:top="450vh" style:height="310vh">
			<article class="card">
				<p class="mono fig">Fig. 3 — On the field</p>
				<h2>Wheels slip. Cameras don't.</h2>
				<p>
					Wheel odometry drifts with every bump and skid. The headset keeps locking onto features it has
					already seen, so the error stays near zero, with no lidar, no motion-capture room and no SLAM
					expert on the team.
				</p>
				<ul class="legend mono">
					<li><i class="sw solid"></i>QuestNav (VSLAM)</li>
					<li><i class="sw dashed"></i>Wheel odometry</li>
					<li><i class="sw pts"></i>Mapped features</li>
				</ul>
				<dl class="stats">
					<div><dt class="mono">Stars</dt><dd>{questnav.stats.stars}</dd></div>
					<div><dt class="mono">Forks</dt><dd>{questnav.stats.forks}</dd></div>
					<div><dt class="mono">Commits</dt><dd>{questnav.stats.commits}</dd></div>
					<div><dt class="mono">Releases</dt><dd>{questnav.stats.releases}</dd></div>
				</dl>
				<p class="mono note">
					A vendor dependency for FRC teams worldwide, and now low-cost localization for robots beyond FIRST.
				</p>
			</article>
		</div>
	</div>
</section>

<style>
	.story {
		position: relative;
	}

	.stage {
		position: sticky;
		top: 0;
		height: 100vh;
		height: 100svh;
		overflow: hidden;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.fallback {
		position: absolute;
		inset: auto var(--gutter) 30vh auto;
		max-width: 28ch;
		color: var(--ink-2);
	}

	.leaders {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}
	.leaders polyline {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1;
	}
	.leaders .ring {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.25;
	}
	.leaders .dot {
		fill: var(--accent);
	}

	.label {
		position: absolute;
		top: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		padding: 0 0 0 8px;
		margin-top: -9px;
		pointer-events: none;
		white-space: nowrap;
		will-change: transform;
	}
	.label.left {
		align-items: flex-end;
		padding: 0 8px 0 0;
		translate: -100% 0;
	}
	.label .mono {
		font-size: 11px;
		font-weight: 500;
		background: var(--paper);
		line-height: 18px;
		padding: 0 4px;
	}
	.label .sub {
		font-size: 13px;
		color: var(--ink-2);
		padding: 0 4px;
	}

	.hud {
		position: absolute;
		right: var(--gutter);
		bottom: calc(var(--gutter) + 8px);
		font-size: 11px;
		background: var(--paper);
		border: 1px solid var(--ink);
		padding: 10px 12px;
		min-width: 300px;
		font-variant-numeric: tabular-nums;
	}
	.hud .row {
		display: grid;
		grid-template-columns: 1.6fr 1fr 1fr 0.8fr;
		gap: 8px;
		padding: 3px 0;
		white-space: pre;
	}
	.hud .row span:not(:first-child) {
		text-align: right;
	}
	.hud .head {
		color: var(--ink-2);
		border-bottom: 1px solid var(--rule);
		padding-bottom: 6px;
		margin-bottom: 3px;
	}
	.hud .est {
		color: var(--accent);
	}
	.hud .err {
		border-top: 1px solid var(--rule);
		margin-top: 3px;
		padding-top: 6px;
	}

	.sw {
		display: inline-block;
		width: 18px;
		height: 0;
		vertical-align: middle;
		margin-right: 8px;
	}
	.sw.solid {
		border-top: 3px solid var(--accent);
	}
	.sw.dashed {
		border-top: 1.5px dashed var(--ink);
	}
	.sw.pts {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
		margin: 0 20px 0 6px;
	}

	/* ---------- copy ---------- */
	.steps {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.step {
		position: absolute;
		left: 0;
		right: 0;
	}
	.card {
		position: sticky;
		top: 18vh;
		margin-left: var(--rail);
		width: min(30rem, 36vw);
		pointer-events: auto;
	}
	.card h2 {
		font-size: clamp(1.9rem, 3vw, 2.9rem);
		font-stretch: 72%;
		font-weight: 680;
		line-height: 0.98;
		letter-spacing: -0.01em;
		margin: 14px 0 18px;
	}
	.card p:not(.mono) {
		color: var(--ink-2);
		max-width: 38ch;
	}
	.fig {
		display: inline-flex;
		gap: 10px;
		align-items: center;
		color: var(--accent);
	}
	.fig::before {
		content: '';
		width: 28px;
		height: 1px;
		background: currentColor;
	}

	.pipe {
		display: grid;
		grid-template-columns: auto auto 1fr;
		margin: 22px 0 0;
		border-top: 1px solid var(--ink);
	}
	.pipe dt,
	.pipe dd {
		margin: 0;
		padding: 9px 14px 9px 0;
		border-bottom: 1px solid var(--rule);
	}
	.pipe dd {
		font-weight: 500;
	}
	.cost {
		grid-template-columns: auto 1fr 1fr;
	}
	.cost dd {
		text-transform: none;
		letter-spacing: 0;
		font-size: 13px;
	}
	.cost .head {
		color: var(--ink-2);
		font-size: 11px;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.cost dd:not(.what):not(.head) {
		color: var(--accent);
	}
	.pipe .what {
		color: var(--ink-2);
		text-transform: none;
		font-weight: 400;
		letter-spacing: 0;
		font-size: 13px;
	}

	.legend {
		list-style: none;
		padding: 0;
		margin: 20px 0;
		display: grid;
		gap: 6px;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin: 0 0 12px;
		border-top: 1px solid var(--ink);
	}
	.stats div {
		padding: 10px 10px 0 0;
	}
	.stats dt {
		color: var(--ink-2);
		font-size: 11px;
	}
	.stats dd {
		margin: 0;
		font-size: 2rem;
		font-stretch: 62%;
		font-weight: 760;
		line-height: 1.1;
	}
	.note {
		color: var(--ink-2);
		text-transform: none;
		letter-spacing: 0;
		font-size: 12px;
	}

	.intro .lede {
		max-width: 34ch;
		margin-top: 22px;
		color: var(--ink-2);
	}

	@media (max-width: 820px) {
		.card {
			position: sticky;
			top: auto;
			bottom: 0;
			margin: 0;
			width: 100%;
			padding: 18px var(--gutter) 22px;
			background: var(--paper);
			border-top: 1px solid var(--ink);
		}
		.step {
			display: flex;
			flex-direction: column;
			justify-content: flex-end;
		}
		.card h2 {
			margin: 8px 0 10px;
		}
		.card p:not(.mono) {
			font-size: 15px;
		}
		.stats dd {
			font-size: 1.5rem;
		}
		.legend {
			margin: 12px 0;
		}
		.pipe dt,
		.pipe dd {
			padding: 5px 12px 5px 0;
		}
		.legend,
		.note,
		.label .sub {
			display: none;
		}
		.card h2 {
			font-size: 1.45rem;
		}
		.hud {
			top: 52px;
			padding: 6px 10px;
			bottom: auto;
			right: var(--gutter);
			left: var(--gutter);
			min-width: 0;
		}
	}
</style>
