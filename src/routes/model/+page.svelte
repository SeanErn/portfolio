<script lang="ts">
	// Debug viewer for the procedural headset: /model?yaw=0.6&pitch=0.2&explode=0&dist=7
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { buildHeadset } from '../../lib/scene/headset/index';

	let canvas: HTMLCanvasElement;

	onMount(() => {
		const q = new URLSearchParams(location.search);
		const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
		const yaw = num('yaw', 0.6);
		const pitch = num('pitch', 0.15);
		const dist = num('dist', 7.5);
		const explode = num('explode', 0);

		const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
		renderer.setSize(innerWidth, innerHeight, false);
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.5, 100);
		scene.add(new THREE.HemisphereLight('#ffffff', '#c9c4b8', 2.1));
		const key = new THREE.DirectionalLight('#ffffff', 1.6);
		key.position.set(4, 12, 6);
		scene.add(key);
		const rim = new THREE.DirectionalLight('#fff4e8', 0.6);
		rim.position.set(-6, 3, -4);
		scene.add(rim);

		const headset = buildHeadset();
		headset.setExplode(explode);
		scene.add(headset.root);
		const box = new THREE.Box3().setFromObject(headset.root);
		const center = box.getCenter(new THREE.Vector3());

		camera.position
			.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
			.multiplyScalar(dist)
			.add(center);
		camera.lookAt(center);
		renderer.render(scene, camera);
		document.body.dataset.ready = '1';
		return () => renderer.dispose();
	});
</script>

<canvas bind:this={canvas}></canvas>

<style>
	canvas {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
	}
</style>
