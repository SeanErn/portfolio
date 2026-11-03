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
	/**
	 * Take the head strap and face pad off (0 = worn, 1 = gone), as on a robot mount. They keep
	 * flying out along their explode direction and shrink away. Call before setExplode.
	 */
	setStripped(k: number): void;
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
	// the facial interface is the last part internals.ts adds
	const facePad = parts[parts.length - 1];
	const n = parts.length;
	buildStraps(ctx);
	const removable = new Set([facePad, ...parts.slice(n).filter((p) => p.obj.parent === root)]);
	let stripped = 0;

	// center the whole thing roughly on its visual mass
	root.children.forEach((c) => (c.position.z += 0.9));
	parts.forEach((p) => p.base.copy(p.obj.position));

	return {
		root,
		parts,
		anchors,
		setExplode(e) {
			for (const p of parts) {
				const off = removable.has(p) ? e + stripped * (1.6 - e) : e;
				p.obj.position.copy(p.base).addScaledVector(p.offset, off);
			}
		},
		setStripped(k) {
			stripped = k;
			for (const p of removable) {
				p.obj.visible = k < 0.999;
				p.obj.scale.setScalar(Math.max(1 - k, 0.001));
			}
		}
	};
}
