import * as THREE from 'three';
import { buildHeadset } from './headset/index';
import { syncPalette } from './materials';
import { buildField, buildRobot, FIELD_CENTER, type Pose } from './field';

/**
 * Everything is keyed to `s`: how far through the story section the reader has scrolled,
 * in viewport heights (0 … STORY_LENGTH). Keyframes below are in the same unit, so the
 * copy in Story.svelte and the 3D can be lined up by eye.
 */
export const STORY_LENGTH = 660;

type V3 = [number, number, number];
type Keys<T> = [number, T][];

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function sample(keys: Keys<number>, s: number): number;
function sample(keys: Keys<V3>, s: number): V3;
function sample(keys: Keys<number | V3>, s: number): number | V3 {
	if (s <= keys[0][0]) return keys[0][1];
	for (let i = 1; i < keys.length; i++) {
		const [s1, b] = keys[i];
		if (s <= s1) {
			const [s0, a] = keys[i - 1];
			const k = ease((s - s0) / (s1 - s0));
			if (typeof a === 'number') return a + ((b as number) - a) * k;
			return a.map((v, j) => v + ((b as V3)[j] - v) * k) as V3;
		}
	}
	return keys[keys.length - 1][1];
}

/** Smooth 0→1→0 window for fading overlays in and out. */
export function windowed(s: number, a: number, b: number, c: number, d: number) {
	return ease(clamp01((s - a) / (b - a))) * (1 - ease(clamp01((s - c) / (d - c))));
}

const T = {
	camPos: [
		[0, [2.6, 2.8, 8.6]],
		[110, [0, 2.35, 8.4]],
		[230, [0, 2.35, 8.4]],
		[320, [-10.0, 8.3, 7.4]],
		[395, [-10.9, 9.1, 8.9]],
		[455, [2.5, 1.55, 3.3]],
		[525, [FIELD_CENTER.x - 1.4, 14.6, 17.4]],
		[640, [FIELD_CENTER.x - 0.6, 24.5, 6.0]]
	] as Keys<V3>,
	camTarget: [
		[0, [-0.55, 1.75, 0]],
		[110, [0, 2.2, 0]],
		[230, [0, 2.2, 0]],
		[320, [0.65, 2.2, -0.7]],
		[395, [0.65, 2.2, -0.7]],
		[455, [0.3, 0.35, 0]],
		[525, [FIELD_CENTER.x - 0.7, 0, FIELD_CENTER.z - 0.3]],
		[640, [FIELD_CENTER.x - 0.6, 0, FIELD_CENTER.z + 0.2]]
	] as Keys<V3>,
	rotY: [
		[0, 0.62],
		[110, 0],
		[230, 0],
		[320, 0.22],
		[395, 0.06]
	] as Keys<number>,
	rotX: [
		[0, 0.12],
		[110, 0],
		[320, 0.14]
	] as Keys<number>,
	explode: [
		[0, 0],
		[240, 0],
		[320, 1],
		[385, 1],
		[435, 0]
	] as Keys<number>,
	mount: [
		[395, 0],
		[455, 1]
	] as Keys<number>,
	robot: [
		[395, 0],
		[445, 1]
	] as Keys<number>,
	field: [
		[430, 0],
		[500, 1]
	] as Keys<number>,
	drive: [
		[470, 0],
		[635, 1]
	] as Keys<number>
};

export const CALLOUTS = [
	{ id: 'rgb', label: 'RGB cameras', sub: 'color passthrough', win: [115, 140, 220, 240], dx: -30, dy: -160 },
	{ id: 'depth', label: 'Depth sensor', sub: 'room mesh', win: [125, 150, 220, 240], dx: 70, dy: -120 },
	{ id: 'ir', label: 'IR tracking cameras', sub: 'inside-out 6DoF', win: [135, 160, 220, 240], dx: 110, dy: 120 },
	{ id: 'shell', label: 'Front shell', sub: 'sensor array', win: [310, 330, 380, 395], dx: -110, dy: 150 },
	{ id: 'soc', label: 'Snapdragon XR2 Gen 2', sub: 'runs the SLAM', win: [315, 335, 380, 395], dx: 120, dy: -60 },
	{ id: 'lens', label: 'Pancake lenses', sub: 'not needed on a robot', win: [320, 340, 380, 395], dx: 50, dy: 205 },
	{ id: 'strap', label: 'Head strap', sub: 'swapped for a mount', win: [325, 345, 380, 395], dx: 50, dy: -100 }
] as const;

export type Frame = {
	s: number;
	callouts: { id: string; x: number; y: number; o: number }[];
	hud: null | { est: Pose; odo: Pose; err: number; t: number };
};

export function createStage(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
	syncPalette();
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 200);

	scene.add(new THREE.HemisphereLight('#ffffff', '#c9c4b8', 2.1));
	const key = new THREE.DirectionalLight('#ffffff', 1.6);
	key.position.set(4, 12, 6);
	key.target.position.set(4, 0, 0);
	key.castShadow = true;
	key.shadow.mapSize.set(2048, 2048);
	Object.assign(key.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 40 });
	key.shadow.radius = 6;
	key.shadow.bias = -0.0005;
	scene.add(key, key.target);
	const rim = new THREE.DirectionalLight('#fff4e8', 0.6);
	rim.position.set(-6, 3, -4);
	scene.add(rim);

	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2),
		new THREE.ShadowMaterial({ opacity: 0.13 })
	);
	floor.receiveShadow = true;
	scene.add(floor);

	const resolution = new THREE.Vector2(1, 1);
	const headset = buildHeadset();
	scene.add(headset.root);
	const { robot, body, mount } = buildRobot();
	scene.add(robot);
	const field = buildField(resolution);
	scene.add(field.group);

	const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
	const freePos = new THREE.Vector3(0, 2.2, 0);
	const freeQuat = new THREE.Quaternion();
	const mountPos = new THREE.Vector3();
	const mountQuat = new THREE.Quaternion();
	const euler = new THREE.Euler();
	const tmp = new THREE.Vector3();
	const target = new THREE.Vector3();
	let width = 1;
	let height = 1;

	function resize(w: number, h: number) {
		width = w;
		height = h;
		renderer.setSize(w, h, false);
		resolution.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
		camera.aspect = w / h;
		// on wide screens, push the subject right so the copy column has room;
		// on tall ones, push it up above the copy card
		if (w / h > 1.1) camera.setViewOffset(w, h, -w * 0.13, 0, w, h);
		else camera.setViewOffset(w, h, 0, h * 0.2, w, h);
		camera.updateProjectionMatrix();
		field.setPointScale(renderer.getPixelRatio());
	}

	function frame(s: number, time: number): Frame {
		pointer.sx += (pointer.x - pointer.sx) * 0.06;
		pointer.sy += (pointer.y - pointer.sy) * 0.06;

		// camera, pulled back on narrow screens so the subject still fits
		const fit = Math.min(Math.max(1.45 / camera.aspect, 1), 2.9);
		target.fromArray(sample(T.camTarget, s));
		camera.position.fromArray(sample(T.camPos, s)).sub(target).multiplyScalar(fit).add(target);
		camera.lookAt(target);

		// robot drives along the path
		const robotK = sample(T.robot, s);
		const drive = sample(T.drive, s);
		const pose = field.truthAt(drive);
		robot.position.set(pose.x, 0, pose.z);
		robot.rotation.y = pose.heading;
		robot.visible = robotK > 0.001;
		body.scale.set(1, Math.max(robotK, 0.001), 1);
		body.position.y = 0;
		field.update(sample(T.field, s), drive);

		// headset: free-floating pose blended toward its mount on the robot
		const idle = opts.reducedMotion ? 0 : 1 - clamp01(s / 90);
		const m = sample(T.mount, s);
		freePos.set(0, 2.2 + Math.sin(time * 0.9) * 0.04 * (1 - m), 0);
		euler.set(
			sample(T.rotX, s) + pointer.sy * 0.1 * (1 - m),
			sample(T.rotY, s) + Math.sin(time * 0.35) * 0.3 * idle + pointer.sx * 0.22 * (1 - m),
			0
		);
		freeQuat.setFromEuler(euler);
		robot.updateMatrixWorld(true);
		mount.getWorldPosition(mountPos);
		mount.getWorldQuaternion(mountQuat);
		headset.root.position.lerpVectors(freePos, mountPos, m);
		headset.root.quaternion.slerpQuaternions(freeQuat, mountQuat, m);
		headset.root.scale.setScalar(THREE.MathUtils.lerp(1, 0.17, m));
		headset.setExplode(sample(T.explode, s));

		renderer.render(scene, camera);

		// screen-space positions for HTML callouts
		headset.root.updateMatrixWorld(true);
		const callouts = CALLOUTS.map((c) => {
			headset.anchors[c.id].getWorldPosition(tmp).project(camera);
			return {
				id: c.id,
				x: (tmp.x * 0.5 + 0.5) * width,
				y: (-tmp.y * 0.5 + 0.5) * height,
				o: windowed(s, c.win[0], c.win[1], c.win[2], c.win[3])
			};
		});

		let hud: Frame['hud'] = null;
		if (s > 455) {
			const est = field.estAt(drive);
			const odo = field.odoAt(drive);
			hud = { est, odo, err: Math.hypot(est.x - odo.x, est.z - odo.z), t: drive };
		}
		return { s, callouts, hud };
	}

	return {
		resize,
		frame,
		setPointer(x: number, y: number) {
			pointer.x = x;
			pointer.y = y;
		},
		dispose() {
			renderer.dispose();
		}
	};
}
