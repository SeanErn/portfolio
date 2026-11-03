import * as THREE from 'three';

/** Drawing colors that follow the page palette (see syncPalette). */
export const INK = new THREE.Color('#141413');
export const PAPER = new THREE.Color('#e9e7e1');
export const ACCENT = new THREE.Color('#e5461d');
/** Outline color for physical objects (headset, robot): always dark, whatever the paper. */
export const LINE = new THREE.Color('#141413');

export const mat = {
	shell: new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.62, metalness: 0 }),
	dark: new THREE.MeshStandardMaterial({ color: '#1b1b1a', roughness: 0.35, metalness: 0.1 }),
	glass: new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.08, metalness: 0.6 }),
	foam: new THREE.MeshStandardMaterial({ color: '#3b3b38', roughness: 0.95 }),
	fabric: new THREE.MeshStandardMaterial({ color: '#2c2c2a', roughness: 0.9 }),
	pcb: new THREE.MeshStandardMaterial({ color: '#232321', roughness: 0.5 }),
	chip: new THREE.MeshStandardMaterial({ color: '#3d3d39', roughness: 0.4 }),
	accent: new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.55 })
};

/** Inverted-hull outline: pushes vertices along their normals and draws back faces in ink. */
export function outlineMaterial(thickness: number) {
	return new THREE.ShaderMaterial({
		uniforms: { thickness: { value: thickness }, color: { value: LINE } },
		vertexShader: /* glsl */ `
			uniform float thickness;
			void main() {
				vec3 p = position + normal * thickness;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			uniform vec3 color;
			void main() { gl_FragColor = vec4(color, 1.0); }
		`,
		side: THREE.BackSide
	});
}

const edgeMat = new THREE.LineBasicMaterial({ color: LINE, transparent: true, opacity: 0.9 });
const hullCache = new Map<number, THREE.ShaderMaterial>();

/** Mesh with technical-drawing treatment: silhouette hull plus crease lines. */
export function inked(
	geo: THREE.BufferGeometry,
	material: THREE.Material,
	{ hull = 0.012, crease = 28 }: { hull?: number; crease?: number } = {}
) {
	const mesh = new THREE.Mesh(geo, material);
	mesh.castShadow = true;
	if (hull > 0) {
		let m = hullCache.get(hull);
		if (!m) hullCache.set(hull, (m = outlineMaterial(hull)));
		mesh.add(new THREE.Mesh(geo, m));
	}
	if (crease > 0) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, crease), edgeMat));
	return mesh;
}

export function roundedRect<T extends THREE.Path = THREE.Shape>(
	w: number,
	h: number,
	r: number,
	shape: T = new THREE.Shape() as unknown as T
) {
	const x = -w / 2;
	const y = -h / 2;
	shape.moveTo(x + r, y);
	shape.lineTo(x + w - r, y);
	shape.quadraticCurveTo(x + w, y, x + w, y + r);
	shape.lineTo(x + w, y + h - r);
	shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	shape.lineTo(x + r, y + h);
	shape.quadraticCurveTo(x, y + h, x, y + h - r);
	shape.lineTo(x, y + r);
	shape.quadraticCurveTo(x, y, x + r, y);
	return shape;
}

/** Pull --ink, --paper and --accent from the page so the scene matches the active palette. Call before building. */
export function syncPalette() {
	const css = getComputedStyle(document.documentElement);
	const read = (v: string, c: THREE.Color) => {
		const value = css.getPropertyValue(v).trim();
		if (value) c.set(value);
	};
	read('--ink', INK);
	read('--paper', PAPER);
	read('--accent', ACCENT);
	mat.accent.color.copy(ACCENT);
}
