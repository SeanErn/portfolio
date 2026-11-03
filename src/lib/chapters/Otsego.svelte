<script lang="ts">
	/**
	 * J5 · Otsego Public Schools — the USB keystroke tool, as a short product-shot sequence.
	 *
	 *   0.00–0.32  setup screen, typed BY HAND (slow, ×1); camera pulls back 0.10–0.28 to an open
	 *              Chromebook floating at a 3/4 angle; the hand-enrolled counter ticks slowly
	 *   0.27–0.32  the Arduino HID dongle slides into the side port, port LED lights
	 *   0.33–0.41  the tool finishes enrollment almost instantly (×12) → "Enrolled"
	 *   0.43–0.50  dongle out, lid closes
	 *   0.50–0.64  it stands on edge and drops into the cart next to the hand-enrolled ones
	 *   0.64–0.74  the cart fills fast, each charge LED lights
	 *   0.74–0.90  zoom out to a yard of carts filling; counter → 2,200+
	 *
	 * The Chromebook is built from DOM planes with CSS 3D transforms (no WebGL). Every frame is a pure
	 * function of p and the stage size. Keystrokes, asset ID, timings and carts are illustrative.
	 */
	import Pinned from '../kit/Pinned.svelte';
	import ChapterHead from '../kit/ChapterHead.svelte';
	import { chapters, otsego as data } from '../content';
	import { clamp, seg, lerp, ease } from '../kit/motion';

	const ref = chapters.find((c) => c.id === 'otsego')!.ref;
	const { devices: N, schools: S, weeks: WEEKS, team: TEAM, speedup: X } = data.stats;
	const fmt = (n: number) => n.toLocaleString('en-US');

	let sw = $state(1440);
	let sh = $state(900);

	// ── Model (px, model space; hinge line at y = 0, base extends toward the viewer) ──────────────
	const W = 1000; // width
	const H = 640; // lid height
	const D = 660; // base depth
	const TB = 30; // base thickness
	const TL = 14; // lid thickness
	const SW = 948; // screen
	const SH = 570;
	const OPEN = 16; // lid leans back 16° past vertical
	const R_SCREEN = 40 + SH / 2; // hinge → screen centre along the lid

	// ── The keystroke script (illustrative) ────────────────────────────────────────────────────────
	const EMAIL = 'enroll@otsegops.org';
	const ASSET = 'A-04187';
	const LOC = 'School 3';
	type Ev = { key: string; w: number; step?: number; field?: 'email' | 'pass' | 'asset' | 'loc'; wait?: boolean };
	const EVENTS: Ev[] = [
		{ key: 'Ctrl+Alt+E', w: 3, step: 1 },
		...[...EMAIL].map((c): Ev => ({ key: c, w: 1, field: 'email' })),
		{ key: 'Enter', w: 2, step: 2 },
		...Array.from({ length: 10 }, (): Ev => ({ key: '•', w: 1, field: 'pass' })),
		{ key: 'Enter', w: 2, step: 3 },
		{ key: '', w: 12, step: 4, wait: true },
		...[...ASSET].map((c): Ev => ({ key: c, w: 1, field: 'asset' })),
		{ key: 'Tab', w: 1.5 },
		...[...LOC].map((c): Ev => ({ key: c, w: 1, field: 'loc' })),
		{ key: 'Enter', w: 3, step: 5 }
	];
	const TOTAL_W = EVENTS.reduce((s, e) => s + e.w, 0);
	/** Weight typed by hand before the tool is plugged in: through the first Enter (email done). */
	const KM = 3 + EMAIL.length + 2;
	const PLUG_A = 0.27;
	const PLUG_B = 0.32;
	const TOOL_A = 0.33;
	const TOOL_B = 0.41;
	const HAND_DONE = 3; // devices finished by hand before this one (illustrative)

	function setup(p: number) {
		const k = p < TOOL_A ? KM * seg(p, 0.02, PLUG_A + 0.03) : KM + (TOTAL_W - KM) * seg(p, TOOL_A, TOOL_B);
		const st = { step: 0, email: '', pass: '', asset: '', loc: '', focus: 'email', wait: 0, keys: [] as string[] };
		let acc = 0;
		for (const e of EVENTS) {
			if (e.wait) {
				if (k > acc) st.wait = clamp((k - acc) / e.w);
				if (k < acc + e.w) break;
				acc += e.w;
				if (e.step !== undefined) st.step = e.step;
				st.focus = 'asset';
				continue;
			}
			acc += e.w;
			if (k < acc) break;
			if (e.step !== undefined) st.step = e.step;
			if (e.field) st[e.field] += e.key;
			if (e.key === 'Tab') st.focus = 'loc';
			if (e.field === 'pass' || e.step === 2) st.focus = 'pass';
			st.keys.push(e.key);
		}
		return st;
	}
	const TITLES = ['Welcome', 'Enterprise enrollment', 'Enterprise enrollment', 'Enrolling device', 'Device details', 'Enrolled'];
	const SUBS = [
		'Let’s get this device set up.',
		'This device will be managed by your organization. Sign in with an enrollment account.',
		`Signing in as ${EMAIL}`,
		'Applying your organization’s policies. This can take a minute.',
		'Saved with the device record: the asset ID on its tag, and where it lives.',
		'This device is managed by your organization.'
	];

	// ── Camera / rig keyframes ──────────────────────────────────────────────────────────────────
	type Rig = { px: number; py: number; s: number; az: number; ax: number; ay: number; sz: number; o: [number, number, number]; lid: number };
	const mix = (a: number, b: number, t: number) => lerp(a, b, t);

	function layout(w: number, h: number) {
		const mobile = w < 821;
		const sA = mobile ? w / 760 : Math.max(w / SW, h / SH) * 1.02;
		const hero = mobile
			? { x: w * 0.36, y: h * 0.45, s: (w * 0.58) / W }
			: { x: w * 0.6, y: h * 0.56, s: Math.min(w * 0.34, h * 0.54) / W };
		const cw = mobile ? w * 0.9 : Math.min(600, w * 0.44);
		const cart = { cx: mobile ? w / 2 : w * 0.6, cy: mobile ? (228 + h - 150) / 2 - 12 : h * 0.53, w: cw, k: cw / 600 };
		// the yard of carts revealed by the final zoom-out (cart 1 sits in the middle cell)
		const cols = mobile ? 3 : 9;
		const rows = 5;
		const pitchX = cw * 1.16;
		const pitchY = cw * 0.6 * 1.3;
		const area = mobile
			? { x: w / 2, y: (228 + h - 150) / 2, w: w - 32, h: h - 150 - 228 - 24 }
			: { x: (w + (w > 820 ? 88 : 16)) / 2 - 22, y: h * 0.57, w: w - 160, h: h * 0.56 };
		const zf = Math.min(area.w / (cols * pitchX), area.h / (rows * pitchY));
		const yard = { cols, rows, pitchX, pitchY, area, zf };
		return { mobile, sA, hero, cart, yard };
	}

	function rigAt(p: number, L: ReturnType<typeof layout>, w: number, h: number): Rig {
		const scr: [number, number, number] = [0, -R_SCREEN * Math.cos((OPEN * Math.PI) / 180), -R_SCREEN * Math.sin((OPEN * Math.PI) / 180)];
		const mid: [number, number, number] = [0, -150, 200];
		const closed: [number, number, number] = [0, (TB - TL) / 2, D / 2];
		const z = ease(seg(p, 0.1, 0.28)); // zoom out
		const c = ease(seg(p, 0.43, 0.5)); // lid
		const d1 = ease(seg(p, 0.5, 0.55)); // stand on edge
		const d2 = ease(seg(p, 0.54, 0.6)); // shrink, move above its slot
		const d3 = ease(seg(p, 0.595, 0.63)); // drop in
		const bob = Math.sin(seg(p, 0.1, 0.52) * Math.PI) * -10; // drifts up a touch while floating
		const slot = { x: L.cart.cx - 300 * L.cart.k + (slotX(HAND_DONE) + 18) * L.cart.k, y: L.cart.cy - 180 * L.cart.k + 104 * L.cart.k };
		const sDock = (100 * L.cart.k) / W;
		const pivA = scr.map((v, i) => mix(v, mid[i], z)) as [number, number, number];
		const piv = pivA.map((v, i) => mix(v, closed[i], ease(seg(p, 0.44, 0.52)))) as [number, number, number];
		return {
			px: mix(mix(w / 2, L.hero.x, z), slot.x, d2),
			py: mix(mix(mix(L.mobile ? h * 0.42 : h / 2, L.hero.y + bob, z), slot.y - 150 * L.cart.k, d2), slot.y, d3),
			s: mix(mix(mix(L.sA, L.hero.s, z), L.hero.s * 0.75, d1), sDock, d2),
			az: mix(mix(0, -5, z), 0, d1),
			ax: mix(mix(-OPEN, -27, z), -6, d1),
			ay: mix(mix(0, -32, z), -22, d1),
			sz: mix(0, 90, d1),
			o: piv,
			lid: mix(OPEN, -90, c)
		};
	}
	const rigCss = (r: Rig) =>
		`translate(${r.px.toFixed(2)}px, ${r.py.toFixed(2)}px) scale(${r.s.toFixed(4)}) rotateZ(${r.az.toFixed(2)}deg) rotateX(${r.ax.toFixed(2)}deg) rotateY(${r.ay.toFixed(2)}deg) rotateZ(${r.sz.toFixed(2)}deg) translate3d(${-r.o[0]}px, ${(-r.o[1]).toFixed(2)}px, ${(-r.o[2]).toFixed(2)}px)`;

	// ── Cart: 2 shelves × 15 slots (svg units, viewBox 600 × 360) ──────────────────────────────
	const COLS = 15;
	const SLOTS = Array.from({ length: COLS * 2 }, (_, i) => ({ i, r: Math.floor(i / COLS), c: i % COLS }));
	const slotX = (c: number) => 30 + c * 36;
	const shelfY = (r: number) => (r === 0 ? 50 : 200);
	/** Slots 0..2 hold the hand-enrolled devices, slot 3 is the hero, the rest fill fast. */
	const slabIn = (p: number, i: number) =>
		i < HAND_DONE ? 1 : i === HAND_DONE ? ease(seg(p, 0.625, 0.64)) : ease(seg(p, 0.64 + (i - HAND_DONE - 1) * 0.0032, 0.658 + (i - HAND_DONE - 1) * 0.0032));
	const ZOOM_A = 0.74;
	const ZOOM_B = 0.87;
	const DONE = 0.9;

	/** Other carts in the yard: start filling by distance from cart 1. */
	function yardCarts(cols: number, rows: number) {
		const cc = (cols - 1) / 2, rc = (rows - 1) / 2;
		const list = [];
		for (let r = 0; r < rows; r++)
			for (let c = 0; c < cols; c++) {
				if (c === cc && r === rc) continue;
				list.push({ c: c - cc, r: r - rc, d: Math.hypot(c - cc, (r - rc) * 1.4) });
			}
		const max = Math.max(...list.map((x) => x.d));
		return list.map((x) => ({ ...x, a: 0.75 + (x.d / max) * 0.1 }));
	}
	const YARD_D = yardCarts(9, 5);
	const YARD_M = yardCarts(3, 5);
	function slabPath(n: number) {
		let d = '';
		for (let i = 0; i < n; i++) {
			const x = slotX(i % COLS) + 7, y = shelfY(Math.floor(i / COLS));
			d += `M${x} ${y}h22v108h-22Z`;
		}
		return d;
	}
	function ledPath(n: number) {
		let d = '';
		for (let i = 0; i < n; i++) {
			const x = slotX(i % COLS) + 18, y = shelfY(Math.floor(i / COLS)) + 119;
			d += `M${x - 3.2} ${y}a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0`;
		}
		return d;
	}

	const devicesAt = (p: number, plugged: number) =>
		p < TOOL_B ? Math.floor(HAND_DONE * seg(p, 0.04, 0.3) + 0.0001) : p < 0.625 ? HAND_DONE + 1 : p < ZOOM_A ? plugged : lerp(30, N, seg(p, ZOOM_A, DONE) ** 1.3);
	const ZP = 300; // side port, distance from the hinge

	// Keyboard keys on the deck (static)
	const KEYS = Array.from({ length: 5 }, (_, r) =>
		Array.from({ length: 13 }, (_, c) => ({ x: 120 + c * 60, y: 70 + r * 58, w: r === 4 && c === 6 ? 52 : 52 }))
	).flat();

	const facts = [
		{ v: '2,200+', k: 'Chromebooks deployed' },
		{ v: String(S), k: 'schools' },
		{ v: String(WEEKS), k: 'weeks' },
		{ v: String(TEAM), k: 'person IT team' },
		{ v: `${X}×`, k: 'faster enrollment, Arduino keystroke tool' },
		{ v: 'All', k: 'asset-tagged + logged to inventory DB' }
	];
</script>

{#snippet cartFrame()}
	<rect x="12" y="22" width="576" height="312" class="frame" />
	<line x1="12" x2="588" y1="40" y2="40" class="thin" />
	<rect x="588" y="80" width="8" height="160" class="frame" />
	{#each [0, 1] as row}
		{#each Array(COLS + 1) as _, c}
			<line x1={slotX(c)} x2={slotX(c)} y1={shelfY(row) + 14} y2={shelfY(row) + 112} class="thin" />
		{/each}
		<rect x="22" y={shelfY(row) + 112} width="556" height="14" class="floor" />
	{/each}
	<circle cx="70" cy="344" r="12" class="frame" />
	<circle cx="530" cy="344" r="12" class="frame" />
{/snippet}

<div class="chapter" id="otsego" data-chapter="otsego">
	<Pinned length={190}>
		{#snippet children(p)}
			{@const L = layout(sw, sh)}
			{@const r = rigAt(p, L, sw, sh)}
			{@const st = setup(p)}
			{@const headO = ease(seg(p, 0.2, 0.28))}
			{@const rigO = 1 - ease(seg(p, 0.625, 0.64))}
			{@const cartO = ease(seg(p, 0.53, 0.59))}
			{@const shadowO = ease(seg(p, 0.16, 0.28)) * (1 - ease(seg(p, 0.48, 0.53)))}
			{@const keysO = 1 - ease(seg(p, 0.41, 0.44))}
			{@const tool = p >= PLUG_B}
			{@const dIn = ease(seg(p, PLUG_A, PLUG_B))}
			{@const dOut = ease(seg(p, 0.43, 0.47))}
			{@const dOff = (1 - dIn) * 240 + dOut * 240}
			{@const dongleO = Math.min(ease(seg(p, PLUG_A - 0.02, PLUG_A + 0.01)), 1 - dOut)}
			{@const yz = ease(seg(p, ZOOM_A, ZOOM_B))}
			{@const Y = L.yard}
			{@const ys = lerp(1, Y.zf, yz)}
			{@const kz = ease(seg(p, 0.1, 0.28))}
			{@const plugged = SLOTS.filter((sl) => slabIn(p, sl.i) > 0.97).length}
			{@const n = devicesAt(p, plugged)}
			<div class="stage" bind:clientWidth={sw} bind:clientHeight={sh}>
				<!-- contact shadow (screen space, under the floating laptop) -->
				<div
					class="shadow"
					style:opacity={shadowO * 0.3}
					style:transform="translate({r.px}px, {L.hero.y + L.hero.s * 560}px) translate(-50%, -50%) scale({L.hero.s * 1.05}, {L.hero.s * 0.12})"
				></div>

				<!-- the Chromebook -->
				<div class="scene" style:opacity={rigO} aria-hidden="true">
					<div class="rig" style:transform={rigCss(r)}>
						<!-- base -->
						<div class="face deck" style:width="{W}px" style:height="{D}px" style:transform="translate3d({-W / 2}px, 0px, 0px) rotateX(90deg)">
							<svg viewBox="0 0 {W} {D}" width={W} height={D}>
								<rect x="100" y="56" width="800" height="306" class="kb" />
								{#each KEYS as key}
									<rect x={key.x} y={key.y} width={key.w} height="46" rx="5" class="key" />
								{/each}
								<rect x="380" y="410" width="240" height="190" rx="10" class="kb" />
							</svg>
						</div>
						<div class="face edge" style:width="{W}px" style:height="{TB}px" style:transform="translate3d({-W / 2}px, 0px, {D}px)"></div>
						<div class="face edge" style:width="{D}px" style:height="{TB}px" style:transform="translate3d({W / 2}px, 0px, {D}px) rotateY(90deg)">
							<i class="port" style:left="{D - ZP - 18}px"></i>
							<i class="pled" class:on={tool && dOut < 0.5} style:left="{D - ZP + 34}px"></i>
						</div>
						<!-- Arduino keystroke tool: lies in the deck plane, USB-A plug slides into the side port -->
						<div
							class="face dongle"
							style:opacity={dongleO}
							style:transform="translate3d({W / 2 + 2 + dOff}px, {TB / 2}px, {ZP - 85}px) rotateX(90deg)"
						>
							<svg viewBox="0 0 320 170" width="320" height="170">
								<rect x="0" y="70" width="70" height="30" class="plug" />
								<path d="M70 85h22" class="dl" />
								<rect x="92" y="4" width="224" height="162" rx="10" class="board" />
								{#each Array(10) as _, i}
									<circle cx={112 + i * 20} cy="22" r="4" class="dl" />
									<circle cx={112 + i * 20} cy="148" r="4" class="dl" />
								{/each}
								<rect x="168" y="58" width="64" height="54" class="dl" />
								<text x="110" y="132" class="dtx">ARDUINO · HID</text>
								<circle cx="290" cy="60" r="7" class="dled" class:on={tool && dOut < 0.5} />
							</svg>
						</div>
						<div class="face edge" style:width="{D}px" style:height="{TB}px" style:transform="translate3d({-W / 2}px, 0px, {D}px) rotateY(90deg)"></div>
						<div class="face under" style:width="{W}px" style:height="{D}px" style:transform="translate3d({-W / 2}px, {TB}px, 0px) rotateX(90deg)"></div>

						<!-- lid, hinged at y = 0 -->
						<div class="lid" style:transform="rotateX({r.lid}deg)">
							<div class="face bezel" style:width="{W}px" style:height="{H}px" style:transform="translate3d({-W / 2}px, {-H}px, 0px)">
								<div class="screen" style:width="{SW}px" style:height="{SH}px">
									<p class="bar mono"><span>Device setup</span><span>Network · connected</span></p>
									<div class="body">
										<div class="col">
											{#if st.step === 5}
												<svg class="ico ok" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" /><path d="M19 33l9 9 18-20" /></svg>
											{:else}
												<svg class="ico" viewBox="0 0 64 64"><path d="M8 56V26L32 10l24 16v30M8 56h48M24 56V38h16v18" /></svg>
											{/if}
											<h3 class:done={st.step === 5}>{TITLES[st.step]}</h3>
											<p class="sub">{SUBS[st.step]}</p>
										</div>
										<div class="col fields">
											{#if st.step === 0}
												<div class="row"><span class="mono">Language</span><b>English (US)</b></div>
												<div class="row"><span class="mono">Keyboard</span><b>US</b></div>
												<div class="row"><span class="mono">Network</span><b>Connected</b></div>
											{:else if st.step === 1}
												<span class="mono lbl">Email</span>
												<div class="input focus">{st.email}<i class="caret"></i></div>
											{:else if st.step === 2}
												<span class="mono lbl">Password</span>
												<div class="input focus">{st.pass}<i class="caret"></i></div>
											{:else if st.step === 3}
												<div class="progress"><i style:transform="scaleX({st.wait})"></i></div>
												<p class="mono small">Enrolling · {Math.round(st.wait * 100)}%</p>
											{:else if st.step === 4}
												<span class="mono lbl">Asset ID</span>
												<div class="input" class:focus={st.focus === 'asset'}>{st.asset}{#if st.focus === 'asset'}<i class="caret"></i>{/if}</div>
												<span class="mono lbl">Location</span>
												<div class="input" class:focus={st.focus === 'loc'}>{st.loc}{#if st.focus === 'loc'}<i class="caret"></i>{/if}</div>
											{:else}
												<div class="row"><span class="mono">Asset ID</span><b>{ASSET}</b></div>
												<div class="row"><span class="mono">Location</span><b>{LOC}</b></div>
												<div class="row"><span class="mono">Status</span><b class="hot">Managed</b></div>
											{/if}
										</div>
									</div>
									<div class="foot">
										<span class="dots">{#each Array(6) as _, i}<i class:on={i <= st.step}></i>{/each}</span>
										<span class="btns"><span class="btn">Back</span><span class="btn primary">{st.step === 0 ? 'Get started' : st.step === 5 ? 'Done' : 'Next'}</span></span>
									</div>
								</div>
							</div>
							<div class="face cover" style:width="{W}px" style:height="{H}px" style:transform="translate3d({W / 2}px, {-H}px, {-TL}px) rotateY(180deg)">
								<div class="tag">
									<span class="mono">Asset</span>
									<b class="mono">{ASSET}</b>
									<svg viewBox="0 0 120 26" preserveAspectRatio="none">
										{#each [2, 6, 8, 13, 15, 19, 24, 26, 31, 35, 37, 42, 47, 49, 53, 58, 60, 64, 69, 71, 76, 80, 83, 87, 92, 94, 99, 103, 106, 111, 115] as x, i}
											<rect x={x} y="0" width={i % 3 === 0 ? 2.4 : 1.2} height="26" />
										{/each}
									</svg>
								</div>
							</div>
							<div class="face edge" style:width="{W}px" style:height="{TL}px" style:transform="translate3d({-W / 2}px, {-H}px, 0px) rotateX(-90deg)"></div>
							<div class="face edge" style:width="{TL}px" style:height="{H}px" style:transform="translate3d({W / 2}px, {-H}px, 0px) rotateY(90deg)"></div>
						</div>
					</div>
				</div>

				<!-- carts: cart 1 up close, then the yard (clipped between the heading and the facts) -->
				<div class="yardclip"><div class="yardin">
				<div
					class="yard"
					style:transform="translate({lerp(L.cart.cx, Y.area.x, yz)}px, {lerp(L.cart.cy, Y.area.y, yz)}px) scale({ys}) translate({-L.cart.cx}px, {-L.cart.cy}px)"
				>
					{#each L.mobile ? YARD_M : YARD_D as yc}
						{@const nf = Math.floor(30 * seg(p, yc.a, yc.a + 0.05))}
						<svg
							class="cart other"
							viewBox="0 0 600 360"
							style:width="{L.cart.w}px"
							style:opacity={ease(seg(p, ZOOM_A - 0.01, ZOOM_A + 0.05))}
							style:transform="translate({L.cart.cx - L.cart.w / 2 + yc.c * Y.pitchX}px, {L.cart.cy - L.cart.w * 0.3 + yc.r * Y.pitchY}px)"
							aria-hidden="true"
						>
							{@render cartFrame()}
							<path d={slabPath(nf)} class="slab" />
							<path d={ledPath(nf)} class="led on" />
						</svg>
					{/each}
					<figure
						class="cart"
						style:opacity={cartO}
						style:width="{L.cart.w}px"
						style:transform="translate({L.cart.cx - L.cart.w / 2}px, {L.cart.cy - L.cart.w * 0.3}px) translateY({(1 - cartO) * 24}px)"
						aria-label="Charging cart filling with Chromebooks"
					>
						<svg viewBox="0 0 600 360">
							{@render cartFrame()}
							{#each SLOTS as sl}
								{@const e = slabIn(p, sl.i)}
								<circle cx={slotX(sl.c) + 18} cy={shelfY(sl.r) + 119} r="3.2" class="led" class:on={e > 0.97} />
								{#if e > 0}
									<g transform="translate(0 {(1 - e) * -150})" opacity={sl.i === HAND_DONE ? e : Math.min(1, e * 2)}>
										<rect x={slotX(sl.c) + 7} y={shelfY(sl.r)} width="22" height="108" rx="2" class="slab" />
										<line x1={slotX(sl.c) + 12} x2={slotX(sl.c) + 12} y1={shelfY(sl.r) + 4} y2={shelfY(sl.r) + 104} class="thin" />
									</g>
								{/if}
							{/each}
						</svg>
						<figcaption class="mono" style:opacity={1 - yz}>
							<span>Charging cart · {String(plugged).padStart(2, '0')}/30 plugged in</span><span class="dim">illustrative</span>
						</figcaption>
					</figure>
				</div>
				<p
					class="mono yardcap"
					style:opacity={ease(seg(p, ZOOM_B - 0.03, ZOOM_B + 0.02))}
					style:transform="translate({Y.area.x}px, {Y.area.y + (Y.rows * Y.pitchY * Y.zf) / 2 + 4}px) translateX(-50%)"
				>
					{Y.cols * Y.rows} carts shown · 30 slots each · illustrative
				</p>
				</div></div>

				<!-- copy layer -->
				<div class="copy">
					<div class="head" style:opacity={headO}>
						<ChapterHead {ref} org={data.org} role={data.role} when={data.when} where={data.where} compact />
					</div>

					<div class="count" style:opacity={L.mobile ? ease(seg(p, 0.5, 0.58)) : headO}>
						<p class="mono lab">Devices enrolled <b class="rate" class:hot={tool}>{tool ? `×${X} HID tool` : '×1 by hand'}</b></p>
						<p class="big">{p >= DONE ? '2,200+' : fmt(Math.floor(n))}</p>
					</div>

					<div
						class="keys"
						style:opacity={keysO}
						style:transform="translate({L.mobile ? sw / 2 : lerp(sw / 2, 0, kz)}px, {L.mobile ? lerp(sh - 150, sh - 250, kz) : lerp(sh - 112, sh * 0.6, kz)}px) translateX({L.mobile ? -50 : lerp(-50, 0, kz)}%)"
					>
						<p class="mono lab"><b class:hot={tool}>{tool ? `Arduino HID tool ×${X}` : 'Typed by hand ×1'}</b> <span>illustrative sequence</span></p>
						<p class="caps">
							{#each st.keys.slice(-6) as key, i (st.keys.length - st.keys.slice(-6).length + i)}
								<kbd class:now={i === Math.min(6, st.keys.length) - 1}>{key === ' ' ? 'Space' : key}</kbd>
							{:else}
								<kbd class="idle">—</kbd>
							{/each}
						</p>
					</div>

					<dl class="facts" style:opacity={headO}>
						{#each facts as f}
							<div><dt>{f.v}</dt><dd class="mono">{f.k}</dd></div>
						{/each}
					</dl>
				</div>
			</div>
		{/snippet}
	</Pinned>
</div>

<style>
	.stage {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	/* ── 3D Chromebook ── */
	.scene {
		position: absolute;
		inset: 0;
		perspective: 2400px;
		perspective-origin: 50% 50%;
		pointer-events: none;
	}
	.rig,
	.lid {
		position: absolute;
		left: 0;
		top: 0;
		width: 0;
		height: 0;
		transform-style: preserve-3d;
		transform-origin: 0 0;
	}
	.face {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: 0 0;
		backface-visibility: hidden;
		border: 2px solid var(--ink);
	}
	.edge,
	.under {
		backface-visibility: visible;
		background: var(--paper-2);
	}
	.deck {
		background: var(--paper-2);
		border-radius: 0 0 18px 18px;
		backface-visibility: visible;
	}
	.deck svg {
		display: block;
	}
	.kb {
		fill: none;
		stroke: var(--ink-2);
		stroke-width: 1.5;
	}
	.key {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	.bezel {
		background: var(--paper-2);
		border-radius: 18px 18px 4px 4px;
	}
	.cover {
		background: var(--paper-2);
		border-radius: 18px 18px 4px 4px;
	}
	.tag {
		position: absolute;
		left: 70px;
		top: 70px;
		width: 230px;
		padding: 14px 16px;
		border: 2px solid var(--ink);
		background: var(--paper);
		display: grid;
		gap: 6px;
	}
	.tag span {
		font-size: 16px;
		color: var(--ink-2);
	}
	.tag b {
		font-size: 26px;
		font-weight: 500;
		letter-spacing: 0.08em;
	}
	.tag svg {
		width: 100%;
		height: 34px;
		fill: var(--ink);
	}

	/* ── setup screen (948 × 570 design px) ── */
	.screen {
		position: absolute;
		left: 24px;
		top: 26px;
		background: var(--paper);
		border: 2px solid var(--ink);
		display: grid;
		grid-template-rows: auto 1fr auto;
		padding: 22px 34px 26px;
		color: var(--ink);
		overflow: hidden;
	}
	.bar {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		color: var(--ink-2);
	}
	.body {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 56px;
		align-items: start;
		padding: 46px 110px 0 120px;
	}
	.col {
		min-width: 0;
	}
	.ico {
		width: 56px;
		height: 56px;
		fill: none;
		stroke: var(--ink);
		stroke-width: 2.5;
		stroke-linejoin: round;
		margin-bottom: 18px;
	}
	.ico.ok {
		stroke: var(--accent);
	}
	h3 {
		font-size: 40px;
		font-stretch: 75%;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.005em;
	}
	h3.done {
		color: var(--accent);
	}
	.sub {
		margin-top: 14px;
		font-size: 17px;
		line-height: 1.35;
		color: var(--ink-2);
		max-width: 22ch;
	}
	.fields {
		display: grid;
		gap: 8px;
		padding-top: 74px;
		max-width: 340px;
	}
	.fields .lbl {
		font-size: 12px;
		color: var(--ink-2);
		margin-top: 6px;
	}
	.input {
		height: 50px;
		border: 2px solid var(--ink-2);
		padding: 0 14px;
		display: flex;
		align-items: center;
		font-family: var(--mono);
		font-size: 19px;
		white-space: nowrap;
		overflow: hidden;
	}
	.input.focus {
		border-color: var(--accent);
	}
	.caret {
		display: inline-block;
		width: 2px;
		height: 24px;
		margin-left: 2px;
		background: var(--accent);
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 10px 0;
		border-bottom: 1.5px solid var(--rule);
	}
	.row span {
		font-size: 12px;
		color: var(--ink-2);
	}
	.row b {
		font-size: 19px;
		font-weight: 560;
	}
	.row b.hot {
		color: var(--accent);
	}
	.progress {
		height: 10px;
		border: 2px solid var(--ink);
		margin-top: 16px;
		overflow: hidden;
	}
	.progress i {
		display: block;
		height: 100%;
		background: var(--accent);
		transform-origin: 0 0;
	}
	.small {
		font-size: 12px;
		color: var(--ink-2);
		margin-top: 8px;
	}
	.foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.dots {
		display: flex;
		gap: 8px;
	}
	.dots i {
		width: 10px;
		height: 10px;
		border: 2px solid var(--ink-2);
		border-radius: 50%;
	}
	.dots i.on {
		background: var(--ink);
		border-color: var(--ink);
	}
	.btns {
		display: flex;
		gap: 12px;
	}
	.btn {
		font-size: 16px;
		font-weight: 600;
		padding: 9px 20px;
		border: 2px solid var(--ink);
	}
	.btn.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--paper);
	}

	/* ── contact shadow ── */
	.shadow {
		position: absolute;
		left: 0;
		top: 0;
		width: 1000px;
		height: 1000px;
		border-radius: 50%;
		/* always darker than the paper, in both schemes (a shadow, never a glow) */
		background: color-mix(in srgb, var(--paper) 25%, black);
		filter: blur(60px);
		pointer-events: none;
	}

	/* ── Arduino dongle + side port ── */
	.dongle {
		border: 0;
		backface-visibility: visible;
	}
	.dongle svg {
		display: block;
		overflow: visible;
	}
	.plug {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 2;
	}
	.board {
		fill: var(--paper-2);
		stroke: var(--ink);
		stroke-width: 2.5;
	}
	.dl {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2;
	}
	.dtx {
		font-family: var(--mono);
		font-size: 15px;
		letter-spacing: 0.08em;
		fill: var(--ink-2);
	}
	.dled,
	.pled {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 2;
	}
	.dled.on {
		fill: var(--accent);
		stroke: var(--accent);
	}
	.port,
	.pled {
		position: absolute;
		top: 8px;
		height: 12px;
		border: 2px solid var(--ink);
		background: var(--paper);
	}
	.port {
		width: 36px;
	}
	.pled {
		width: 10px;
		height: 10px;
		top: 9px;
		border-radius: 50%;
	}
	.pled.on {
		background: var(--accent);
		border-color: var(--accent);
	}

	/* ── carts ── */
	.yardclip {
		position: absolute;
		inset: 232px 0 96px 0;
		overflow: hidden;
		pointer-events: none;
	}
	.yardin {
		position: absolute;
		left: 0;
		top: -232px;
	}
	.yard {
		position: absolute;
		left: 0;
		top: 0;
		width: 0;
		height: 0;
		transform-origin: 0 0;
	}
	.cart {
		position: absolute;
		left: 0;
		top: 0;
		margin: 0;
	}
	svg.cart {
		display: block;
		height: auto;
		overflow: visible;
	}
	.yardcap {
		position: absolute;
		left: 0;
		top: 0;
		font-size: 10px;
		color: var(--ink-2);
		white-space: nowrap;
	}
	.rate {
		font-weight: 400;
		margin-left: 8px;
		padding: 1px 6px;
		border: 1px solid var(--rule);
		color: var(--ink-2);
	}
	.rate.hot,
	.lab b.hot {
		border-color: var(--accent);
		color: var(--accent);
	}
	.lab b {
		font-weight: 500;
		color: var(--ink);
	}
	.cart svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.frame,
	.floor {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	.floor {
		fill: var(--paper-2);
	}
	.thin {
		stroke: var(--ink-2);
		stroke-width: 1;
	}
	.slab {
		fill: var(--paper-2);
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	.led {
		fill: var(--paper);
		stroke: var(--ink-2);
		stroke-width: 1;
	}
	.led.on {
		fill: var(--accent);
		stroke: var(--accent);
	}
	.cart figcaption {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		margin-top: 8px;
		font-size: 10px;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.dim {
		color: var(--ink-2);
	}

	/* ── copy layer ── */
	.copy {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.head {
		position: absolute;
		top: 72px;
		left: var(--rail);
		right: var(--gutter);
	}
	.count {
		position: absolute;
		top: 76px;
		right: var(--gutter);
		text-align: right;
	}
	.lab {
		font-size: 10px;
		color: var(--ink-2);
	}
	.lab span {
		margin-left: 10px;
		opacity: 0.8;
	}
	.big {
		font-size: clamp(52px, 6.4vw, 96px);
		font-stretch: 62%;
		font-weight: 800;
		line-height: 0.9;
		font-variant-numeric: tabular-nums;
		margin-top: 4px;
	}
	.keys {
		position: absolute;
		left: var(--rail);
		top: 0;
		left: 0;
		padding: 12px 14px;
		background: var(--paper);
		border: 1px solid var(--ink);
		max-width: calc(100vw - 32px);
	}
	.caps {
		display: flex;
		gap: 6px;
		margin-top: 8px;
		min-height: 34px;
	}
	kbd {
		font-family: var(--mono);
		font-size: 13px;
		min-width: 34px;
		height: 34px;
		padding: 0 9px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--ink);
		border-bottom-width: 3px;
		color: var(--ink);
		background: var(--paper-2);
		white-space: nowrap;
	}
	kbd.now {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--paper);
	}
	kbd.idle {
		color: var(--ink-2);
	}
	.facts {
		position: absolute;
		left: var(--rail);
		right: var(--gutter);
		bottom: 26px;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		border-top: 1px solid var(--ink);
	}
	.facts div {
		padding: 10px 14px 0 0;
		min-width: 0;
	}
	.facts dt {
		font-size: 30px;
		font-stretch: 62%;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.facts dd {
		margin: 4px 0 0;
		font-size: 9.5px;
		color: var(--ink-2);
		line-height: 1.35;
	}

	@media (min-width: 821px) {
		.keys {
			margin-left: var(--rail);
		}
	}

	@media (max-width: 820px) {
		.yardclip {
			inset: 228px 0 150px 0;
		}
		.yardin {
			top: -228px;
		}
		.head {
			top: 56px;
		}
		.count {
			top: 174px;
			left: var(--rail);
			right: auto;
			text-align: left;
			display: flex;
			align-items: baseline;
			gap: 12px;
		}
		.big {
			font-size: 40px;
		}
		.facts {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			bottom: 18px;
		}
		.facts div {
			padding: 8px 8px 6px 0;
		}
		.facts dt {
			font-size: 22px;
		}
		.facts dd {
			font-size: 8.5px;
		}
		.keys {
			padding: 10px 12px;
		}
		.lab span {
			display: block;
			margin: 2px 0 0;
		}
		kbd {
			font-size: 11px;
			min-width: 28px;
			height: 28px;
			padding: 0 6px;
		}
	}
</style>
