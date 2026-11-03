import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { at, box, boxGeo, cyl, ink, rmat, slab } from './kit';

/*
 * Drivebase: 0.70 m square frame of 2x1 tube on a belly pan, four swerve modules in the corners
 * (silver plates, 4" wheel, Kraken on top), red competition bumpers with the team number in white.
 */

export const FRAME = 0.7;
const H = FRAME / 2;
const RAIL_W = 0.0254;
const RAIL_H = 0.0508;
const RAIL_Y = 0.035 + RAIL_H / 2;
export const DECK_Y = RAIL_Y + RAIL_H / 2; // top of the frame rails, ≈ 0.086

const BUMP_H = 0.127;
const BUMP_T = 0.083;
const BUMP_Y = 0.022 + BUMP_H / 2;

/** White block "5152" on a transparent canvas (drawn as collegiate block digits, no font needed). */
function numberTexture() {
	const c = document.createElement('canvas');
	c.width = 512;
	c.height = 128;
	const g = c.getContext('2d')!;
	g.fillStyle = '#ffffff';
	const u = 12.5; // unit: digits are 7u x 9u
	const digits: Record<string, number[][]> = {
		'5': [
			[0, 0, 7, 2.2],
			[0, 0, 2.6, 5.3],
			[0, 3.3, 7, 2.1],
			[4.4, 3.3, 2.6, 5.7],
			[0, 6.8, 7, 2.2]
		],
		'1': [
			[2.3, 0, 2.5, 9],
			[0.7, 0.4, 1.8, 2.2],
			[0.6, 7.0, 5.8, 2.0]
		],
		'2': [
			[0, 0, 7, 2.2],
			[4.4, 0, 2.6, 5.3],
			[0, 3.3, 7, 2.1],
			[0, 3.3, 2.6, 5.7],
			[0, 6.8, 7, 2.2]
		]
	};
	const text = '5152';
	const adv = 8.4 * u;
	const x0 = (c.width - (text.length * adv - 1.4 * u)) / 2;
	const y0 = (c.height - 9 * u) / 2;
	[...text].forEach((ch, i) => {
		for (const [x, y, w, h] of digits[ch]) g.fillRect(x0 + i * adv + x * u, y0 + y * u, w * u, h * u);
	});
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;
}

function swerveModule(parent: THREE.Object3D, sx: number, sz: number, plate: THREE.BufferGeometry, wheel: THREE.BufferGeometry, hub: THREE.BufferGeometry) {
	const m = new THREE.Group();
	at(m, sx * 0.282, 0, sz * 0.282, parent);
	// top plate (rounded on the outer corner), lower plate
	const top = ink(plate, rmat.silver, 0.002);
	top.rotation.x = -Math.PI / 2;
	top.scale.set(sx, -sz, 1);
	at(top, 0, DECK_Y + 0.006, 0, m);
	const low = ink(plate, rmat.silver, 0.002);
	low.rotation.x = -Math.PI / 2;
	low.scale.set(sx * 0.82, -sz * 0.82, 1);
	at(low, 0, 0.03, 0, m);
	// wheel (axle along x, driving straight)
	at(ink(wheel, rmat.rubber, 0.002, 40), 0, 0.0508, 0, m);
	at(ink(hub, rmat.silver, 0, 40), 0, 0.0508, 0, m);
	// standoffs between the plates
	for (const [dx, dz] of [
		[-0.045, -0.045],
		[0.045, 0.045],
		[0.045, -0.045],
		[-0.045, 0.045]
	])
		cyl(0.005, 0.055, 'y', rmat.silver, dx, 0.058, dz, m, { seg: 6, hull: 0, crease: 0 });
	// drive Kraken (black can, silver cap) and steering motor
	cyl(0.03, 0.06, 'y', rmat.black, -sx * 0.018, DECK_Y + 0.04, -sz * 0.018, m, { seg: 18 });
	cyl(0.026, 0.012, 'y', rmat.silver, -sx * 0.018, DECK_Y + 0.076, -sz * 0.018, m, { seg: 18, hull: 0 });
	cyl(0.022, 0.04, 'y', rmat.black, sx * 0.03, DECK_Y + 0.03, -sz * 0.035, m, { seg: 14 });
	return m;
}

export function buildChassis(root: THREE.Group) {
	const g = new THREE.Group();
	root.add(g);

	// belly pan and frame rails
	box(FRAME - 0.02, 0.003, FRAME - 0.02, rmat.deck, 0, 0.036, 0, g, 0);
	for (const s of [-1, 1]) {
		box(FRAME, RAIL_H, RAIL_W, rmat.black, 0, RAIL_Y, s * (H - RAIL_W / 2), g);
		box(RAIL_W, RAIL_H, FRAME - 2 * RAIL_W, rmat.black, s * (H - RAIL_W / 2), RAIL_Y, 0, g);
	}
	// cross rail under the elevator
	box(FRAME - 2 * RAIL_W, RAIL_H, RAIL_W, rmat.black, 0, RAIL_Y, -0.12, g);

	// swerve modules
	const ps = new THREE.Shape();
	{
		const a = 0.07;
		const r = 0.045;
		ps.moveTo(-a, -a);
		ps.lineTo(a - r, -a);
		ps.lineTo(a, -a);
		ps.lineTo(a, a - r);
		ps.quadraticCurveTo(a, a, a - r, a); // big round on the outer corner (mirrored per module)
		ps.lineTo(-a, a);
		ps.closePath();
	}
	const outer = slab(ps, 0.005);
	const wheel = new THREE.CylinderGeometry(0.0508, 0.0508, 0.038, 22).rotateZ(Math.PI / 2);
	const hub = new THREE.CylinderGeometry(0.028, 0.028, 0.042, 14).rotateZ(Math.PI / 2);
	for (const [sx, sz] of [
		[1, 1],
		[-1, 1],
		[1, -1],
		[-1, -1]
	])
		swerveModule(g, sx, sz, outer, wheel, hub);

	// bumpers: front/back run the full width, sides butt between them
	const long = new RoundedBoxGeometry(FRAME + 2 * BUMP_T, BUMP_H, BUMP_T, 3, 0.024);
	const short = new RoundedBoxGeometry(BUMP_T, BUMP_H, FRAME, 3, 0.024);
	const zb = H + BUMP_T / 2;
	for (const s of [-1, 1]) {
		at(ink(long, rmat.bumper, 0.004, 50), 0, BUMP_Y, s * zb, g);
		at(ink(short, rmat.bumper, 0.004, 50), s * zb, BUMP_Y, 0, g);
	}
	// seams between bumper segments
	for (const sx of [-1, 1])
		for (const sz of [-1, 1])
			box(0.002, BUMP_H * 0.86, BUMP_T * 0.9, rmat.void, sx * (H + 0.0005), BUMP_Y, sz * zb, g, 0);

	if (typeof document !== 'undefined') {
		const tex = numberTexture();
		const decalMat = new THREE.MeshStandardMaterial({
			map: tex,
			transparent: true,
			roughness: 0.9,
			polygonOffset: true,
			polygonOffsetFactor: -2,
			depthWrite: false
		});
		const decal = new THREE.PlaneGeometry(0.34, 0.085);
		const face = zb + BUMP_T / 2 + 0.0008;
		for (const [x, z, ry] of [
			[0, face, 0],
			[0, -face, Math.PI],
			[face, 0, Math.PI / 2],
			[-face, 0, -Math.PI / 2]
		]) {
			const d = at(new THREE.Mesh(decal, decalMat), x, BUMP_Y - 0.004, z, g);
			d.rotation.y = ry;
			d.renderOrder = 2;
		}
	}

	// electronics bay between the humps: battery on its side, PDH and roboRIO on the pan, wire runs
	box(0.077, 0.17, 0.18, rmat.rubber, -0.22, 0.04 + 0.085, 0, g);
	box(0.079, 0.05, 0.12, rmat.red, -0.22, 0.17, 0, g, 0);
	box(0.13, 0.03, 0.2, rmat.black, -0.1, 0.053, 0, g);
	box(0.05, 0.03, 0.14, rmat.silver, -0.29, 0.053, 0, g);
	const wire = (pts: number[][], m: THREE.Material) =>
		g.add(
			ink(
				new THREE.TubeGeometry(
					new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))),
					16,
					0.007,
					6
				),
				m,
				0.0015,
				0
			)
		);
	wire([[-0.2, 0.21, 0.04], [-0.15, 0.16, 0.06], [-0.1, 0.075, 0.06]], rmat.sleeve);
	wire([[-0.24, 0.21, -0.04], [-0.17, 0.15, -0.07], [-0.11, 0.075, -0.06]], rmat.rubber);
	wire([[-0.06, 0.07, 0.08], [0.0, 0.12, 0.09], [0.03, 0.12, 0.04]], rmat.sleeve);
	wire([[-0.15, 0.07, -0.08], [-0.22, 0.09, -0.11], [-0.28, 0.07, -0.06]], rmat.rubber);

	return g;
}
