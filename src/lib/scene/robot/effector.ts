import * as THREE from 'three';
import { at, box, cyl, hull2, ink, ring2, rmat, slab } from './kit';

/*
 * End effector: a pivoting arm of two black plates with red edges (sandwich of a red core and black
 * skins), three green compliant rollers along the top on a belt from a Kraken, a sheet-metal floor,
 * and the coral (white PVC tube) lying between the plates.
 *
 * Local frame: origin on the wrist pivot (axis z), +x = out toward the scoring side, +y up, all at
 * wrist = 0 (stowed): the coral lies level on top of the arm.
 */

export const CORAL_R = 0.057;
export const CORAL_L = 0.3;
/** Coral center in the arm frame. */
export const HELD = new THREE.Vector2(0.12, 0.22);
const PLATE_Z = 0.077; // plate mid-planes at ±PLATE_Z
const CORE_T = 0.007;
const SKIN_T = 0.0012;
const ROLL_R = 0.027;
const ROLL_Y = HELD.y + CORAL_R + ROLL_R + 0.001;
const ROLLS = [-0.07, 0, 0.07].map((dx) => HELD.x + dx);

function slotPath(cx: number, cy: number, len: number, r: number, path = new THREE.Path()) {
	const h = len / 2 - r;
	path.moveTo(cx - h, cy - r);
	path.lineTo(cx + h, cy - r);
	path.absarc(cx + h, cy, r, -Math.PI / 2, Math.PI / 2, false);
	path.lineTo(cx - h, cy + r);
	path.absarc(cx - h, cy, r, Math.PI / 2, (3 * Math.PI) / 2, false);
	return path;
}

function holePath(cx: number, cy: number, r: number) {
	const p = new THREE.Path();
	p.absarc(cx, cy, r, 0, Math.PI * 2, true);
	return p;
}

/** Plate outline grown by `g` (negative shrinks), with its lightening holes shrunk by `g`. */
function plateShape(g: number) {
	const pts = [
		...ring2(0, 0, 0.05 + g, 20),
		...ROLLS.flatMap((x) => ring2(x, ROLL_Y, 0.038 + g, 14)),
		new THREE.Vector2(HELD.x - 0.085 - g, HELD.y - 0.085 - g),
		new THREE.Vector2(HELD.x + 0.095 + g, HELD.y - 0.075 - g)
	];
	const h = hull2(pts);
	const s = new THREE.Shape(h);
	// window over the coral, neck lightening holes, pivot bore
	s.holes.push(slotPath(HELD.x + 0.005, HELD.y - 0.01, 0.13 - 2 * g, 0.026 - g));
	s.holes.push(holePath(0.045, 0.105, 0.026 - g));
	s.holes.push(holePath(0.085, 0.06, 0.013 - g));
	s.holes.push(holePath(0, 0, 0.014 - g));
	return s;
}

export function buildEffector() {
	const arm = new THREE.Group();

	// side plates: red core with black skins inset from the edge
	const core = slab(plateShape(0), CORE_T, 10);
	const skin = slab(plateShape(-0.0045), SKIN_T, 10);
	for (const s of [-1, 1]) {
		at(ink(core, rmat.red, 0.0025, 30), 0, 0, s * PLATE_Z, arm);
		at(ink(skin, rmat.black, 0, 30), 0, 0, s * (PLATE_Z + CORE_T / 2 + SKIN_T / 2), arm);
	}

	// rollers on shafts, pulleys outboard on the +z plate, belt over them
	const span = 2 * PLATE_Z - CORE_T;
	for (const x of ROLLS) {
		cyl(ROLL_R, span - 0.004, 'z', rmat.green, x, ROLL_Y, 0, arm, { seg: 18, hull: 0.0018 });
		cyl(0.006, span + 0.04, 'z', rmat.silver, x, ROLL_Y, 0, arm, { seg: 8, hull: 0, crease: 0 });
		cyl(0.016, 0.01, 'z', rmat.silver, x, ROLL_Y, PLATE_Z + 0.012, arm, { seg: 14, hull: 0.0015 });
	}
	const zb = PLATE_Z + 0.012;
	box(ROLLS[2] - ROLLS[0], 0.034, 0.008, rmat.rubber, HELD.x, ROLL_Y, zb, arm, 0.0015);

	// Kraken X60 on the outboard face, belted up to the first roller
	const mx = 0.06;
	const my = 0.12;
	const motor = cyl(0.03, 0.075, 'z', rmat.black, mx, my, PLATE_Z + 0.004 + 0.0375, arm, { seg: 20, hull: 0.002 });
	cyl(0.027, 0.012, 'z', rmat.silver, 0, 0, 0.04, motor, { seg: 20, hull: 0 });
	cyl(0.014, 0.012, 'z', rmat.silver, mx, my, zb, arm, { seg: 12, hull: 0 });
	const belt = ink(new THREE.BoxGeometry(1, 0.012, 0.008), rmat.rubber, 0.0012, 30);
	const a = new THREE.Vector2(mx, my);
	const b = new THREE.Vector2(ROLLS[0], ROLL_Y);
	belt.scale.x = a.distanceTo(b);
	belt.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
	at(belt, (a.x + b.x) / 2 - 0.01, (a.y + b.y) / 2, zb, arm);

	// sheet-metal floor under the coral, and a flared lead-in at the inner end
	box(0.2, 0.003, span, rmat.silver, HELD.x + 0.01, HELD.y - CORAL_R - 0.004, 0, arm, 0.0012);
	const flare = box(0.07, 0.003, span, rmat.silver, 0, 0, 0, arm, 0.0012);
	flare.rotation.z = 0.7;
	at(flare, HELD.x - 0.11, HELD.y - CORAL_R + 0.018, 0, arm);

	// pivot hub
	cyl(0.018, 2 * PLATE_Z + CORE_T + 0.01, 'z', rmat.silver, 0, 0, 0, arm, { seg: 16, hull: 0.0015 });

	// the coral: a thick-walled PVC tube along +x
	const profile = [
		new THREE.Vector2(CORAL_R - 0.006, -CORAL_L / 2),
		new THREE.Vector2(CORAL_R, -CORAL_L / 2),
		new THREE.Vector2(CORAL_R, CORAL_L / 2),
		new THREE.Vector2(CORAL_R - 0.006, CORAL_L / 2),
		new THREE.Vector2(CORAL_R - 0.006, -CORAL_L / 2)
	];
	const coralGeo = new THREE.LatheGeometry(profile, 28).rotateZ(-Math.PI / 2);
	const coral = at(ink(coralGeo, rmat.coral, 0.0025, 40), HELD.x, HELD.y, 0, arm);

	/** Outer end of the held coral (stays with the arm when the coral leaves). */
	const scoreTip = at(new THREE.Object3D(), HELD.x + CORAL_L / 2, HELD.y, 0, arm);

	return {
		arm,
		scoreTip,
		setCoral(c: number) {
			const k = THREE.MathUtils.clamp(c, 0, 1);
			coral.position.x = HELD.x + k * 0.32;
			coral.visible = k < 0.999;
		}
	};
}

