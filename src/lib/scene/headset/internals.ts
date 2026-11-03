import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ACCENT, inked, mat, roundedRect } from '../materials';
import { bendZ, mulberry32, smoothExtrude, type BuildCtx } from './shared';

/*
 * Quest 3 internals, front to back (after the iFixit teardown / chip ID, Oct 2023):
 *   blower fan + arched fin stack  ->  goalpost-shaped logic board (XR2 Gen 2 + LPDDR5 under one
 *   shield fence, Wi-Fi under its own can)  ->  flat 19.44 Wh battery pack with screw ears  ->
 *   two LCD panels riding on two pancake-lens modules (rails + lead screw + IPD wheel under the
 *   left eye)  ->  rubber lens shroud, facial-interface frame and foam cushion with a nose gap.
 */

// local materials, same restrained palette as ../materials
const metal = new THREE.MeshStandardMaterial({ color: '#b6b4ad', roughness: 0.45, metalness: 0.3 });
const cell = new THREE.MeshStandardMaterial({ color: '#2a2a28', roughness: 0.75 });
const optic = new THREE.MeshStandardMaterial({ color: '#5a5954', roughness: 0.6 });
const lensGlass = new THREE.MeshStandardMaterial({ color: '#202427', roughness: 0.12, metalness: 0.55 });
const ringMat = new THREE.LineBasicMaterial({ color: '#77756e', transparent: true, opacity: 0.55 });

type V2 = [number, number];
const TAU = Math.PI * 2;

/** Polar-sampled superellipse (even spacing all round), optionally remapped point by point. */
function superellipse(a: number, b: number, p: number, n: number, f?: (x: number, y: number) => V2): V2[] {
	const pts: V2[] = [];
	for (let i = 0; i < n; i++) {
		const t = (i / n) * TAU;
		const c = Math.cos(t);
		const s = Math.sin(t);
		const r = (Math.abs(c / a) ** p + Math.abs(s / b) ** p) ** (-1 / p);
		pts.push(f ? f(r * c, r * s) : [r * c, r * s]);
	}
	return pts;
}

/** Pancake-lens outline: a squarish circle with the lower nasal corner cut away for the nose. */
function lensOutline(r: number, cut: number, side: number, dx = 0, n = 64): V2[] {
	const nx = -side * Math.SQRT1_2;
	const ny = -Math.SQRT1_2;
	return superellipse(r, r, 2.4, n, (x, y) => {
		const k = x * nx + y * ny;
		if (k > cut) [x, y] = [x - (k - cut) * nx, y - (k - cut) * ny];
		return [x + dx, y];
	});
}

/** Facial-interface outline: wide rounded goggle with the nose arch pushed up from the bottom. */
function goggle(a: number, b: number, cy: number, noseH: number, n = 128): V2[] {
	return superellipse(a, b, 3.2, n, (x, y) => {
		if (y < 0) y += noseH * Math.exp(-2 * (x / 0.3) ** 2) * Math.min(1, (-y / b) * 1.5);
		return [x, y + cy];
	});
}

const v2 = (pts: V2[]) => pts.map(([x, y]) => new THREE.Vector2(x, y));
const circle = (x: number, y: number, r: number) => new THREE.Path().absarc(x, y, r, 0, TAU, true);

/** Crisp, centered extrusion for machined / molded parts. */
function slab(shape: THREE.Shape, depth: number, bevel = 0, curveSegments = 12) {
	const g = new THREE.ExtrudeGeometry(shape, {
		depth,
		curveSegments,
		bevelEnabled: bevel > 0,
		bevelThickness: bevel,
		bevelSize: bevel,
		bevelSegments: 2
	});
	g.deleteAttribute('uv');
	g.translate(0, 0, -depth / 2);
	return g;
}

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, parent?: THREE.Object3D) {
	o.position.set(x, y, z);
	parent?.add(o);
	return o;
}

/** Fan, logic board, battery, displays + pancake lens modules, facial interface. Anchors: soc, lens. */
export function buildInternals({ part, anchor }: BuildCtx) {
	// =====================================================================
	// logic board: wide "goalpost" outline, tab on top, notch over the nose
	// =====================================================================
	const board = new THREE.Group();
	const BT = 0.035; // board thickness
	const top = BT / 2;
	const outline: V2[] = [
		[-0.97, -0.44], [-0.62, -0.44], [-0.62, -0.2], [-0.58, -0.16], [0.58, -0.16], [0.62, -0.2],
		[0.62, -0.44], [0.97, -0.44], [1.0, -0.41], [1.0, 0.22], [0.96, 0.26], [0.58, 0.26],
		[0.5, 0.34], [0.5, 0.42], [0.46, 0.46], [-0.46, 0.46], [-0.5, 0.42], [-0.5, 0.34],
		[-0.58, 0.26], [-0.96, 0.26], [-1.0, 0.22], [-1.0, -0.41]
	];
	const boardShape = new THREE.Shape(v2(outline));
	for (const [x, y] of [[-0.4, 0.41], [0.4, 0.41], [-0.9, 0.16], [0.9, 0.16], [-0.92, -0.3], [0.92, -0.3], [0.08, -0.07]])
		boardShape.holes.push(circle(x, y, 0.028));
	board.add(inked(slab(boardShape, BT, 0, 8), mat.pcb, { hull: 0.008, crease: 30 }));

	const comp = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, hull = 0) =>
		at(inked(new THREE.BoxGeometry(w, h, d), m, { hull, crease: 30 }), x, y, top + d / 2, board);

	// SoC + LPDDR5 side by side inside one shield fence (lid removed)
	const SOC = { x: 0.17, y: 0.2 };
	const fence = roundedRect(0.64, 0.38, 0.02);
	fence.holes.push(roundedRect(0.6, 0.34, 0.012, new THREE.Path()));
	at(inked(slab(fence, 0.04), metal, { hull: 0, crease: 30 }), 0.04, 0.2, top + 0.02, board);
	const soc = comp(0.25, 0.25, 0.045, mat.accent, SOC.x, SOC.y, 0.006);
	const die = inked(new THREE.BoxGeometry(0.15, 0.15, 0.01), mat.accent, { hull: 0, crease: 20 });
	at(die, 0, 0, 0.026, soc);
	comp(0.22, 0.25, 0.035, mat.chip, -0.11, 0.2); // RAM
	// Wi-Fi 6E module under its own can, coax antenna sockets beside it
	comp(0.36, 0.3, 0.04, metal, 0.66, 0.02);
	for (const x of [0.6, 0.71]) {
		const coax = new THREE.CylinderGeometry(0.022, 0.022, 0.03, 12).rotateX(Math.PI / 2);
		at(inked(coax, metal, { hull: 0, crease: 40 }), x, 0.215, top + 0.015, board);
	}
	// two tall electrolytic caps (the "100 VFT" cans)
	for (const [x, y] of [[-0.66, 0.12], [0.72, -0.28]]) {
		const can = inked(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 20).rotateX(Math.PI / 2), metal, {
			hull: 0.005,
			crease: 40
		});
		at(can, x, y, top + 0.045, board);
	}
	// board-to-board / flex connectors along the edges and smaller ICs
	comp(0.05, 0.3, 0.025, mat.dark, -0.9, -0.08);
	comp(0.05, 0.28, 0.025, mat.dark, 0.92, -0.12);
	comp(0.28, 0.045, 0.025, mat.dark, -0.78, -0.39);
	comp(0.26, 0.045, 0.025, mat.dark, 0.82, -0.4);
	comp(0.3, 0.04, 0.025, mat.dark, -0.15, 0.42);
	for (const [x, y, w, h] of [
		[-0.4, 0.05, 0.14, 0.14],
		[-0.72, -0.15, 0.12, 0.1],
		[0.36, -0.06, 0.12, 0.1],
		[-0.2, -0.07, 0.1, 0.08],
		[-0.38, -0.32, 0.1, 0.1],
		[0.4, -0.33, 0.08, 0.08]
	])
		comp(w, h, 0.025, mat.chip, x, y);

	// Manhattan traces fanning out of the SoC fence, kept on the board
	const onBoard = (x: number, y: number) =>
		Math.abs(x) < 0.96 && y > -0.42 && y < (Math.abs(x) < 0.46 ? 0.44 : 0.24) && !(Math.abs(x) < 0.64 && y < -0.14);
	const tr: number[] = [];
	const rnd = mulberry32(7);
	const tz = top + 0.001;
	for (let i = 0; i < 40; i++) {
		const side = i % 4;
		const t = (rnd() - 0.5) * 0.3;
		const sx = 0.04 + (side === 0 ? 0.33 : side === 1 ? -0.33 : t * 1.8);
		const sy = 0.2 + (side === 2 ? 0.2 : side === 3 ? -0.2 : t);
		const len = 0.12 + rnd() * 0.5;
		const ex = side === 0 ? sx + len : side === 1 ? sx - len : sx;
		const ey = side === 2 ? sy + len * 0.3 : side === 3 ? sy - len * 0.6 : sy;
		const kx = ex + (side < 2 ? 0 : (rnd() - 0.5) * 0.6);
		const ky = ey + (side < 2 ? (rnd() - 0.5) * 0.5 : 0);
		if (![[sx, sy], [ex, ey], [kx, ky]].every(([x, y]) => onBoard(x, y))) continue;
		tr.push(sx, sy, tz, ex, ey, tz, ex, ey, tz, kx, ky, tz);
	}
	board.add(
		new THREE.LineSegments(
			new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tr, 3)),
			new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.6 })
		)
	);
	board.position.set(0, 0, 0.1);
	part(board, [0, 1.15, 0.5]);
	anchor('soc', board, SOC.x, SOC.y + 0.13, 0.08);

	// =====================================================================
	// thermal: heat spreader on the SoC, blower fan, arched fin stack on top
	// =====================================================================
	const thermal = new THREE.Group();
	const F = { x: -0.06, y: -0.04 };
	at(inked(slab(roundedRect(0.86, 0.7, 0.06), 0.014), metal, { hull: 0.006, crease: 30 }), 0.04, 0.07, -0.065, thermal);

	// blower housing: growing scroll with the outlet pointing up into the fins
	const scroll: V2[] = [];
	for (let i = 0; i <= 40; i++) {
		const t = Math.PI + (i / 40) * (Math.PI + 0.62);
		const r = 0.3 + 0.07 * (i / 40);
		scroll.push([r * Math.cos(t), r * Math.sin(t)]);
	}
	scroll.push([0.33, 0.42], [-0.3, 0.42]);
	const housing = new THREE.Shape(v2(scroll));
	housing.holes.push(circle(0, 0, 0.21));
	const fan = new THREE.Group();
	fan.add(inked(slab(housing, 0.09, 0, 24), mat.dark, { hull: 0.008, crease: 30 }));
	at(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.01, 32).rotateX(Math.PI / 2), mat.dark), 0, 0, -0.04, fan);
	const blades: THREE.BufferGeometry[] = [];
	for (let i = 0; i < 23; i++) {
		const a = (i / 23) * TAU;
		const g = new THREE.BoxGeometry(0.12, 0.012, 0.07).rotateZ(a + 0.45);
		g.translate(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0);
		blades.push(g);
	}
	fan.add(inked(mergeGeometries(blades), mat.chip, { hull: 0, crease: 30 }));
	const hub = new THREE.CylinderGeometry(0.085, 0.085, 0.075, 28).rotateX(Math.PI / 2);
	fan.add(inked(hub, metal, { hull: 0.005, crease: 40 }));
	at(fan, F.x, F.y, 0, thermal);

	// fin stack: thin plates fanned along an arc above the fan, on a curved base
	const fins: THREE.BufferGeometry[] = [];
	const a0 = (48 * Math.PI) / 180;
	const a1 = (132 * Math.PI) / 180;
	for (let i = 0; i < 25; i++) {
		const a = a0 + ((a1 - a0) * i) / 24;
		const g = new THREE.BoxGeometry(0.18, 0.01, 0.14).rotateZ(a);
		g.translate(F.x + Math.cos(a) * 0.55, F.y + Math.sin(a) * 0.55, 0);
		fins.push(g);
	}
	thermal.add(inked(mergeGeometries(fins), metal, { hull: 0, crease: 30 }));
	const base = new THREE.Shape();
	base.absarc(F.x, F.y, 0.46, a0 - 0.05, a1 + 0.05, false);
	base.absarc(F.x, F.y, 0.43, a1 + 0.05, a0 - 0.05, true);
	thermal.add(inked(slab(base, 0.15, 0, 24), metal, { hull: 0.005, crease: 30 }));
	thermal.position.set(0, 0, 0.26);
	part(thermal, [0, 2.0, 0.55]);

	// =====================================================================
	// battery: flat pouch pack with a circuit end cap, four screw ears and a flex lead
	// =====================================================================
	const battery = new THREE.Group();
	at(inked(slab(roundedRect(1.46, 0.56, 0.035), 0.1), cell, { hull: 0.008, crease: 30 }), -0.08, 0, 0, battery);
	// protection-circuit end cap, the lead leaves from here
	at(inked(slab(roundedRect(0.15, 0.52, 0.02), 0.07), mat.chip, { hull: 0.006, crease: 30 }), 0.73, 0, -0.012, battery);
	const ear = roundedRect(0.13, 0.1, 0.035);
	ear.holes.push(circle(0, 0, 0.022));
	const earGeo = slab(ear, 0.016);
	for (const x of [-1, 1])
		for (const y of [-1, 1]) at(inked(earGeo, mat.dark, { hull: 0, crease: 30 }), x * 0.85, y * 0.2, -0.04, battery);
	at(inked(new THREE.BoxGeometry(0.1, 0.24, 0.008), mat.dark, { hull: 0, crease: 30 }), 0.7, 0.38, 0.0, battery);
	at(inked(new THREE.BoxGeometry(0.16, 0.07, 0.025), mat.chip, { hull: 0, crease: 30 }), 0.7, 0.5, 0.0, battery);
	battery.position.set(0, 0.1, -0.08);
	part(battery, [0, -0.95, -0.7]);

	// =====================================================================
	// optics: two pancake-lens modules on rails, lead screw + IPD wheel
	// =====================================================================
	const optics = new THREE.Group();
	const EYE = 0.46; // half of a ~64 mm IPD
	const RZ = 0.12; // rail plane, just inside the back face
	for (const side of [-1, 1]) {
		const mod = new THREE.Group();
		const flange = roundedRect(0.7, 0.74, 0.11);
		flange.holes.push(circle(side * 0.27, 0.28, 0.02), circle(side * 0.27, -0.28, 0.02));
		at(inked(slab(flange, 0.035), optic, { hull: 0.006, crease: 30 }), 0, 0, RZ, mod);
		const barrel = smoothExtrude(new THREE.Shape(v2(lensOutline(0.32, 0.26, side))), {
			depth: 0.19,
			bevelEnabled: true,
			bevelThickness: 0.015,
			bevelSize: 0.015,
			bevelSegments: 2
		});
		mod.add(inked(barrel, optic, { hull: 0.008, crease: 40 }));
		const bezel = new THREE.Shape(v2(lensOutline(0.315, 0.255, side)));
		bezel.holes.push(circle(0, 0, 0.262));
		at(inked(slab(bezel, 0.025), mat.dark, { hull: 0, crease: 30 }), 0, 0, -0.12, mod);
		// slightly domed eye-side element
		const R = 0.62;
		const th = Math.asin(0.262 / R);
		const cap = new THREE.SphereGeometry(R, 40, 5, 0, TAU, 0, th).rotateX(-Math.PI / 2);
		cap.translate(0, 0, R * Math.cos(th) - 0.11);
		mod.add(new THREE.Mesh(cap, lensGlass));
		for (const r of [0.13, 0.205]) {
			const z = -0.11 - (Math.sqrt(R * R - r * r) - R * Math.cos(th)) - 0.002;
			const ring = new THREE.BufferGeometry().setFromPoints(
				Array.from({ length: 48 }, (_, i) => new THREE.Vector3(r * Math.cos((i / 48) * TAU), r * Math.sin((i / 48) * TAU), z))
			);
			mod.add(new THREE.LineLoop(ring, ringMat));
		}
		// carriage: bushing on the top rail, bracket + nut down to the lead screw
		comp3(mod, 0.1, 0.07, 0.06, mat.dark, 0, 0.4, RZ);
		comp3(mod, 0.1, 0.26, 0.03, mat.dark, 0, -0.47, RZ);
		comp3(mod, 0.1, 0.09, 0.08, mat.dark, 0, -0.6, RZ);
		at(mod, side * EYE, 0, 0, optics);
	}
	const rod = (len: number, r: number, y: number) =>
		at(
			inked(new THREE.CylinderGeometry(r, r, len, 14).rotateZ(Math.PI / 2), metal, { hull: 0.004, crease: 0 }),
			0,
			y,
			RZ,
			optics
		);
	rod(1.8, 0.018, 0.4);
	rod(1.74, 0.02, -0.6);
	for (const s of [-1, 1]) comp3(optics, 0.06, 1.1, 0.06, mat.dark, s * 0.9, -0.1, RZ);
	// knurled IPD wheel under the left eye, its rim just breaking the bottom of the shell
	const knurl: V2[] = [];
	for (let i = 0; i < 96; i++) {
		const t = (i / 96) * TAU;
		knurl.push([Math.cos(t) * (0.15 - 0.012 * (i % 4 < 2 ? 1 : 0)), Math.sin(t) * (0.15 - 0.012 * (i % 4 < 2 ? 1 : 0))]);
	}
	const wheel = slab(new THREE.Shape(v2(knurl)), 0.07).rotateY(Math.PI / 2);
	at(inked(wheel, mat.shell, { hull: 0.006, crease: 50 }), 0.25, -0.6, RZ, optics);

	// LCD panels sit on the module flanges and lift off them in the teardown
	const displays = new THREE.Group();
	for (const side of [-1, 1]) {
		const panel = at(new THREE.Group(), side * EYE, 0, 0, displays);
		panel.add(inked(slab(roundedRect(0.62, 0.66, 0.03), 0.026), metal, { hull: 0.006, crease: 30 }));
		at(new THREE.Mesh(slab(roundedRect(0.58, 0.62, 0.02), 0.01), mat.glass), 0, 0, -0.017, panel);
		comp3(panel, 0.2, 0.2, 0.006, mat.dark, -side * 0.1, 0.42, 0.006);
		comp3(panel, 0.25, 0.06, 0.02, mat.chip, -side * 0.1, 0.52, 0.01);
		comp3(panel, 0.42, 0.045, 0.01, mat.chip, 0, -0.29, 0.018);
	}
	displays.position.z = 0.175;
	part(displays, [0, 0.85, 0.15], optics);

	optics.position.z = -0.56;
	part(optics, [0, 0, -0.95]);
	anchor('lens', optics, EYE, -0.3, -0.05);

	// =====================================================================
	// facial interface: lens shroud, molded frame, contoured foam cushion
	// =====================================================================
	const face = new THREE.Group();
	const shroud = new THREE.Shape(v2(goggle(0.98, 0.47, -0.02, 0.3)));
	for (const s of [-1, 1]) shroud.holes.push(new THREE.Path(v2(lensOutline(0.37, 0.29, s, s * EYE))));
	const shroudGeo = smoothExtrude(
		shroud,
		{ depth: 0.025, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 },
		true
	);
	at(inked(shroudGeo, mat.dark, { hull: 0.006, crease: 0 }), 0, 0, -0.5, face);

	const frame = new THREE.Shape(v2(goggle(1.15, 0.63, 0, 0.36)));
	frame.holes.push(new THREE.Path(v2(goggle(0.92, 0.42, -0.02, 0.3))));
	const frameGeo = smoothExtrude(
		frame,
		{ depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 },
		true
	);
	at(inked(frameGeo, mat.dark, { hull: 0.008, crease: 50 }), 0, 0, -0.545, face);
	// eye-relief release buttons on each side of the frame
	const btn = new THREE.CylinderGeometry(0.045, 0.045, 0.05, 16).rotateZ(Math.PI / 2);
	for (const s of [-1, 1]) at(inked(btn, mat.chip, { hull: 0.005, crease: 40 }), s * 1.16, -0.04, -0.56, face);

	// foam: thick forehead band, thinner cheeks, high arch over the nose; the face side wraps
	// back toward the temples on top of the visor's own curve
	// Lofted: a pillowy cross-section swept between matching outer / inner outline samples.
	const N = 128;
	const M = 24;
	const outer = goggle(1.21, 0.69, 0, 0.36, N);
	const inner = goggle(0.88, 0.37, -0.04, 0.3, N);
	const FD = 0.3; // cushion depth
	const fpos: number[] = [];
	for (let i = 0; i < N; i++) {
		const [ox, oy] = outer[i];
		const [ix, iy] = inner[i];
		for (let j = 0; j < M; j++) {
			const p = (j / M) * TAU;
			const c = Math.cos(p);
			const s = Math.sin(p);
			const u = 0.5 + 0.5 * Math.sign(c) * Math.abs(c) ** 0.6;
			const v = (FD / 2) * Math.sign(s) * Math.abs(s) ** 0.6;
			const x = ix + (ox - ix) * u;
			const t = 0.5 - v / FD; // 0 at the frame, 1 at the face
			fpos.push(x, iy + (oy - iy) * u, v - bendZ(x) - t * 0.16 * (x / 1.2) ** 2);
		}
	}
	const fidx: number[] = [];
	for (let i = 0; i < N; i++)
		for (let j = 0; j < M; j++) {
			const a = i * M + j;
			const b = ((i + 1) % N) * M + j;
			const c = ((i + 1) % N) * M + ((j + 1) % M);
			const d = i * M + ((j + 1) % M);
			fidx.push(a, b, d, b, c, d);
		}
	const foamGeo = new THREE.BufferGeometry();
	foamGeo.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
	foamGeo.setIndex(fidx);
	foamGeo.computeVertexNormals();
	at(inked(foamGeo, mat.foam, { hull: 0.01, crease: 0 }), 0, 0, -0.72, face);
	part(face, [0, 0, -1.45]);

	function comp3(parent: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) {
		return at(inked(new THREE.BoxGeometry(w, h, d), m, { hull: 0, crease: 30 }), x, y, z, parent);
	}
}
