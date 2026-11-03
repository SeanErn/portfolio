<script lang="ts">
	// Debug viewer for the procedural 2025 robot:
	// /robot?yaw=0.6&pitch=0.15&dist=3&elev=0&wrist=0&coral=0&headset=1&ty=0.6
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { buildHeadset } from '../../lib/scene/headset/index';
	import { buildRobot2025 } from '../../lib/scene/robot/index';

	let canvas: HTMLCanvasElement;
	let info = $state('');

	/** The headset's visor center sits this far (headset units) in front of its root. */
	const VISOR_CENTER_Z = 0.9;
	const SCALE = 0.07;

	onMount(() => {
		const q = new URLSearchParams(location.search);
		const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
		const yaw = num('yaw', 0.6);
		const pitch = num('pitch', 0.15);
		const dist = num('dist', 3);
		const ty = num('ty', 0.6);
		const tx = num('tx', 0);

		const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
		renderer.setSize(innerWidth, innerHeight, false);
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(num('fov', 32), innerWidth / innerHeight, 0.05, 100);
		scene.add(new THREE.HemisphereLight('#ffffff', '#c9c4b8', 2.1));
		const key = new THREE.DirectionalLight('#ffffff', 1.6);
		key.position.set(4, 12, 6);
		scene.add(key);
		const rim = new THREE.DirectionalLight('#fff4e8', 0.6);
		rim.position.set(-6, 3, -4);
		scene.add(rim);

		const robot = buildRobot2025();
		robot.setPose({ elevator: num('elev', 0), wrist: num('wrist', 0), coral: num('coral', 0) });
		scene.add(robot.group);
		robot.group.updateMatrixWorld(true);

		if (q.get('headset') === '1') {
			const headset = buildHeadset();
			const pos = robot.mount.getWorldPosition(new THREE.Vector3());
			const quat = robot.mount.getWorldQuaternion(new THREE.Quaternion());
			pos.add(new THREE.Vector3(0, 0, -VISOR_CENTER_Z * SCALE).applyQuaternion(quat));
			headset.root.position.copy(pos);
			headset.root.quaternion.copy(quat);
			headset.root.scale.setScalar(SCALE);
			scene.add(headset.root);
		}

		const tip = robot.scoreTip.getWorldPosition(new THREE.Vector3());
		if (q.get('tip') === '1') {
			const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), new THREE.MeshBasicMaterial({ color: '#00c8ff' }));
			dot.position.copy(tip);
			scene.add(dot);
		}

		const center = new THREE.Vector3(tx, ty, 0);
		camera.position
			.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
			.multiplyScalar(dist)
			.add(center);
		camera.lookAt(center);
		renderer.render(scene, camera);
		info = `tris ${renderer.info.render.triangles} · tip (${tip.toArray().map((v) => v.toFixed(3)).join(', ')})`;
		document.body.dataset.ready = '1';
		return () => renderer.dispose();
	});
</script>

<canvas bind:this={canvas}></canvas>
<p>{info}</p>

<style>
	canvas {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
	}
	p {
		position: fixed;
		left: 12px;
		bottom: 8px;
		margin: 0;
		font: 12px var(--mono);
		color: var(--ink-2);
	}
</style>
