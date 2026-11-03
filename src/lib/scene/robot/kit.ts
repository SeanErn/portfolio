import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { inked, outlineMaterial } from '../materials';

/*
 * Shared kit for the robot part modules: the robot's real colors, cached geometries and an inking
 * helper whose outline hull uses smoothed normals (so box corners keep a closed silhouette while the
 * shaded mesh keeps its flat faces).
 */

const std = (color: string, roughness: number, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
	new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

export const rmat = {
	/** black anodized aluminum (elevator, plates, frame) */
	black: std('#2b2b2e', 0.45, 0.25),
	/** carbon-fiber electronics cover */
	carbon: std('#36373a', 0.3, 0.2),
	/** red anodized edges, printed brackets */
	red: std('#c22a20', 0.45, 0.1),
	/** bumper fabric */
	bumper: std('#c8281f', 0.92),
	/** compliant rollers */
	green: std('#86dc52', 0.6),
	/** raw / bead-blasted aluminum (swerve plates, brackets) */
	silver: std('#c9ccd0', 0.35, 0.3),
	/** wheel tread, cables */
	rubber: std('#1d1d1e', 0.9),
	/** PVC coral */
	coral: std('#f6f4ee', 0.5),
	/** belly pan / deck */
	deck: std('#9da1a5', 0.5, 0.25),
	/** red cable sleeving on the braces */
	sleeve: std('#b7321f', 0.65),
	/** Allen-Bradley beacon dome */
	beacon: std('#ff9a2e', 0.35, 0, { emissive: '#ff6a00', emissiveIntensity: 0.9 }),
	/** elevator LED strip */
	led: std('#4c86ff', 0.4, 0, { emissive: '#2f6bff', emissiveIntensity: 1.4 }),
	/** status LEDs */
	ledGreen: std('#5dff7a', 0.4, 0, { emissive: '#22ff55', emissiveIntensity: 1.2 }),
	/** dark cut-outs */
	void: std('#0e0e10', 0.9)
};

const smoothCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const hullMats = new Map<number, THREE.ShaderMaterial>();

function smoothOf(geo: THREE.BufferGeometry) {
	let s = smoothCache.get(geo);
	if (!s) {
		s = new THREE.BufferGeometry();
		s.setAttribute('position', geo.getAttribute('position'));
		if (geo.index) s.setIndex(geo.index);
		s = mergeVertices(s, 1e-5);
		s.computeVertexNormals();
		smoothCache.set(geo, s);
	}
	return s;
}

/** inked() with a smooth-normal outline hull; `hull` 0 for none, `crease` 0 for no crease lines. */
export function ink(geo: THREE.BufferGeometry, material: THREE.Material, hull = 0.003, crease = 30) {
	const mesh = inked(geo, material, { hull: 0, crease });
	if (hull > 0) {
		let m = hullMats.get(hull);
		if (!m) hullMats.set(hull, (m = outlineMaterial(hull)));
		mesh.add(new THREE.Mesh(smoothOf(geo), m));
	}
	return mesh;
}

export function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number, parent?: THREE.Object3D) {
	obj.position.set(x, y, z);
	parent?.add(obj);
	return obj;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
	let g = geoCache.get(key);
	if (!g) geoCache.set(key, (g = make()));
	return g;
}

export const boxGeo = (w: number, h: number, d: number) =>
	cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));

/** Cylinder along `axis` (default y). */
export const cylGeo = (r: number, len: number, seg = 16, axis: 'x' | 'y' | 'z' = 'y', r2 = r) =>
	cached(`c${r},${r2},${len},${seg},${axis}`, () => {
		const g = new THREE.CylinderGeometry(r2, r, len, seg);
		if (axis === 'x') g.rotateZ(-Math.PI / 2);
		if (axis === 'z') g.rotateX(Math.PI / 2);
		return g;
	});

/** Flat plate from a 2D shape, extruded `t` along +z and centered on z = 0. */
export function slab(shape: THREE.Shape, t: number, curveSegments = 8) {
	const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments });
	g.translate(0, 0, -t / 2);
	return g;
}

/** Box mesh shorthand. */
export function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D, hull = 0.002) {
	return at(ink(boxGeo(w, h, d), m, hull), x, y, z, parent);
}

/** Cylinder mesh shorthand. */
export function cyl(
	r: number,
	len: number,
	axis: 'x' | 'y' | 'z',
	m: THREE.Material,
	x: number,
	y: number,
	z: number,
	parent: THREE.Object3D,
	{ seg = 16, hull = 0.002, crease = 40 }: { seg?: number; hull?: number; crease?: number } = {}
) {
	return at(ink(cylGeo(r, len, seg, axis), m, hull, crease), x, y, z, parent);
}

/** Orient a unit-height y-axis mesh (e.g. a CylinderGeometry of height 1) to span a → b. */
export function span(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
	const d = b.clone().sub(a);
	mesh.position.copy(a).addScaledVector(d, 0.5);
	mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
	mesh.scale.set(1, d.length(), 1);
	return mesh;
}

/** 2D convex hull (monotone chain) of points, counter-clockwise. */
export function hull2(pts: THREE.Vector2[]) {
	const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
	const cross = (o: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) =>
		(a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
	const lower: THREE.Vector2[] = [];
	for (const q of p) {
		while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
		lower.push(q);
	}
	const upper: THREE.Vector2[] = [];
	for (let i = p.length - 1; i >= 0; i--) {
		const q = p[i];
		while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
		upper.push(q);
	}
	return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Points around a circle (for hull2 outlines). */
export function ring2(cx: number, cy: number, r: number, n = 16) {
	const out: THREE.Vector2[] = [];
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2;
		out.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
	}
	return out;
}
