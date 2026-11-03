import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { DECK_Y } from './chassis';
import { at, box, cyl, ink, rmat, span } from './kit';

/*
 * Everything above the deck except the end effector:
 *  - the carbon-fiber electronics hump along the front (angled top, chamfered ends, arch cut-out,
 *    carry handle);
 *  - the radio standing at front-center with the Quest mast behind it and the Allen-Bradley beacon
 *    on top;
 *  - the two-stage cascade elevator (black 2x1 uprights in the y-z plane, chain and bearings on the
 *    front, blue LED strip) slightly to the robot's left of center, and its carriage;
 *  - two red-sleeved braces from the elevator top down to the robot's right side.
 */

/** Elevator: stage-1 upright centers. */
export const EX = 0.095;
const ZF = 0.03;
const ZB = -0.27;
const ZC = (ZF + ZB) / 2;
const TW = 0.0508; // tube along x
const TD = 0.0254; // tube along z

/** Elevator travel: stage 2 rises STAGE_TRAVEL, the carriage another CARRIAGE_TRAVEL on stage 2. */
export const STAGE_TRAVEL = 0.78;
export const CARRIAGE_TRAVEL = 0.7;
/** Wrist pivot, stowed, in robot space. */
export const PIVOT = new THREE.Vector3(0.19, 0.4, ZC);

/** Quest visor center (headset +z forward). */
export const MOUNT = new THREE.Vector3(0.1, 0.47, 0.155);

function hump(g: THREE.Object3D) {
	const xb = 0.345;
	const xt = 0.3;
	const y0 = DECK_Y + 0.002;
	const yf = 0.235;
	const yt = 0.3;
	const zf = 0.34;
	const zs = 0.21;
	const zr = 0.115;
	const pts: THREE.Vector3[] = [];
	for (const s of [-1, 1]) {
		pts.push(
			new THREE.Vector3(s * xb, y0, zf),
			new THREE.Vector3(s * xb, yf, zf),
			new THREE.Vector3(s * xb, y0, zr),
			new THREE.Vector3(s * xb, yf, zr),
			new THREE.Vector3(s * xt, yt, zs),
			new THREE.Vector3(s * xt, yt, zr)
		);
	}
	g.add(ink(new ConvexGeometry(pts), rmat.carbon, 0.0035, 20));

	// arch cut-out running down the slope into the front face
	const d = new THREE.Vector3(0, yt - yf, zs - zf).normalize();
	const n = new THREE.Vector3(1, 0, 0).cross(d);
	const archW = 0.13;
	const arch = new THREE.Shape();
	arch.moveTo(-archW / 2, 0);
	arch.lineTo(archW / 2, 0);
	arch.lineTo(archW / 2, 0.05);
	arch.absarc(0, 0.05, archW / 2, 0, Math.PI, false);
	arch.lineTo(-archW / 2, 0);
	const am = ink(new THREE.ShapeGeometry(arch, 12), rmat.void, 0, 20);
	am.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), d, n));
	at(am, -0.02, yf, zf, g).position.addScaledVector(n, 0.0015);
	const front = ink(new THREE.PlaneGeometry(archW, 0.045), rmat.void, 0, 20);
	at(front, -0.02, yf - 0.0225, zf + 0.0015, g);

	// carry handle on the flat top
	for (const z of [0.13, 0.2]) box(0.012, 0.04, 0.012, rmat.silver, -0.17, yt + 0.02, z, g, 0.0012);
	box(0.016, 0.016, 0.1, rmat.black, -0.17, yt + 0.045, 0.165, g, 0.0015);

	// carbon side wall running back along the right side
	box(0.004, 0.2, 0.26, rmat.carbon, -0.326, DECK_Y + 0.1, -0.02, g, 0.002);
}

function mast(g: THREE.Object3D) {
	const x = MOUNT.x;
	// radio standing on edge at front-center, with status LEDs and a label
	box(0.055, 0.17, 0.1, rmat.black, x, 0.325, 0.155, g, 0.002);
	box(0.012, 0.11, 0.002, rmat.coral, x - 0.012, 0.33, 0.2055, g, 0);
	for (let i = 0; i < 3; i++) box(0.005, 0.005, 0.002, rmat.ledGreen, x + 0.014, 0.29 + i * 0.016, 0.2055, g, 0);
	// aluminum post behind it, printed cradle under the visor
	box(0.02, 0.37, 0.02, rmat.silver, x, 0.375, 0.095, g, 0.0015);
	box(0.1, 0.006, 0.075, rmat.red, x, 0.413, 0.158, g, 0.0015);
	// beacon bracket and the Allen-Bradley beacon above the headset
	box(0.04, 0.005, 0.085, rmat.silver, x, 0.5625, 0.13, g, 0.0012);
	cyl(0.022, 0.02, 'y', rmat.black, x, 0.575, 0.145, g, { seg: 18 });
	cyl(0.02, 0.014, 'y', rmat.beacon, x, 0.592, 0.145, g, { seg: 18, hull: 0.0015 });
	const dome = new THREE.SphereGeometry(0.02, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2);
	at(ink(dome, rmat.beacon, 0.0015, 0), x, 0.599, 0.145, g);
}

export function buildSuperstructure(root: THREE.Group) {
	const g = new THREE.Group();
	root.add(g);
	hump(g);
	mast(g);

	// --- stage 1 (fixed) ---
	const s1Top = 1.11;
	const s1Bot = DECK_Y + 0.025;
	const s1H = s1Top - s1Bot;
	box(0.05, 0.025, 0.36, rmat.black, EX, DECK_Y + 0.0125, ZC, g); // base rail
	for (const z of [ZF, ZB]) {
		box(TW, s1H, TD, rmat.black, EX, (s1Top + s1Bot) / 2, z, g, 0.0025);
		// base gussets
		box(0.004, 0.08, 0.07, rmat.black, EX - TW / 2 - 0.002, s1Bot + 0.04, z + (z > ZC ? -0.02 : 0.02), g, 0.0015);
	}
	box(0.07, 0.035, ZF - ZB + 0.05, rmat.black, EX, s1Top - 0.0175, ZC, g, 0.0025); // top plate
	for (const z of [ZF - 0.012, ZF + 0.012, ZB - 0.012, ZB + 0.012])
		cyl(0.0045, 0.004, 'y', rmat.silver, EX + 0.012, s1Top + 0.002, z, g, { seg: 8, hull: 0, crease: 0 });
	// chain, sprockets and bearings on the front face of the front upright
	const zc = ZF + TD / 2 + 0.008;
	const yTop = 0.98;
	const yBot = s1Bot + 0.06;
	cyl(0.025, 0.012, 'z', rmat.silver, EX, 1.045, zc, g, { seg: 20 });
	cyl(0.01, 0.016, 'z', rmat.black, EX, 1.045, zc, g, { seg: 10, hull: 0 });
	cyl(0.02, 0.01, 'z', rmat.black, EX, yTop, zc, g, { seg: 16 });
	cyl(0.02, 0.01, 'z', rmat.black, EX, yBot, zc, g, { seg: 16 });
	for (const dx of [-0.019, 0.019]) box(0.006, yTop - yBot, 0.006, rmat.rubber, EX + dx, (yTop + yBot) / 2, zc, g, 0);
	// blue LED strip on the outboard face of the rear upright
	box(0.003, 0.84, 0.012, rmat.led, EX + TW / 2 + 0.0015, 0.62, ZB, g, 0);
	// elevator motors at the base
	for (const z of [ZC - 0.06, ZC + 0.06]) {
		const m = cyl(0.03, 0.07, 'x', rmat.black, EX - TW / 2 - 0.045, DECK_Y + 0.06, z, g, { seg: 18 });
		cyl(0.027, 0.012, 'x', rmat.silver, -0.04, 0, 0, m, { seg: 18, hull: 0 });
	}
	box(0.04, 0.07, 0.2, rmat.black, EX - TW / 2 - 0.0, DECK_Y + 0.06, ZC, g, 0.002);

	// --- braces from the elevator top down to the right side ---
	const tubeGeo = new THREE.CylinderGeometry(0.011, 0.011, 1, 10, 1);
	const tieGeo = new THREE.CylinderGeometry(0.0128, 0.0128, 0.006, 10);
	const braceEnds: [THREE.Vector3, THREE.Vector3][] = [
		[new THREE.Vector3(EX - TW / 2 - 0.012, 0.95, ZF), new THREE.Vector3(-0.255, 0.305, 0.175)],
		[new THREE.Vector3(EX - TW / 2 - 0.012, 0.95, ZB), new THREE.Vector3(-0.3, DECK_Y + 0.01, -0.1)]
	];
	for (const [a, b] of braceEnds) {
		g.add(span(ink(tubeGeo, rmat.sleeve, 0.0022, 0), a, b));
		const d = b.clone().sub(a);
		const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
		for (const k of [0.2, 0.42, 0.64, 0.86]) {
			const t = ink(tieGeo, rmat.rubber, 0, 0);
			t.position.copy(a).addScaledVector(d, k);
			t.quaternion.copy(q);
			g.add(t);
		}
		for (const p of [a, b]) cyl(0.016, 0.03, 'z', rmat.silver, p.x, p.y, p.z, g, { seg: 10, hull: 0.0015 });
	}

	// --- stage 2 (moves STAGE_TRAVEL) ---
	const stage2 = new THREE.Group();
	g.add(stage2);
	const s2x = EX + 0.02;
	const s2Bot = DECK_Y + 0.03;
	const s2Top = 1.135;
	for (const z of [ZF - TD - 0.004, ZB + TD + 0.004])
		box(TW, s2Top - s2Bot, TD, rmat.black, s2x, (s2Top + s2Bot) / 2, z, stage2, 0.0022);
	box(0.06, 0.035, ZF - ZB - 0.01, rmat.black, s2x, s2Top + 0.0175, ZC, stage2, 0.0025);
	box(0.05, 0.02, ZF - ZB - 0.06, rmat.black, s2x, s2Bot + 0.01, ZC, stage2, 0.0018);
	cyl(0.022, 0.012, 'z', rmat.silver, s2x, s2Top - 0.02, ZF - 0.004 + 0.012, stage2, { seg: 18 });

	// --- carriage (rides stage 2; origin on the wrist pivot) ---
	const carriage = new THREE.Group();
	at(carriage, PIVOT.x, PIVOT.y, PIVOT.z, stage2);
	box(0.04, 0.12, 0.2, rmat.black, s2x - PIVOT.x, -0.04, 0, carriage, 0.002);
	for (const s of [-1, 1]) box(0.13, 0.12, 0.006, rmat.black, -0.035, -0.035, s * 0.1, carriage, 0.0018);
	// wrist motor on the back plate, coaxial with the pivot
	const wm = cyl(0.03, 0.07, 'z', rmat.black, 0, 0, -0.1 - 0.003 - 0.035, carriage, { seg: 18 });
	cyl(0.027, 0.012, 'z', rmat.silver, 0, 0, -0.035, wm, { seg: 18, hull: 0 });

	// --- braided cable from the top of the elevator down to the carriage (re-hung on every pose) ---
	const N = 14;
	const segGeo = new THREE.CylinderGeometry(0.009, 0.009, 1, 8, 1, true);
	const segs = Array.from({ length: N }, () => {
		const m = ink(segGeo, rmat.rubber, 0.0018, 0);
		g.add(m);
		return m;
	});
	const A = new THREE.Vector3(EX + TW / 2 + 0.01, s1Top - 0.03, ZB + 0.02);
	const curve = new THREE.QuadraticBezierCurve3(A, new THREE.Vector3(), new THREE.Vector3());
	const pts = Array.from({ length: N + 1 }, () => new THREE.Vector3());
	const hang = (carriageY: number) => {
		const B = curve.v2.set(PIVOT.x - 0.06, carriageY - 0.07, ZB + 0.035);
		const sag = 0.18 + 0.12 * Math.min(1, Math.abs(B.y - A.y));
		curve.v1.copy(A).add(B).multiplyScalar(0.5).add(new THREE.Vector3(sag, -0.1, 0));
		pts.forEach((p, i) => curve.getPoint(i / N, p));
		for (let i = 0; i < N; i++) span(segs[i], pts[i], pts[i + 1]).scale.y += 0.004;
	};

	return { stage2, carriage, hang };
}
