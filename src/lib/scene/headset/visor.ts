import * as THREE from 'three';
import { LINE, inked, mat, roundedRect } from '../materials';
import { BEND, HALF_W, VISOR, bendZ, smoothExtrude, type BuildCtx } from './shared';

/*
 * Front visor of the Quest 3, after reference photos:
 *  - a two-piece shell: a deep "pebble" front cover with a big rolled edge, joined to the body by a
 *    parting line about a third of the way back;
 *  - three vertical pills set low on the face. The outer pills each hold a 4 MP RGB passthrough
 *    camera (top) above an IR/mono tracking camera (bottom); the center pill is the depth sensor
 *    (IR pattern projector low, a small sensor window high);
 *  - two more IR tracking cameras on the lower outer corners, looking down and out;
 *  - power button + status LED and USB-C on the wearer's left side, volume rocker under the right
 *    eye, IPD wheel under the left eye, and a nose cut-out at the back of the underside.
 */

const A = VISOR.w / 2; // 1.31 half width
const B = VISOR.h / 2; // 0.74 half height
const R_TOP = 0.46; // corner radii of the front outline (bottom corners are rounder)
const R_BOT = 0.6;
const TAPER = 0.05; // the lower half narrows slightly toward the bottom
const ROLL_R = 0.38; // front edge roll: lateral inset ...
const ROLL_D = 0.34; // ... and depth
const SEAM_PHI = 0.72; // the parting line sits this far (radians) round the front roll
const BACK_R = 0.06; // small round-over on the back edge
const GROOVE = 0.022; // depth of the seam groove

// ring sample counts: half bottom edge, corner, side edge, top edge
const NB = 15;
const NC = 14;
const NS = 8;
const NT = 30;

const slope = (x: number) => (2 * BEND * x) / HALF_W ** 2; // d bendZ / dx
const taperX = (x: number, y: number) => (y < 0 ? x * (1 - TAPER * Math.min(1, -y / B)) : x);

/** Outline of the visor inset by `i`, as [x, y, nx, ny] samples, counter-clockwise from bottom center. */
function ring(i: number) {
	const a = A - i;
	const b = B - i;
	const rt = Math.max(R_TOP - i, 0);
	const rb = Math.max(R_BOT - i, 0);
	const out: number[][] = [];
	const line = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, n: number) => {
		for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, nx, ny]);
	};
	const arc = (cx: number, cy: number, r: number, a0: number, n: number) => {
		for (let k = 0; k < n; k++) {
			const t = a0 + ((Math.PI / 2) * k) / n;
			out.push([cx + r * Math.cos(t), cy + r * Math.sin(t), Math.cos(t), Math.sin(t)]);
		}
	};
	line(0, -b, a - rb, -b, 0, -1, NB);
	arc(a - rb, -b + rb, rb, -Math.PI / 2, NC);
	line(a, -b + rb, a, b - rt, 1, 0, NS);
	arc(a - rt, b - rt, rt, 0, NC);
	line(a - rt, b, -(a - rt), b, 0, 1, NT);
	arc(-(a - rt), b - rt, rt, Math.PI / 2, NC);
	line(-a, b - rt, -a, -b + rb, -1, 0, NS);
	arc(-(a - rb), -b + rb, rb, Math.PI, NC);
	line(-(a - rb), -b, 0, -b, 0, -1, NB);
	return out;
}

/** Nose cut-out: lifts the bottom-center of the body toward the back. */
function notch(x: number, y: number, z: number) {
	const w = 0.44;
	if (Math.abs(x) >= w || y > -0.3) return y;
	const fx = Math.cos((Math.PI / 2) * (x / w)) ** 2;
	const t = THREE.MathUtils.clamp((-0.02 - z) / 0.45, 0, 1);
	const gz = t * t * (3 - 2 * t);
	const hy = (-0.3 - y) / (B - 0.3);
	return y + 0.21 * fx * gz * hy;
}

/** Map a point of the straight (unbent) visor onto the real one: taper, nose notch, bend. */
function deform(x: number, y: number, z: number, nose: boolean) {
	const yy = nose ? notch(x, y, z) : y;
	const xx = taperX(x, y);
	return new THREE.Vector3(xx, yy, z - bendZ(xx));
}

/** Loft station: ring inset i at depth z, scaled by s; n = analytic [lateral, z] surface normal. */
type Station = { z: number; i: number; s?: number; n?: [number, number] };

/** Map a straight-space normal through deform()'s taper + bend (inverse-transpose Jacobian). */
function deformNormal(x: number, y: number, n: THREE.Vector3) {
	const below = y < 0 && -y < B;
	const t = y < 0 ? 1 - TAPER * Math.min(1, -y / B) : 1;
	const dt = below ? TAPER / B : 0;
	const bp = slope(x * t);
	const J = new THREE.Matrix3().set(t, x * dt, 0, 0, 1, 0, -bp * t, -bp * x * dt, 1);
	return n.applyMatrix3(J.invert().transpose()).normalize();
}

/**
 * Loft rings through `stations` ({z, inset, scale}), closing both ends with a small fan. Caps shrink
 * the last offset ring by `s` (homothetically) so the flat faces never collapse into a sharp skeleton.
 */
function loft(stations: Station[], nose = false) {
	const pos: number[] = [];
	const idx: number[] = [];
	let m = 0;
	for (const { z, i, s = 1 } of stations) {
		const r = ring(i);
		m = r.length;
		for (const [x, y] of r) pos.push(...deform(x * s, y * s, z, nose).toArray());
	}
	const S = stations.length;
	for (let s = 0; s < S - 1; s++) {
		for (let k = 0; k < m; k++) {
			const a = s * m + k;
			const b = s * m + ((k + 1) % m);
			const c = b + m;
			const d = a + m;
			idx.push(a, b, c, a, c, d);
		}
	}
	const c0 = pos.length / 3;
	pos.push(...deform(0, 0, stations[0].z, nose).toArray());
	const c1 = c0 + 1;
	pos.push(...deform(0, 0, stations[S - 1].z, nose).toArray());
	for (let k = 0; k < m; k++) {
		const k1 = (k + 1) % m;
		idx.push(c0, k1, k);
		idx.push(c1, (S - 1) * m + k, (S - 1) * m + k1);
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.setIndex(idx);
	geo.computeVertexNormals();
	// Analytic normals wherever the station knows its profile: interpolated face normals of the
	// long cap triangles otherwise show up as faint bands on the big flat front.
	const nrm = geo.getAttribute('normal');
	const setN = (idx: number, x: number, y: number, z: number, n: THREE.Vector3) => {
		if (nose && notch(x, y, z) !== y) return; // the nose cut-out keeps its computed normals
		const v = deformNormal(x, y, n);
		nrm.setXYZ(idx, v.x, v.y, v.z);
	};
	stations.forEach(({ z, i, s = 1, n }, si) => {
		if (!n) return;
		ring(i).forEach(([x, y, nx, ny], k) => setN(si * m + k, x * s, y * s, z, new THREE.Vector3(nx * n[0], ny * n[0], n[1])));
	});
	for (const [c, st] of [[c0, stations[0]], [c1, stations[S - 1]]] as const)
		if (st.n && st.n[0] === 0) setN(c, 0, 0, st.z, new THREE.Vector3(0, 0, st.n[1]));
	return geo;
}

/** Ink line along the outline at (z, inset). */
function outlineLine(z: number, i: number, nose: boolean, material: THREE.LineBasicMaterial) {
	const pts = ring(i).map(([x, y]) => deform(x, y, z, nose));
	return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), material);
}

/**
 * Put `obj` on the bent surface at straight-space (x, y, z): local +z along the (straight-space)
 * normal n, local +x as close as possible to `along`.
 */
function place(
	obj: THREE.Object3D,
	x: number,
	y: number,
	z: number,
	n: THREE.Vector3,
	along = new THREE.Vector3(1, 0, 0),
	nose = false
) {
	const p = deform(x, y, z, nose);
	obj.position.copy(p);
	const nz = new THREE.Vector3(n.x + slope(p.x) * n.z, n.y, n.z).normalize();
	const nx = along.clone().addScaledVector(nz, -along.dot(nz)).normalize();
	const ny = new THREE.Vector3().crossVectors(nz, nx);
	obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(nx, ny, nz));
	return obj;
}
const Z = new THREE.Vector3(0, 0, 1);
const X = new THREE.Vector3(1, 0, 0);

/** Point on the outline (inset 0) at height y on side sx (±1): [x, nx, ny]. */
function sideAt(sx: number, y: number) {
	if (y < -B + R_BOT) {
		const t = Math.asin((y - (-B + R_BOT)) / R_BOT);
		return [sx * (A - R_BOT + R_BOT * Math.cos(t)), sx * Math.cos(t), Math.sin(t)];
	}
	if (y > B - R_TOP) {
		const t = Math.asin((y - (B - R_TOP)) / R_TOP);
		return [sx * (A - R_TOP + R_TOP * Math.cos(t)), sx * Math.cos(t), Math.sin(t)];
	}
	return [sx * A, sx, 0];
}

/** Point on the underside (inset 0) at x: [y, nx, ny]. */
function bottomAt(x: number) {
	const ax = Math.abs(x);
	if (ax <= A - R_BOT) return [-B, 0, -1];
	const t = Math.acos(Math.min(1, (ax - (A - R_BOT)) / R_BOT));
	return [-B + R_BOT - R_BOT * Math.sin(t), Math.sign(x) * Math.cos(t), -Math.sin(t)];
}

/** Station on the front edge roll, φ = 0 at the side wall, π/2 on the front face. */
function roll(phi: number): Station {
	const [l, nz] = rollNormal(phi);
	return { z: VISOR.front - ROLL_D + ROLL_D * Math.sin(phi), i: ROLL_R * (1 - Math.cos(phi)), n: [l, nz] };
}

/** Outward normal of the roll at φ as [lateral, z]. */
function rollNormal(phi: number) {
	const l = ROLL_D * Math.cos(phi);
	const z = ROLL_R * Math.sin(phi);
	const n = Math.hypot(l, z);
	return [l / n, z / n];
}

/** Bottom of the parting-line groove: the seam point on the roll pushed in along its normal. */
function seamGroove(): Station {
	const { z, i } = roll(SEAM_PHI);
	const [l, nz] = rollNormal(SEAM_PHI);
	return { z: z - GROOVE * nz, i: i + GROOVE * l };
}

/**
 * Point at angle t on the right-hand corner arc of the outline inset by i (bottom corner, or top
 * corner when `top`): [x, y, nx, ny] in straight space.
 */
function cornerPoint(i: number, t: number, top = false) {
	const r = Math.max((top ? R_TOP : R_BOT) - i, 0);
	const cx = A - i - r;
	const cy = top ? B - i - r : -B + i + r;
	return [cx + r * Math.cos(t), cy + r * Math.sin(t), Math.cos(t), Math.sin(t)];
}

/** Front-cover surface z (before bend) on the band above the straight bottom edge, at height y. */
function frontZAt(y: number) {
	const i = y + B;
	if (i >= ROLL_R) return VISOR.front;
	return roll(Math.acos(1 - i / ROLL_R)).z;
}

export function buildVisor({ part, anchor }: BuildCtx) {
	const inkLine = new THREE.LineBasicMaterial({ color: LINE, transparent: true, opacity: 0.85 });
	const shellInk = { hull: 0.014, crease: 0 };
	// pill windows: deep matte black so they stay black from every angle
	const windowMat = new THREE.MeshStandardMaterial({ color: '#0c0c0c', roughness: 0.75, metalness: 0 });
	const smallInk = { hull: 0.005, crease: 30 };

	// --- body: from the back face, round the sides, up to the parting line on the front roll ---
	const zb = VISOR.back;
	const bodySt: Station[] = [];
	for (const s of [0.04, 0.3, 0.55, 0.75, 0.9]) bodySt.push({ z: zb, i: BACK_R, s, n: [0, -1] });
	for (let k = 0; k <= 5; k++) {
		const f = (k / 5) * (Math.PI / 2);
		bodySt.push({ z: zb + BACK_R * (1 - Math.cos(f)), i: BACK_R * (1 - Math.sin(f)), n: [Math.sin(f), -Math.cos(f)] });
	}
	for (const z of [-0.3, -0.18, -0.06, 0.04]) bodySt.push({ z, i: 0, n: [1, 0] });
	for (let k = 0; k <= 6; k++) bodySt.push(roll((k / 6) * (SEAM_PHI - 0.03)));
	const groove = seamGroove();
	bodySt.push(groove);
	for (const s of [0.85, 0.5, 0.04]) bodySt.push({ ...groove, s });
	const body = inked(loft(bodySt, true), mat.shell, shellInk);
	// seam ink sits a hair proud of the groove bottom so it never z-fights with it
	{
		const [l, nz] = rollNormal(SEAM_PHI);
		body.add(outlineLine(groove.z + 0.006 * nz, groove.i - 0.006 * l, true, inkLine));
	}

	// --- front cover: the shallow pebble inside the parting line ----------
	const coverSt: Station[] = [];
	for (const s of [0.04, 0.5, 0.85]) coverSt.push({ ...groove, s });
	coverSt.push(groove);
	for (let k = 0; k <= 9; k++) coverSt.push(roll(SEAM_PHI + 0.03 + (k / 9) * (Math.PI / 2 - SEAM_PHI - 0.03)));
	for (const s of [0.88, 0.74, 0.58, 0.4, 0.22, 0.04]) coverSt.push({ z: VISOR.front, i: ROLL_R, s, n: [0, 1] });
	const cover = new THREE.Group();
	cover.add(inked(loft(coverSt), mat.shell, shellInk));

	// --- sensor pills -----------------------------------------------------
	const sensors = new THREE.Group();
	const PW = 0.19; // dark window
	const PH = 0.46;
	const RIM = 0.038;
	const PY = -0.2;
	const bezelShape = roundedRect(PW + 2 * RIM, PH + 2 * RIM, (PW + 2 * RIM) / 2);
	bezelShape.holes.push(roundedRect(PW, PH, PW / 2, new THREE.Path()));
	const bezelGeo = smoothExtrude(bezelShape, {
		depth: 0.04,
		bevelEnabled: true,
		bevelThickness: 0.006,
		bevelSize: 0.006,
		bevelSegments: 2,
		curveSegments: 16
	});
	const windowGeo = smoothExtrude(roundedRect(PW, PH, PW / 2), {
		depth: 0.01,
		bevelEnabled: false,
		curveSegments: 16
	});
	const barrel = (r: number) => new THREE.CylinderGeometry(r, r, 0.024, 32).rotateX(Math.PI / 2);
	const glass = (r: number) => new THREE.CylinderGeometry(r, r * 1.05, 0.02, 28).rotateX(Math.PI / 2);
	const rgbBarrel = barrel(0.07);
	const rgbGlass = glass(0.04);
	const irBarrel = barrel(0.058);
	const irGlass = glass(0.03);
	const camera = (barrelGeo: THREE.BufferGeometry, glassGeo: THREE.BufferGeometry) => {
		const cam = inked(barrelGeo, mat.chip, { hull: 0, crease: 30 });
		const lens = inked(glassGeo, mat.glass, { hull: 0, crease: 30 });
		lens.position.z = 0.008;
		cam.add(lens);
		return cam;
	};

	[-0.56, 0, 0.56].forEach((x, i) => {
		// the lower end of each pill reaches onto the front roll; the deep bezel runs back into the
		// shell so it still meets the surface there
		const pill = new THREE.Group();
		pill.position.set(x, PY, frontZAt(PY) - bendZ(x));
		pill.rotation.y = Math.atan(slope(x));
		const bezel = inked(bezelGeo, mat.shell, smallInk);
		bezel.position.z = -0.014;
		pill.add(bezel);
		const win = inked(windowGeo, windowMat, { hull: 0, crease: 30 });
		win.position.z = 0.003;
		pill.add(win);
		if (i !== 1) {
			// outer pills: RGB passthrough camera on top, IR tracking camera below
			const rgb = camera(rgbBarrel, rgbGlass);
			rgb.position.set(0, 0.105, 0.014);
			const ir = camera(irBarrel, irGlass);
			ir.position.set(0, -0.115, 0.014);
			pill.add(rgb, ir);
			if (i === 0) anchor('rgb', pill, 0, 0.105, 0.04);
			if (i === 2) anchor('ir', pill, 0, -0.115, 0.04);
		} else {
			// center pill: IR pattern projector (depth) low, small sensor window high
			const proj = inked(smoothExtrude(roundedRect(0.1, 0.085, 0.02), { depth: 0.016, bevelEnabled: false }), mat.chip, {
				hull: 0,
				crease: 30
			});
			proj.position.set(0, -0.1, 0.014);
			const emitter = inked(glass(0.022), mat.glass, { hull: 0, crease: 30 });
			emitter.position.z = 0.01;
			proj.add(emitter);
			const top = camera(barrel(0.03), glass(0.016));
			top.position.set(0, 0.13, 0.012);
			pill.add(proj, top);
			anchor('depth', pill, 0, -0.1, 0.04);
		}
		sensors.add(pill);
	});

	// --- lower-corner tracking cameras on the body band, looking down and out ---
	const cornerWin = smoothExtrude(roundedRect(0.13, 0.105, 0.052), { depth: 0.012, bevelEnabled: false, curveSegments: 12 });
	for (const sx of [-1, 1]) {
		const f = 0.3; // position around the edge roll, below the parting line
		const { z, i } = roll(f);
		const [lat, nz] = rollNormal(f);
		const t = -0.55; // angle on the bottom corner arc
		const [x, y, cx, cy] = cornerPoint(i, t);
		const cam = new THREE.Group();
		const w = inked(cornerWin, windowMat, { hull: 0.004, crease: 30 });
		w.position.z = 0.002;
		cam.add(w);
		const c = camera(irBarrel, irGlass);
		c.scale.setScalar(0.75);
		c.position.z = 0.01;
		cam.add(c);
		place(cam, sx * x, y, z, new THREE.Vector3(sx * cx * lat, cy * lat, nz), X, true);
		part(cam, [sx * 0.3, -0.18, 0], body);
	}

	// --- buttons and ports on the body ------------------------------------
	// Power button, status LED and USB-C on the wearer's left side (+x), volume rocker under the
	// right eye. (The IPD wheel under the left eye belongs to the lens modules in internals.ts.)
	const L = 1;
	const sideN = (nx: number, ny: number) => new THREE.Vector3(nx, ny, 0);
	// power button, low on the left side just behind where the front roll starts
	{
		const y = -0.22;
		const [x, nx, ny] = sideAt(L, y);
		const btn = inked(
			smoothExtrude(roundedRect(0.075, 0.13, 0.037), {
				depth: 0.01,
				bevelEnabled: true,
				bevelThickness: 0.01,
				bevelSize: 0.01,
				bevelSegments: 2,
				curveSegments: 10
			}),
			mat.shell,
			smallInk
		);
		place(btn, x, y, 0.0, sideN(nx, ny), Z, true);
		btn.translateZ(0.008);
		body.add(btn);
		const led = new THREE.Mesh(new THREE.CircleGeometry(0.013, 16), mat.accent);
		place(led, x, y, 0.1, sideN(nx, ny), Z, true);
		led.translateZ(0.002);
		body.add(led);
	}
	// USB-C port, left side, low and toward the back
	{
		const y = -0.34;
		const [x, nx, ny] = sideAt(L, y);
		const port = inked(
			smoothExtrude(roundedRect(0.13, 0.045, 0.022), { depth: 0.006, bevelEnabled: false, curveSegments: 8 }),
			mat.dark,
			{ hull: 0.003, crease: 30 }
		);
		place(port, x, y, -0.28, sideN(nx, ny), Z, true);
		body.add(port);
	}
	// volume rocker under the right eye
	{
		const x = -L * 0.72;
		const [y, nx, ny] = bottomAt(x);
		const rocker = inked(
			smoothExtrude(roundedRect(0.26, 0.07, 0.035), {
				depth: 0.012,
				bevelEnabled: true,
				bevelThickness: 0.01,
				bevelSize: 0.01,
				bevelSegments: 2,
				curveSegments: 10
			}),
			mat.shell,
			smallInk
		);
		place(rocker, x, y, -0.1, sideN(nx, ny), X, true);
		rocker.translateZ(0.008);
		body.add(rocker);
	}
	// --- explode: body forward, cover further, pills furthest -------------
	part(body, [0, 0, 1.25]);
	part(cover, [0, 0, 0.32], body);
	part(sensors, [0, 0, 0.3], cover);
	{
		const i = 0.16;
		const { z } = roll(Math.acos(1 - i / ROLL_R));
		const [x, y] = cornerPoint(i, (3 * Math.PI) / 4, true);
		const p = deform(-x, y, z, false);
		anchor('shell', cover, p.x, p.y, p.z + 0.01);
	}
}
