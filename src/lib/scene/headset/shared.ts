import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Shared contract for the headset part modules (visor.ts, internals.ts, straps.ts).
 *
 * Coordinates: 1 unit ≈ 70 mm. +x is the wearer's LEFT (the viewer's right when
 * looking at the front), +y up, +z out of the front of the visor.
 * The visor body is centered on the origin; index.ts shifts everything +0.9 z at the end.
 */

/** How far the visor curves back at its edges. */
export const BEND = 0.2;
export const HALF_W = 1.3;

export const bendZ = (x: number) => BEND * (x / HALF_W) ** 2;

/** Extrude a shape, optionally bend it like the Quest visor, and give it smooth normals. */
export function smoothExtrude(shape: THREE.Shape, opts: THREE.ExtrudeGeometryOptions, bend = false) {
	let geo: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, opts);
	geo.deleteAttribute('normal');
	geo.deleteAttribute('uv');
	geo = mergeVertices(geo, 1e-4);
	geo.computeBoundingBox();
	const bb = geo.boundingBox!;
	geo.translate(0, 0, -(bb.max.z + bb.min.z) / 2);
	if (bend) {
		const pos = geo.getAttribute('position');
		for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) - bendZ(pos.getX(i)));
	}
	geo.computeVertexNormals();
	return geo;
}

export function rectShape(w: number, h: number) {
	const s = new THREE.Shape();
	s.moveTo(-w / 2, -h / 2);
	s.lineTo(w / 2, -h / 2);
	s.lineTo(w / 2, h / 2);
	s.lineTo(-w / 2, h / 2);
	s.closePath();
	return s;
}

export function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Part that slides along `offset` as the headset explodes. */
export type Part = { obj: THREE.Object3D; base: THREE.Vector3; offset: THREE.Vector3 };

/** What index.ts hands each part module. */
export type BuildCtx = {
	/** Add `obj` to `parent` (default: headset root) as an explodable part moving by `offset` at full explode. */
	part(obj: THREE.Object3D, offset: [number, number, number], parent?: THREE.Object3D): THREE.Object3D;
	/** Named point the page draws a callout line to. */
	anchor(name: string, parent: THREE.Object3D, x: number, y: number, z: number): void;
};

/**
 * Fixed interfaces between the part modules — the visor may be reshaped, but these stay put so
 * the internals, facial interface and arms keep lining up with it.
 */
export const VISOR = {
	/** Outer width / height of the visor body, bevel included. */
	w: 2.62,
	h: 1.48,
	/** z of the front and back faces at x = 0 (both curve back by bendZ(x) toward the sides). */
	front: 0.47,
	back: -0.47,
	/** Where each side arm meets the visor: x = ±armX, at (armY, armZ). */
	armX: 1.33,
	armY: 0.05,
	armZ: -0.35
} as const;
