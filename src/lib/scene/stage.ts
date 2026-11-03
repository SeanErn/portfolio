import * as THREE from 'three';
import { buildHeadset } from './headset/index';
import { syncPalette } from './materials';
import { buildField, FIELD, FIELD_CENTER, toScene, type Pose } from './field';
import { buildRobot2025, type RobotPose } from './robot/index';

/**
 * Everything is keyed to `s`: how far through the story section the reader has scrolled,
 * in viewport heights (0 … STORY_LENGTH). Keyframes below are in the same unit, so the
 * copy in Story.svelte and the 3D can be lined up by eye.
 */
export const STORY_LENGTH = 770;

type V3 = [number, number, number];

/** The red half of the field, where the drive happens. */
const RED_HALF = toScene(FIELD.length * 0.75, FIELD.width / 2);
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
		[525, [RED_HALF.x - 1.0, 13.5, RED_HALF.z + 15.5]],
		[600, [FIELD_CENTER.x - 0.4, 31.0, FIELD_CENTER.z + 7.6]],
		[622, [FIELD_CENTER.x - 0.4, 31.0, FIELD_CENTER.z + 7.6]]
		// …then down to the scoring close-up (added in createStage, once the structure is placed)
	] as Keys<V3>,
	camTarget: [
		[0, [-0.55, 1.75, 0]],
		[110, [0, 2.2, 0]],
		[230, [0, 2.2, 0]],
		[320, [0.65, 2.2, -0.7]],
		[395, [0.65, 2.2, -0.7]],
		[455, [0.3, 0.35, 0]],
		[525, [RED_HALF.x - 0.6, 0, RED_HALF.z - 0.4]],
		[600, [FIELD_CENTER.x - 0.4, 0, FIELD_CENTER.z + 0.2]],
		[622, [FIELD_CENTER.x - 0.4, 0, FIELD_CENTER.z + 0.2]]
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
	/** Head strap and face pad come off as the headset heads for the robot. */
	strip: [
		[392, 0],
		[438, 1]
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
		[650, 1]
	] as Keys<number>,
	// the finale: square up to the branch, raise, tip the coral onto it
	elevator: [
		[632, 0],
		[692, 1]
	] as Keys<number>,
	wrist: [
		[668, 0],
		[712, 1]
	] as Keys<number>,
	coral: [
		[738, 0],
		[770, 0.12]
	] as Keys<number>,
	/** How far up the subject is pushed on tall screens (fraction of the height); the HUD sits on top in the finale. */
	portraitLift: [
		[622, 0.2],
		[712, 0.1]
	] as Keys<number>,
	/** Most the camera pulls back on narrow screens. */
	fitCap: [
		[622, 2.9],
		[712, 2.0]
	] as Keys<number>
};

/** Realistic size on the robot: the Quest 3 is ~0.19 m wide (≈2.6 headset units). */
const MOUNTED_SCALE = 0.07;
/** The headset's visor center, in its own units (index.ts shifts the parts +0.9 z). */
const VISOR_CENTER_Z = 0.9;
const STOWED: RobotPose = { elevator: 0, wrist: 0, coral: 0 };
/** Wrist angle the finale ends on (coral still in the end effector); the elevator goes as high as the branch needs. */
const SCORING_WRIST = 0.6;

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
	const robot = buildRobot2025();
	/** Carries the robot around the field; the robot itself only scales (it rises out of the floor). */
	const rig = new THREE.Group();
	rig.add(robot.group);
	scene.add(rig);

	// where the coral's tip ends up for a given elevator extension, so the field can pick a branch
	// the robot reaches and stop the robot exactly there
	const tipAt = (elevator: number) => {
		robot.setPose({ elevator, wrist: SCORING_WRIST, coral: 0 });
		robot.group.updateMatrixWorld(true);
		return robot.group.worldToLocal(robot.scoreTip.getWorldPosition(new THREE.Vector3()));
	};
	const field = buildField(resolution, {
		dir: robot.scoreDir.clone().setY(0).normalize(),
		reach(height) {
			let lo = 0;
			let hi = 1;
			if (tipAt(1).y < height - 0.02) return { tip: tipAt(1), elevator: 1, ok: false };
			for (let i = 0; i < 24; i++) {
				const mid = (lo + hi) / 2;
				if (tipAt(mid).y < height) lo = mid;
				else hi = mid;
			}
			return { tip: tipAt(hi), elevator: hi, ok: true };
		}
	});
	robot.setPose(STOWED);
	scene.add(field.group);
	const tip = field.branchTip;

	// finale camera: low 3/4 view from the near side, framing robot, raised elevator, coral and branch
	const focus = field.end.clone().lerp(field.branchTip, 0.45).setY(tip.y * 0.55);
	/** The robot faces the near side at the end; the camera comes down in front of it, a little off its shoulder. */
	const along = field.branchTip.clone().sub(field.end).setY(0).normalize();
	const side = new THREE.Vector3(-along.z, 0, along.x);
	if (side.z < 0) side.negate();
	const closeCam = focus.clone().addScaledVector(side, 3.9).addScaledVector(along, -0.7).setY(focus.y + 2.5);
	const camPosKeys: Keys<V3> = [...T.camPos, [712, closeCam.toArray() as V3]];
	const camTargetKeys: Keys<V3> = [...T.camTarget, [712, focus.toArray() as V3]];

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
	let lift = -1;

	function resize(w: number, h: number) {
		width = w;
		height = h;
		renderer.setSize(w, h, false);
		resolution.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
		camera.aspect = w / h;
		lift = -1;
		field.setPointScale(renderer.getPixelRatio());
	}

	/** On wide screens, push the subject right so the copy column has room; on tall ones, up above the copy card. */
	function frameSubject(s: number) {
		const wide = width / height > 1.1;
		const l = wide ? 0 : sample(T.portraitLift, s);
		if (l === lift) return;
		lift = l;
		if (wide) camera.setViewOffset(width, height, -width * 0.13, 0, width, height);
		else camera.setViewOffset(width, height, 0, height * l, width, height);
		camera.updateProjectionMatrix();
	}

	function frame(s: number, time: number): Frame {
		pointer.sx += (pointer.x - pointer.sx) * 0.06;
		pointer.sy += (pointer.y - pointer.sy) * 0.06;

		frameSubject(s);
		// camera, pulled back on narrow screens so the subject still fits
		// (the scoring close-up needs less: the subject is tall, and the HUD sits above it on phones)
		const fit = Math.min(Math.max(1.45 / camera.aspect, 1), sample(T.fitCap, s));
		target.fromArray(sample(camTargetKeys, s));
		camera.position.fromArray(sample(camPosKeys, s)).sub(target).multiplyScalar(fit).add(target);
		camera.lookAt(target);

		// robot drives along the path
		const robotK = sample(T.robot, s);
		const drive = sample(T.drive, s);
		const pose = field.truthAt(drive);
		rig.position.set(pose.x, 0, pose.z);
		rig.rotation.y = pose.heading;
		rig.visible = robotK > 0.001;
		robot.setPose({
			elevator: sample(T.elevator, s) * field.score.elevator,
			wrist: sample(T.wrist, s) * SCORING_WRIST,
			coral: sample(T.coral, s)
		});
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
		// read the mount at full height, then let the robot rise out of the floor
		robot.group.scale.set(1, 1, 1);
		rig.updateMatrixWorld(true);
		robot.mount.getWorldPosition(mountPos);
		robot.mount.getWorldQuaternion(mountQuat);
		mountPos.add(tmp.set(0, 0, -VISOR_CENTER_Z * MOUNTED_SCALE).applyQuaternion(mountQuat));
		robot.group.scale.set(1, Math.max(robotK, 0.001), 1);
		headset.root.position.lerpVectors(freePos, mountPos, m);
		headset.root.quaternion.slerpQuaternions(freeQuat, mountQuat, m);
		// shrink geometrically so the size change reads as steady all the way down
		headset.root.scale.setScalar(Math.pow(MOUNTED_SCALE, m));
		headset.setStripped(sample(T.strip, s));
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
			hud = { est: field.toField(est), odo: field.toField(odo), err: Math.hypot(est.x - odo.x, est.z - odo.z), t: drive };
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
