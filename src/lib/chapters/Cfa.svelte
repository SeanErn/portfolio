<script lang="ts">
	/**
	 * Y4 · Chick-fil-A — "Peak hour", drawn as a top-down drive-thru site plan.
	 * Scroll drives a shift clock through one service day (the lunch peak gets most of the scroll).
	 * Cars come in on two ordering lanes, merge, stop at the window and leave; the queue builds through
	 * the peak and drains after. 15 crew marks walk out of standby to their posts as the load climbs.
	 * At close the facts land as a datasheet table.
	 *
	 * Car motion runs on its own "display time" (a deterministic queue simulation precomputed at load),
	 * so cars move smoothly while the clock races through the day. Clock, arrivals, per-car timers and
	 * off-peak staffing are illustrative; the table holds the facts.
	 */
	import Pinned from '../kit/Pinned.svelte';
	import ChapterHead from '../kit/ChapterHead.svelte';
	import { chapters, cfa as data } from '../content';
	import { clamp, seg, lerp, ease } from '../kit/motion';

	const ref = chapters.find((c) => c.id === 'cfa')!.ref;
	const CREW = data.stats.crew;
	const LIMIT = data.stats.serviceMinutes;
	const GUESTS = 500;

	// ── Illustrative service day ────────────────────────────────────────────────────────────────
	const OPEN = 390; // 06:30
	const CLOSE = 1320; // 22:00
	const gauss = (t: number, m: number, s: number) => Math.exp(-((t - m) ** 2) / (2 * s * s));
	const density = (t: number) =>
		t < OPEN || t > CLOSE
			? 0
			: 0.22 + 0.6 * gauss(t, 480, 38) + 2.2 * gauss(t, 752, 48) + 1.1 * gauss(t, 1085, 55);

	let DMAX = 0;
	const cum = new Float64Array(CLOSE - OPEN + 1);
	for (let i = 1; i < cum.length; i++) {
		const d = density(OPEN + i - 0.5);
		DMAX = Math.max(DMAX, d);
		cum[i] = cum[i - 1] + d;
	}
	const TOTAL = cum[cum.length - 1];
	const load = (t: number) => density(t) / DMAX;
	const guestsBy = (t: number) => {
		const x = clamp(t - OPEN, 0, cum.length - 1);
		const i = Math.min(cum.length - 2, Math.floor(x));
		return Math.floor((lerp(cum[i], cum[i + 1], x - i) / TOTAL) * GUESTS);
	};

	/** Crew needed, staffed ~20 min ahead of the load, set in 15-minute blocks. */
	const need = (t: number) => Math.round(5 + 10 * clamp(load(t + 20) * 1.12));
	const staff = (t: number) => {
		const k = Math.floor(t / 15) * 15;
		return lerp(need(k - 15), need(k), ease(clamp((t - k) / 6)));
	};
	/** Illustrative order-to-window time in minutes; peaks around 4:20, under the 5:00 limit. */
	const svcMinutes = (t: number) => 2.4 + 1.8 * load(t) ** 1.1 + 0.12 * Math.sin(t / 7);

	// ── Clock: p → minute of the day ────────────────────────────────────────────────────────────
	const KP = [0, 0.1, 0.62, 0.8];
	const KT = [OPEN, 630, 840, CLOSE];
	function timeAt(p: number) {
		if (p >= KP[3]) return CLOSE;
		let i = 0;
		while (p > KP[i + 1]) i++;
		return lerp(KT[i], KT[i + 1], (p - KP[i]) / (KP[i + 1] - KP[i]));
	}
	const hhmm = (t: number) => {
		const m = Math.floor(t);
		return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
	};
	const mss = (v: number) => {
		const s = Math.floor(v * 60);
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	};

	// ── Site plan geometry (viewBox 760 × 470) ──────────────────────────────────────────────────
	type Pt = [number, number];
	type Path = { x: Float64Array; y: Float64Array; c: Float64Array; len: number };
	function makePath(pts: Pt[]): Path {
		const n = pts.length;
		const x = new Float64Array(n), y = new Float64Array(n), c = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			x[i] = pts[i][0];
			y[i] = pts[i][1];
			if (i) c[i] = c[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
		}
		return { x, y, c, len: c[n - 1] };
	}
	function at(P: Path, s: number) {
		s = clamp(s, 0, P.len);
		let lo = 0, hi = P.c.length - 1;
		while (hi - lo > 1) {
			const m = (lo + hi) >> 1;
			if (P.c[m] <= s) lo = m;
			else hi = m;
		}
		const u = (s - P.c[lo]) / (P.c[hi] - P.c[lo] || 1);
		const dx = P.x[hi] - P.x[lo], dy = P.y[hi] - P.y[lo];
		return { x: P.x[lo] + dx * u, y: P.y[lo] + dy * u, a: (Math.atan2(dy, dx) * 180) / Math.PI };
	}
	const line = (a: Pt, b: Pt, n = 2): Pt[] =>
		Array.from({ length: n }, (_, i) => [lerp(a[0], b[0], i / (n - 1)), lerp(a[1], b[1], i / (n - 1))]);
	const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 14): Pt[] =>
		Array.from({ length: n }, (_, i) => {
			const a = lerp(a0, a1, i / (n - 1));
			return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
		});

	const LANE_Y = [365, 415];
	const MERGE_X0 = 380;
	const MERGE_X1 = 470;
	const ORDER_X = 300;
	const WIN_Y = 240;
	const pre = (y: number): Pt[] => [
		...line([-50, y], [MERGE_X0, y]),
		...Array.from({ length: 12 }, (_, i): Pt => {
			const u = (i + 1) / 12;
			return [lerp(MERGE_X0, MERGE_X1, u), lerp(y, 390, ease(u))];
		})
	];
	const trunk: Pt[] = [
		...line([MERGE_X1, 390], [630, 390]).slice(1),
		...arc(630, 340, 50, Math.PI / 2, 0).slice(1),
		...line([680, 340], [680, 140]).slice(1),
		...arc(630, 140, 50, 0, -Math.PI / 2).slice(1),
		...line([630, 90], [-60, 90]).slice(1)
	];
	const LANES = LANE_Y.map((y) => makePath([...pre(y), ...trunk]));
	const PRE = makePath(pre(LANE_Y[0])).len; // merge point (same for both lanes)
	const S_MERGE0 = MERGE_X0 + 50;
	const S_ORDER = ORDER_X + 50;
	const S_WIN = PRE + (630 - MERGE_X1) + (Math.PI / 2) * 50 + (340 - WIN_Y);
	const LEN = LANES[0].len;

	function offset(P: Path, d: number, from = 0, to = P.x.length) {
		let s = '';
		for (let i = from; i < to; i++) {
			const j = Math.min(i + 1, P.x.length - 1), k = Math.max(i - 1, 0);
			const dx = P.x[j] - P.x[k], dy = P.y[j] - P.y[k];
			const l = Math.hypot(dx, dy) || 1;
			s += `${s ? 'L' : 'M'}${(P.x[i] + (dy / l) * d).toFixed(1)} ${(P.y[i] - (dx / l) * d).toFixed(1)}`;
		}
		return s;
	}
	const NPRE = pre(LANE_Y[0]).length;
	// Curbs: outer edge of each ordering lane, then both sides of the single lane.
	const curbs = [offset(LANES[0], 20, 0, NPRE), offset(LANES[1], -20, 0, NPRE), offset(LANES[0], 20, NPRE - 1), offset(LANES[0], -20, NPRE - 1)];

	// ── Queue simulation in display time τ (0..1000 over p 0..0.8) ─────────────────────────────
	const TAU = 1000;
	const tauAt = (p: number) => (clamp(p / KP[3]) * TAU);
	const DT = 0.25;
	const V = 8; // plan units per τ
	const GAP = 40;
	type Car = {
		id: number; arr: number; lane: number; dO: number; dW: number; svc: number;
		s: number; st: number; tO: number; tW: number; tWa: number; k0: number; track: number[]; trunk: boolean; q: boolean;
	};
	function rng(seed: number) {
		let a = seed;
		return () => {
			a = (a + 0x6d2b79f5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}
	const clockOfTau = (tau: number) => timeAt((tau / TAU) * KP[3]);
	const cars: Car[] = [];
	const trunkOrder: Car[] = [];
	{
		const r = rng(7);
		// arrivals: inverse of cumulative rate λ(τ)
		const rate = (tau: number) => 0.006 + 0.15 * load(clockOfTau(tau)) ** 1.5;
		let acc = r() * 0.5;
		for (let tau = 0; tau < TAU - 160; tau += 0.5) {
			acc += rate(tau) * 0.5;
			if (acc >= 1) {
				acc -= 1 + (r() - 0.5) * 0.5;
				cars.push({
					id: cars.length, arr: tau, lane: 0, dO: 5 + r() * 5, dW: 10 + r() * 6, svc: 0,
					s: -1, st: 0, tO: 0, tW: 0, tWa: 0, k0: 0, track: [], trunk: false, q: false
				});
			}
		}
		const lanesOf: Car[][] = [[], []];
		let tail: Car | null = null;
		const steps = Math.ceil(TAU / DT);
		let first = 0;
		for (let k = 0; k <= steps; k++) {
			const tau = k * DT;
			for (let i = first; i < cars.length; i++) {
				const c = cars[i];
				if (c.arr > tau) break;
				if (c.st === 6) continue;
				if (c.s < 0) {
					// pick the emptier lane, then wait for room at the entry
					if (!c.q) {
						c.q = true;
						const n0 = lanesOf[0].filter((x) => !x.trunk && x.st !== 6).length;
						const n1 = lanesOf[1].filter((x) => !x.trunk && x.st !== 6).length;
						c.lane = n0 < n1 ? 0 : n1 < n0 ? 1 : c.id % 2;
						lanesOf[c.lane].push(c);
					}
					const q = lanesOf[c.lane];
					const ahead = q[q.indexOf(c) - 1];
					if (ahead && (ahead.s < 0 || ahead.s < GAP)) continue;
					c.s = 0;
					c.st = 1;
					c.k0 = k;
				}
				let lim = LEN + 100;
				if (!c.trunk) {
					const q = lanesOf[c.lane];
					const ahead = q[q.indexOf(c) - 1];
					if (ahead && ahead.st !== 6) lim = Math.min(lim, ahead.s - GAP);
					if (tail && tail.st !== 6) lim = Math.min(lim, tail.s - GAP);
					if (c.s > S_MERGE0 - GAP) {
						// zipper: yield to the other lane's car if it is further into the merge
						for (const o of lanesOf[1 - c.lane]) {
							if (!o.trunk && o.st >= 1 && o.st !== 6 && o.s >= c.s && o.s > S_MERGE0 - GAP) lim = Math.min(lim, o.s - GAP);
						}
					}
				} else {
					// follow the car that entered the single lane before this one
					const ahead = trunkOrder[trunkOrder.indexOf(c) - 1];
					if (ahead && ahead.st !== 6) lim = Math.min(lim, ahead.s - GAP);
				}
				if (c.st === 1) lim = Math.min(lim, S_ORDER);
				if (c.st === 3) lim = Math.min(lim, S_WIN);
				const ns = Math.max(c.s, Math.min(c.s + V * DT, lim));
				c.s = ns;
				if (c.st === 1 && c.s >= S_ORDER - 0.01) {
					c.st = 2;
					c.tO = tau;
					c.svc = Math.min(LIMIT - 0.3, svcMinutes(clockOfTau(tau)));
				} else if (c.st === 2 && tau >= c.tO + c.dO) c.st = 3;
				else if (c.st === 3 && c.s >= S_WIN - 0.01) {
					c.st = 4;
					c.tWa = tau;
				} else if (c.st === 4 && tau >= c.tWa + c.dW) {
					c.st = 5;
					c.tW = tau;
				}
				if (!c.trunk && c.s >= PRE) {
					c.trunk = true;
					trunkOrder.push(c);
					tail = c;
				}
				c.track.push(c.s);
				if (c.s >= LEN) c.st = 6;
			}
			while (first < cars.length && cars[first].st === 6) first++;
		}
	}

	/** Cars on the plan at display time τ. */
	function carsAt(tau: number) {
		const k = tau / DT;
		const out: { id: number; x: number; y: number; a: number; timed: boolean }[] = [];
		let timed = -1;
		let timer = 0;
		let lane = 0;
		for (const c of cars) {
			if (c.arr > tau) break;
			const j = k - c.k0;
			if (!c.track.length || j < 0 || j >= c.track.length - 1) {
				if (c.track.length && j < 0) lane++; // arrived, waiting to get on the plan
				continue;
			}
			const s = lerp(c.track[Math.floor(j)], c.track[Math.floor(j) + 1], j - Math.floor(j));
			const q = at(LANES[c.lane], s);
			if (q.x < -30) continue;
			if (c.tW === 0 || tau < c.tW) lane++;
			// time the oldest car that has ordered but not yet left the window
			if (timed < 0 && c.tO && tau >= c.tO && (c.tW === 0 || tau < c.tW)) {
				timed = c.id;
				const end = c.tW || c.tO + 1e9;
				timer = c.svc * clamp((tau - c.tO) / (end - c.tO));
			}
			out.push({ id: c.id, x: q.x, y: q.y, a: q.a, timed: false });
		}
		for (const o of out) o.timed = o.id === timed;
		return { list: out, timed, timer, inLane: lane };
	}

	// ── Crew posts (in order of being staffed) and standby spots ───────────────────────────────
	const POSTS: Pt[] = [
		[420, 200], // kitchen
		[598, 226], // window
		[230, 390], // order-taker on the median
		[460, 200],
		[566, 252], // bagging
		[598, 262], // window
		[160, 390], // order-taker
		[500, 200],
		[642, 300], // runner
		[420, 262],
		[90, 390], // order-taker
		[460, 262],
		[642, 172], // runner
		[566, 292], // headset / order entry
		[500, 262]
	];
	const standby = (i: number): Pt => [258 + (i % 5) * 20, 168 + Math.floor(i / 5) * 22];

	// ── Day strip ──────────────────────────────────────────────────────────────────────────────
	const AX0 = 360, AX1 = 1320;
	const tx = (t: number) => ((t - AX0) / (AX1 - AX0)) * 1000;
	const SH = 34;
	const arrPath = Array.from({ length: Math.floor((CLOSE - OPEN) / 4) + 1 }, (_, i) => {
		const t = OPEN + i * 4;
		return `${i ? 'L' : 'M'}${tx(t).toFixed(1)} ${(SH - load(t) * (SH - 4)).toFixed(1)}`;
	}).join('');
	const peakBlocks = Array.from({ length: Math.ceil((CLOSE - OPEN) / 15) }, (_, i) => OPEN + i * 15).filter((t) => need(t) >= CREW);
	const peak: [number, number] = [peakBlocks[0], peakBlocks[peakBlocks.length - 1] + 15];
	const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22];

	const facts = [
		{ k: 'Crew positioned', c: 'peak hours', min: '', typ: String(CREW), max: '', u: 'people' },
		{ k: 'Guests served', c: 'per day', min: data.stats.guestsPerDay, typ: '', max: '', u: 'guests' },
		{ k: 'Speed of service', c: 'per guest', min: '', typ: '', max: `<${LIMIT}:00`, u: 'm:ss' },
		{ k: 'Health inspection', c: 'new hires trained', min: '', typ: data.stats.inspection.replace('%', ''), max: '', u: '% pass' },
		{ k: 'Guest satisfaction', c: 'every shift', min: '>' + data.stats.satisfaction.replace(/[%+]/g, ''), typ: '', max: '', u: '%' }
	];
</script>

<div class="chapter" id="cfa" data-chapter="cfa">
	<Pinned length={250}>
		{#snippet children(p)}
			{@const t = timeAt(p)}
			{@const closed = p >= KP[3]}
			{@const s = staff(t)}
			{@const v = carsAt(tauAt(p))}
			{@const fo = ease(seg(p, 0.8, 0.845))}
			{@const f = ease(seg(p, 0.845, 0.9))}
			{@const placed = POSTS.filter((_, i) => clamp(s - i) >= 0.5).length}
			<div class="wrap">
				<div class="left">
					<div>
						<ChapterHead {ref} org={data.org} role={data.role} when={data.when} where={data.where} compact />
						<p class="lede">Shift lead through the lunch rush at the drive-thru: put fifteen people where the line needs them, and keep it moving.</p>
					</div>

					<dl class="readouts">
						<div class="clock">
							<dt class="mono">Shift clock</dt>
							<dd class="big">{hhmm(t)}</dd>
						</div>
						<div>
							<dt class="mono">Guests today</dt>
							<dd class="num">{closed ? data.stats.guestsPerDay : guestsBy(t)}</dd>
						</div>
						<div>
							<dt class="mono">Crew positioned</dt>
							<dd class="num">{String(placed).padStart(2, '0')}<span>/{CREW}</span></dd>
						</div>
						<div>
							<dt class="mono">Cars in line</dt>
							<dd class="num">{String(closed ? 0 : v.inLane).padStart(2, '0')}</dd>
						</div>
						<div class="gauge">
							<dt class="mono">
								<span class="lbl2">Order → window{#if v.timed >= 0 && !closed}<em>&nbsp;· car {String(v.timed + 1).padStart(3, '0')}</em>{/if}</span>
								<span class="val">{closed ? `<${LIMIT}:00` : v.timed >= 0 ? mss(v.timer) : '–:––'}</span>
							</dt>
							<dd>
								<svg viewBox="0 0 300 26" preserveAspectRatio="none" aria-hidden="true">
									<line x1="0" x2="300" y1="18" y2="18" class="hair" />
									{#each [0, 1, 2, 3, 4, 5, 6] as m}
										<line x1={m * 50} x2={m * 50} y1="12" y2="18" class="hair" />
									{/each}
									<rect x="250" y="4" width="50" height="14" class="over" />
									<line x1="250" x2="250" y1="0" y2="26" class="limit" />
									<rect x="0" y="15" width={closed || v.timed < 0 ? 0 : (v.timer / 6) * 300} height="6" class="bar" />
								</svg>
								<span class="mono scale"><i>0</i><i>1</i><i>2</i><i>3</i><i>4</i><i>limit 5:00</i></span>
							</dd>
						</div>
					</dl>
				</div>

				<div class="cell">
					<figure class="plan" style:opacity={1 - fo} style:transform="translateY({-fo * 16}px)" aria-hidden={fo > 0.5}>
						<svg viewBox="0 0 760 470" aria-label="Top-down drive-thru: two ordering lanes merge into one, past the window to the exit">
							<!-- parking stalls -->
							{#each Array(7) as _, i}
								<line x1={14 + i * 30} x2={14 + i * 30} y1="135" y2="185" class="paint" />
								<line x1={14 + i * 30} x2={14 + i * 30} y1="265" y2="315" class="paint" />
							{/each}
							<line x1="14" x2="194" y1="135" y2="135" class="paint" />
							<line x1="14" x2="194" y1="315" y2="315" class="paint" />

							<!-- curbs and lane paint -->
							{#each curbs as d}<path {d} class="curb" />{/each}
							<line x1="0" x2={MERGE_X0} y1="390" y2="390" class="dash" />
							<line x1={ORDER_X + 14} x2={ORDER_X + 14} y1="347" y2="383" class="paint" />
							<line x1={ORDER_X + 14} x2={ORDER_X + 14} y1="397" y2="433" class="paint" />
							<line x1="662" x2="698" y1={WIN_Y - 14} y2={WIN_Y - 14} class="paint" />
							{#each [[110, 365], [110, 415], [560, 390]] as [x, y]}
								<path d="M{x - 8} {y - 6}L{x} {y}L{x - 8} {y + 6}" class="paint" />
							{/each}
							<path d="M680 300l-6 8M680 300l6 8M680 300v18" class="paint" />
							<path d="M80 90l8 -6M80 90l8 6M80 90h20" class="paint" />

							<!-- order points: menu board + speaker post -->
							<rect x={ORDER_X - 30} y="326" width="34" height="8" class="board" />
							<circle cx={ORDER_X + 14} cy="338" r="3" class="post" />
							<rect x={ORDER_X - 30} y="444" width="34" height="8" class="board" />
							<circle cx={ORDER_X + 14} cy="440" r="3" class="post" />

							<!-- building -->
							<rect x="230" y="135" width="390" height="180" class="floor" />
							<path d="M620 {WIN_Y - 18}V135H230V315H620V{WIN_Y + 18}" class="wall" />
							<rect x="616" y={WIN_Y - 18} width="8" height="36" class="win" />
							<rect x="240" y="150" width="110" height="80" class="zone" />
							<rect x="392" y="170" width="132" height="120" class="zone" />

							<!-- crew -->
							{#each POSTS as post, i}
								{@const k = ease(clamp(s - i))}
								{@const sb = standby(i)}
								<circle
									r="5"
									class="crew"
									class:on={k > 0.5}
									class:out={k > 0.5 && (post[1] > 330 || post[0] > 630)}
									transform="translate({lerp(sb[0], post[0], k)} {lerp(sb[1], post[1], k)})"
								/>
							{/each}

							<!-- cars -->
							{#each v.list as c (c.id)}
								<g class="car" class:timed={c.timed} transform="translate({c.x} {c.y}) rotate({c.a})">
									<rect x="-15" y="-8" width="30" height="16" rx="3.5" />
									<path d="M5 -6.5Q8 0 5 6.5M-9 -6Q-11 0 -9 6" />
								</g>
							{/each}
						</svg>
						<span class="mono lbl" style:left="0%" style:top="12%">← Exit</span>
						<span class="mono lbl" style:left="0%" style:top="96%">Entry · 2 lanes →</span>
						<span class="mono lbl opt" style:left="32.1%" style:top="52%">Standby</span>
						<span class="mono lbl" style:left="51.6%" style:top="64.5%">Kitchen</span>
						<span class="mono lbl dim" style:left="1.8%" style:top="26%">Parking</span>
						<span class="mono lbl opt" style:left="92.6%" style:top="51%">Window</span>
						<span class="mono lbl" style:left="41%" style:top="96%">← Order point</span>
						<span class="mono lbl" style:left="1.8%" style:top="70.5%">Order-takers · tablets</span>
						<span class="mono lbl opt" style:left="92.6%" style:top="36.6%">Runners</span>
						<span class="mono lbl dim" style:left="62%" style:top="96%">Merge → one lane</span>
					</figure>

					<div class="facts" style:opacity={f} style:transform="translateY({(1 - f) * 16}px)" aria-hidden={f < 0.5}>
						<p class="mono cap">Y4 · Characteristics <span>· per shift, as shift leader</span></p>
						<table>
							<thead>
								<tr class="mono"><th>Parameter</th><th>Min</th><th>Typ</th><th>Max</th><th>Unit</th></tr>
							</thead>
							<tbody>
								{#each facts as row, i}
									{@const o = ease(seg(p, 0.85 + i * 0.022, 0.9 + i * 0.022))}
									<tr style:opacity={o}>
										<td><b>{row.k}</b><span class="mono">{row.c}</span></td>
										<td class="v">{row.min}</td>
										<td class="v">{row.typ}</td>
										<td class="v">{row.max}</td>
										<td class="mono u">{row.u}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				<figure class="strip">
					<span class="mono rl">Arrivals</span>
					<div class="plot">
						<svg viewBox="0 0 1000 {SH}" preserveAspectRatio="none" height={SH} aria-label="Arrivals through the day, lunch peak marked">
							<rect x={tx(peak[0])} width={tx(peak[1]) - tx(peak[0])} y="0" height={SH} class="peak" />
							{#each hours as h}
								<line x1={tx(h * 60)} x2={tx(h * 60)} y1={SH - 4} y2={SH} class="tick" />
							{/each}
							<line x1="0" x2="1000" y1={SH} y2={SH} class="tick" />
							<path d={arrPath} class="arr" />
							<line x1={tx(t)} x2={tx(t)} y1="0" y2={SH} class="cursor" />
						</svg>
						<div class="axis mono">
							{#each hours as h}
								<span style:left="{tx(h * 60) / 10}%">{String(h).padStart(2, '0')}</span>
							{/each}
							<span class="pk" style:left="{(tx(peak[0]) + tx(peak[1])) / 20}%">peak · {CREW} crew</span>
						</div>
					</div>
				</figure>
			</div>
		{/snippet}
	</Pinned>
</div>

<style>
	.wrap {
		height: 100%;
		display: grid;
		grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) auto;
		column-gap: clamp(32px, 4vw, 64px);
		row-gap: 20px;
		padding: 72px var(--gutter) 28px var(--rail);
	}
	.left {
		grid-row: 1 / 3;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 24px;
		min-height: 0;
	}
	.lede {
		margin-top: 18px;
		max-width: 30ch;
		font-size: 15px;
		line-height: 1.4;
		color: var(--ink-2);
	}

	/* ── readouts ── */
	.readouts {
		margin: 0;
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 16px 18px;
		border-top: 1px solid var(--ink);
		padding-top: 14px;
	}
	.readouts > div {
		min-width: 0;
	}
	dt {
		color: var(--ink-2);
		font-size: 10px;
		display: flex;
		justify-content: space-between;
		gap: 8px;
		white-space: nowrap;
	}
	dd {
		margin: 2px 0 0;
		font-variant-numeric: tabular-nums;
	}
	.clock,
	.gauge {
		grid-column: 1 / -1;
	}
	.big {
		font-size: clamp(64px, 7.4vw, 116px);
		font-stretch: 62%;
		font-weight: 800;
		line-height: 0.86;
		letter-spacing: -0.01em;
	}
	.num {
		font-size: 32px;
		font-stretch: 70%;
		font-weight: 700;
		line-height: 1;
	}
	.num span {
		color: var(--ink-2);
		font-weight: 500;
		font-size: 20px;
	}
	.gauge em {
		font-style: normal;
		color: var(--accent);
	}
	.gauge .val {
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.gauge svg {
		display: block;
		width: 100%;
		height: 26px;
		margin-top: 4px;
	}
	.scale {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		font-size: 9.5px;
		color: var(--ink-2);
		margin-top: 2px;
	}
	.scale i {
		font-style: normal;
	}
	.scale i:last-child {
		text-align: right;
		white-space: nowrap;
	}
	.hair {
		stroke: var(--ink);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.over {
		fill: none;
		stroke: var(--rule);
		vector-effect: non-scaling-stroke;
	}
	.bar {
		fill: var(--accent);
	}
	.limit {
		stroke: var(--ink);
		stroke-width: 1;
		stroke-dasharray: 3 3;
		vector-effect: non-scaling-stroke;
	}

	/* ── site plan / facts ── */
	.cell {
		position: relative;
		min-height: 0;
		container-type: size;
	}
	.plan {
		position: absolute;
		top: 50%;
		left: 0;
		translate: 0 -50%;
		margin: 0;
		width: min(100cqw, 100cqh * 1.617);
		aspect-ratio: 760 / 470;
		will-change: opacity, transform;
	}
	.plan svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	.curb {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.25;
		vector-effect: non-scaling-stroke;
	}
	.paint {
		fill: none;
		stroke: var(--ink-2);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.dash {
		stroke: var(--ink-2);
		stroke-width: 1;
		stroke-dasharray: 8 6;
		vector-effect: non-scaling-stroke;
	}
	.board {
		fill: var(--ink);
	}
	.post {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.floor {
		fill: var(--paper-2);
	}
	.wall {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2.5;
		vector-effect: non-scaling-stroke;
	}
	.win {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.zone {
		fill: none;
		stroke: var(--ink-2);
		stroke-width: 1;
		stroke-dasharray: 3 3;
		vector-effect: non-scaling-stroke;
	}
	.crew {
		fill: var(--paper);
		stroke: var(--ink-2);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.crew.on {
		fill: var(--ink);
		stroke: var(--ink);
	}
	.crew.on.out {
		stroke: var(--paper);
		stroke-width: 2;
	}
	.car rect {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1.25;
		vector-effect: non-scaling-stroke;
	}
	.car path {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.car.timed rect {
		fill: var(--accent);
		stroke: var(--accent);
	}
	.car.timed path {
		stroke: var(--paper);
	}
	.lbl {
		position: absolute;
		font-size: 10px;
		white-space: nowrap;
		transform: translateY(-50%);
	}
	.lbl.dim {
		color: var(--ink-2);
	}

	.facts {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		will-change: opacity, transform;
	}
	.cap {
		color: var(--accent);
		margin-bottom: 12px;
	}
	.cap span {
		color: var(--ink-2);
	}
	table {
		width: 100%;
		max-width: 780px;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	th {
		text-align: left;
		font-weight: 400;
		font-size: 10.5px;
		color: var(--ink-2);
		padding: 0 8px 8px 0;
		border-bottom: 1px solid var(--ink);
	}
	td {
		padding: 12px 8px 12px 0;
		border-bottom: 1px solid var(--rule);
		vertical-align: baseline;
	}
	td b {
		display: block;
		font-weight: 620;
		font-stretch: 85%;
		font-size: 19px;
		line-height: 1.15;
	}
	td span {
		color: var(--ink-2);
		font-size: 10px;
	}
	td.v {
		font-size: clamp(22px, 2.6vw, 34px);
		font-stretch: 70%;
		font-weight: 760;
		white-space: nowrap;
		width: 13%;
	}
	td.u {
		color: var(--ink-2);
		font-size: 10.5px;
		white-space: nowrap;
	}

	/* ── day strip ── */
	.strip {
		margin: 0;
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr);
		align-items: end;
		min-width: 0;
	}
	.rl {
		font-size: 9.5px;
		color: var(--ink-2);
		padding-bottom: 22px;
	}
	.plot {
		position: relative;
		min-width: 0;
	}
	.plot svg {
		display: block;
		width: 100%;
		overflow: visible;
	}
	.peak {
		fill: var(--paper-2);
	}
	.tick {
		stroke: var(--ink);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.arr {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.25;
		vector-effect: non-scaling-stroke;
	}
	.cursor {
		stroke: var(--accent);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	.axis {
		position: relative;
		height: 16px;
		margin-top: 4px;
		font-size: 9.5px;
		color: var(--ink-2);
	}
	.axis span {
		position: absolute;
		transform: translateX(-50%);
		white-space: nowrap;
	}
	.axis span:first-child {
		transform: none;
	}
	.axis span:nth-last-child(2) {
		transform: translateX(-100%);
	}
	.axis .pk {
		top: -52px;
		color: var(--ink);
	}

	@media (max-width: 820px) {
		.wrap {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto auto minmax(0, 1fr) auto;
			row-gap: 12px;
			padding-top: 56px;
			padding-bottom: 18px;
		}
		.left {
			display: contents;
		}
		.lede {
			display: none;
		}
		.readouts {
			grid-template-columns: 1fr 1fr 1fr;
			align-items: end;
			gap: 8px 12px;
			padding-top: 10px;
		}
		.big {
			font-size: 50px;
		}
		.num {
			font-size: 24px;
		}
		.num span {
			font-size: 15px;
		}
		dt {
			font-size: 9px;
		}
		.lbl {
			font-size: 8px;
		}
		.lbl.dim,
		.lbl.opt {
			display: none;
		}
		.strip {
			grid-template-columns: 0 minmax(0, 1fr);
		}
		.rl {
			visibility: hidden;
		}
		.facts {
			justify-content: flex-start;
		}
		.cap {
			margin-bottom: 6px;
		}
		.cap span,
		td span {
			display: none;
		}
		th {
			padding-bottom: 4px;
		}
		td {
			padding: 6px 6px 6px 0;
		}
		td b {
			font-size: 14px;
		}
		td.v {
			font-size: 19px;
		}
	}
</style>
