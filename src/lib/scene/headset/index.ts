import * as THREE from 'three';
import type { BuildCtx, Part } from './shared';
import { buildVisor } from './visor';
import { buildInternals } from './internals';
import { buildStraps } from './straps';

export type Headset = {
	root: THREE.Group;
	parts: Part[];
	anchors: Record<string, THREE.Object3D>;
	setExplode(e: number): void;
};

export function buildHeadset(): Headset {
	const root = new THREE.Group();
	const parts: Part[] = [];
	const anchors: Record<string, THREE.Object3D> = {};

	const ctx: BuildCtx = {
		part(obj, offset, parent = root) {
			parent.add(obj);
			parts.push({ obj, base: obj.position.clone(), offset: new THREE.Vector3(...offset) });
			return obj;
		},
		anchor(name, parent, x, y, z) {
			const a = new THREE.Object3D();
			a.position.set(x, y, z);
			parent.add(a);
			anchors[name] = a;
		}
	};

	buildVisor(ctx);
	buildInternals(ctx);
	buildStraps(ctx);

	// center the whole thing roughly on its visual mass
	root.children.forEach((c) => (c.position.z += 0.9));
	parts.forEach((p) => p.base.copy(p.obj.position));

	return {
		root,
		parts,
		anchors,
		setExplode(e) {
			for (const p of parts) p.obj.position.copy(p.base).addScaledVector(p.offset, e);
		}
	};
}
