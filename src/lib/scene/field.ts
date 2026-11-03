import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { ACCENT, INK, inked, mat } from './materials';
import { mulberry32 } from './headset/shared';

/** Field bounds in meters (x along the field, z across it). */
export const FIELD = { x0: -1.6, x1: 12.2, z0: -4.1, z1: 3.6, wall: 0.5 };
export const FIELD_CENTER = new THREE.Vector3((FIELD.x0 + FIELD.x1) / 2, 0, (FIELD.z0 + FIELD.z1) / 2);

const SAMPLES = 480;

export type Pose = { x: number; z: number; heading: number };

export function buildRobot() {
	const robot = new THREE.Group();
	const body = new THREE.Group();
	robot.add(body);

	const frame = inked(new THREE.BoxGeometry(0.74, 0.08, 0.74), mat.shell, { hull: 0.008 });
	frame.position.y = 0.16;
	body.add(frame);

	// bumpers
	for (const [w, d, x, z] of [
		[0.9, 0.1, 0, 0.42],
		[0.9, 0.1, 0, -0.42],
		[0.1, 0.74, 0.42, 0],
		[0.1, 0.74, -0.42, 0]
	]) {
		const b = inked(new THREE.BoxGeometry(w, 0.12, d), mat.accent, { hull: 0.006 });
		b.position.set(x, 0.1, z);
		body.add(b);
	}
	// swerve modules
	const wheel = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 20).rotateZ(Math.PI / 2);
	for (const [x, z] of [
		[0.27, 0.27],
		[-0.27, 0.27],
		[0.27, -0.27],
		[-0.27, -0.27]
	]) {
		const w = inked(wheel, mat.dark, { hull: 0.004, crease: 0 });
		w.position.set(x, 0.05, z);
		body.add(w);
	}
	// superstructure + headset mast
	const tower = inked(new THREE.BoxGeometry(0.5, 0.36, 0.12), mat.shell, { hull: 0.006 });
	tower.position.set(0, 0.38, -0.2);
	body.add(tower);
	const mast = inked(new THREE.BoxGeometry(0.05, 0.3, 0.05), mat.dark, { hull: 0.004 });
	mast.position.set(0, 0.33, 0.24);
	body.add(mast);

	/** Where the headset sits, in robot space. Robot forward is +z. */
	const mount = new THREE.Object3D();
	mount.position.set(0, 0.6, 0.3);
	robot.add(mount);

	return { robot, body, mount };
}

export function buildField(resolution: THREE.Vector2) {
	const group = new THREE.Group();
	const { x0, x1, z0, z1, wall } = FIELD;

	// floor grid
	const grid = new THREE.GridHelper(40, 40, INK, INK);
	const gridMat = grid.material as THREE.LineBasicMaterial;
	gridMat.transparent = true;
	gridMat.opacity = 0;
	grid.position.set(FIELD_CENTER.x, 0.002, FIELD_CENTER.z);
	group.add(grid);

	// perimeter: floor line (thick) + wall cap (thin)
	const outlineMat = new LineMaterial({ color: INK.getHex(), linewidth: 2, transparent: true, opacity: 0 });
	outlineMat.resolution = resolution;
	const ring = (y: number) => [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1, x0, y, z0];
	const floorRing = new Line2(new LineGeometry().setPositions(ring(0.004)), outlineMat);
	group.add(floorRing);
	const capMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0 });
	const cap: number[] = ring(wall);
	for (const [x, z] of [
		[x0, z0],
		[x1, z0],
		[x1, z1],
		[x0, z1]
	])
		cap.push(x, 0, z, x, wall, z);
	const capGeo = new THREE.BufferGeometry().setAttribute(
		'position',
		new THREE.Float32BufferAttribute(
			// convert polyline (first 5 pts) to segments, then the posts
			[...polyToSegments(cap.slice(0, 15)), ...cap.slice(15)],
			3
		)
	);
	group.add(new THREE.LineSegments(capGeo, capMat));

	// obstacles
	const obstacles: THREE.Mesh[] = [];
	const hex = new THREE.CylinderGeometry(0.85, 0.85, 0.6, 6);
	for (const [x, z] of [
		[3.2, 1.9],
		[7.6, 0.3]
	]) {
		const o = inked(hex, mat.shell, { hull: 0.012, crease: 40 });
		o.position.set(x, 0.3, z);
		o.scale.setScalar(0.0001);
		obstacles.push(o);
		group.add(o);
	}

	// the drive path
	const curve = new THREE.CatmullRomCurve3(
		[
			[0, 0],
			[2.4, -1.4],
			[5.0, -0.7],
			[6.6, -2.6],
			[9.4, -2.3],
			[10.8, 0.6],
			[9.6, 2.4],
			[6.0, 2.5]
		].map(([x, z]) => new THREE.Vector3(x, 0, z)),
		false,
		'centripetal'
	);
	const truth = curve.getSpacedPoints(SAMPLES);
	const headings = truth.map((_, i) => {
		const t = curve.getTangentAt(i / SAMPLES);
		return Math.atan2(t.x, t.z);
	});

	// wheel odometry: integrate the true motion with a slowly growing heading bias and scale error
	const odo: THREE.Vector3[] = [truth[0].clone()];
	const rot = new THREE.Vector3();
	for (let i = 1; i <= SAMPLES; i++) {
		const d = rot.subVectors(truth[i], truth[i - 1]).multiplyScalar(1.035);
		d.applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.00075 * i);
		odo.push(odo[i - 1].clone().add(d));
	}
	// VSLAM estimate: truth plus centimeter-level jitter
	const rnd = mulberry32(11);
	const est = truth.map((p, i) =>
		i === 0 ? p.clone() : p.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.03))
	);

	const flat = (pts: THREE.Vector3[]) => pts.flatMap((p) => [p.x, 0.01, p.z]);
	const estMat = new LineMaterial({ color: ACCENT.getHex(), linewidth: 3 });
	estMat.resolution = resolution;
	const estLine = new Line2(new LineGeometry().setPositions(flat(est)), estMat);
	const odoMat = new LineMaterial({
		color: INK.getHex(),
		linewidth: 1.5,
		dashed: true,
		dashSize: 0.18,
		gapSize: 0.12,
		transparent: true,
		opacity: 0.75
	});
	odoMat.resolution = resolution;
	const odoLine = new Line2(new LineGeometry().setPositions(flat(odo)), odoMat);
	odoLine.computeLineDistances();
	group.add(estLine, odoLine);

	// where odometry thinks the robot is
	const ghost = new THREE.LineSegments(
		new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.24, 0.9)),
		new THREE.LineDashedMaterial({ color: INK, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0 })
	);
	ghost.computeLineDistances();
	ghost.position.y = 0.12;
	group.add(ghost);

	// visual features: points on walls and obstacles that light up once the headset sees them
	const features: number[] = [];
	const frng = mulberry32(3);
	const wallPt = () => {
		const r = frng() * 2 * ((x1 - x0) + (z1 - z0));
		const y = 0.04 + frng() * (wall - 0.06);
		const L = x1 - x0;
		const D = z1 - z0;
		if (r < L) return [x0 + r, y, z0];
		if (r < L + D) return [x1, y, z0 + r - L];
		if (r < 2 * L + D) return [x1 - (r - L - D), y, z1];
		return [x0, y, z1 - (r - 2 * L - D)];
	};
	for (let i = 0; i < 520; i++) features.push(...wallPt());
	for (const o of [
		[3.2, 1.9],
		[7.6, 0.3]
	])
		for (let i = 0; i < 70; i++) {
			const a = frng() * Math.PI * 2;
			features.push(o[0] + Math.cos(a) * 0.76, 0.05 + frng() * 0.5, o[1] + Math.sin(a) * 0.76);
		}
	for (let i = 0; i < 120; i++)
		features.push(x0 + frng() * (x1 - x0), 0.01, z0 + frng() * (z1 - z0));

	const count = features.length / 3;
	const firstSeen = new Float32Array(count).fill(2);
	for (let s = 0; s <= SAMPLES; s += 2) {
		const p = truth[s];
		const h = headings[s];
		const fx = Math.sin(h);
		const fz = Math.cos(h);
		for (let i = 0; i < count; i++) {
			if (firstSeen[i] < 2) continue;
			const dx = features[i * 3] - p.x;
			const dz = features[i * 3 + 2] - p.z;
			const d = Math.hypot(dx, dz);
			if (d < 5.2 && (dx * fx + dz * fz) / d > Math.cos(0.95)) firstSeen[i] = s / SAMPLES;
		}
	}
	const seen = new Float32Array(count);
	const pointsGeo = new THREE.BufferGeometry()
		.setAttribute('position', new THREE.Float32BufferAttribute(features, 3))
		.setAttribute('seen', new THREE.BufferAttribute(seen, 1));
	const pointsMat = new THREE.ShaderMaterial({
		transparent: true,
		depthWrite: false,
		uniforms: {
			ink: { value: INK },
			accent: { value: ACCENT },
			opacity: { value: 0 },
			scale: { value: 1 }
		},
		vertexShader: /* glsl */ `
			attribute float seen;
			uniform float scale;
			varying float vSeen;
			void main() {
				vSeen = seen;
				vec4 mv = modelViewMatrix * vec4(position, 1.0);
				float pulse = 4.0 * seen * (1.0 - seen);
				gl_PointSize = scale * (2.0 + step(0.99, seen) * 1.5 + pulse * 6.0) * (14.0 / -mv.z);
				gl_Position = projectionMatrix * mv;
			}
		`,
		fragmentShader: /* glsl */ `
			uniform vec3 ink;
			uniform vec3 accent;
			uniform float opacity;
			varying float vSeen;
			void main() {
				vec2 c = gl_PointCoord - 0.5;
				if (dot(c, c) > 0.25) discard;
				vec3 col = mix(ink, accent, step(0.01, vSeen));
				gl_FragColor = vec4(col, opacity * mix(0.22, 1.0, step(0.01, vSeen)));
			}
		`
	});
	group.add(new THREE.Points(pointsGeo, pointsMat));

	const poseAt = (pts: THREE.Vector3[], t: number): Pose => {
		const f = Math.min(t, 1) * SAMPLES;
		const i = Math.min(Math.floor(f), SAMPLES - 1);
		const k = f - i;
		const a = pts[i];
		const b = pts[i + 1];
		return {
			x: a.x + (b.x - a.x) * k,
			z: a.z + (b.z - a.z) * k,
			heading: Math.atan2(b.x - a.x, b.z - a.z)
		};
	};

	return {
		group,
		start: truth[0],
		startHeading: headings[0],
		truthAt: (t: number): Pose => {
			const p = curve.getPointAt(Math.min(t, 1));
			const tan = curve.getTangentAt(Math.min(t, 1));
			return { x: p.x, z: p.z, heading: Math.atan2(tan.x, tan.z) };
		},
		estAt: (t: number) => poseAt(est, t),
		odoAt: (t: number) => poseAt(odo, t),
		/** Show the field at `vis` (0..1) with the robot `t` (0..1) of the way along the path. */
		update(vis: number, t: number) {
			gridMat.opacity = 0.09 * vis;
			outlineMat.opacity = vis;
			capMat.opacity = 0.45 * vis;
			pointsMat.uniforms.opacity.value = vis;
			obstacles.forEach((o) => o.scale.setScalar(Math.max(vis, 0.0001)));
			const n = Math.floor(t * SAMPLES);
			(estLine.geometry as LineGeometry).instanceCount = n;
			(odoLine.geometry as LineGeometry).instanceCount = n;
			for (let i = 0; i < count; i++) {
				const f = firstSeen[i];
				seen[i] = f > 1 ? 0 : THREE.MathUtils.clamp((t - f) / 0.04, 0, 1);
			}
			pointsGeo.getAttribute('seen').needsUpdate = true;
			const o = poseAt(odo, t);
			ghost.position.x = o.x;
			ghost.position.z = o.z;
			ghost.rotation.y = o.heading;
			(ghost.material as THREE.LineDashedMaterial).opacity = THREE.MathUtils.clamp(t * 20, 0, 1) * 0.8;
		},
		setPointScale(s: number) {
			pointsMat.uniforms.scale.value = s;
		}
	};
}

function polyToSegments(p: number[]) {
	const out: number[] = [];
	for (let i = 0; i + 5 < p.length; i += 3) out.push(...p.slice(i, i + 6));
	return out;
}
