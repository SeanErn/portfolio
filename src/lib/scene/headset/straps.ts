import * as THREE from 'three';
import { LINE, inked, mat, roundedRect } from '../materials';
import { VISOR, smoothExtrude, type BuildCtx } from './shared';

/**
 * Quest 3 stock head strap. Anchor: strap.
 *
 * - Rigid white arms pivot on the visor's rear flanks (x = ±VISOR.armX). Each carries a speaker
 *   slot on its inner face just ahead of the ear and an eye-relief button by the hinge.
 * - The soft strap's fabric-covered ends sleeve over the outer face of each arm (snap with an oval
 *   release), run back as side bands, pass through a slider and split into an upper and a lower
 *   band that cup the back of the head ("tighten the split straps").
 * - The top strap leaves the top of the headset, runs over the crown and loops through a buckle
 *   on the upper rear band, its tail folding back over itself.
 *
 * Everything is sized around an adult head (≈150 mm wide, ≈190 mm deep, vertex ≈115 mm above the
 * eyes), modelled as an ellipsoid sitting behind the facial interface.
 */

// --- local materials (same restrained palette as ../materials) -------------
/** Light grey woven elastic, a shade below the white shell so plastic and fabric read apart. */
const fabric = new THREE.MeshStandardMaterial({ color: '#d6d4cc', roughness: 0.96, metalness: 0 });
const stitchMat = new THREE.LineDashedMaterial({
	color: LINE,
	dashSize: 0.03,
	gapSize: 0.022,
	transparent: true,
	opacity: 0.55
});

// --- head the strap wraps (never rendered) ---------------------------------
const HEAD = { c: new THREE.Vector3(0, 0.22, -2.2), r: new THREE.Vector3(1.05, 1.35, 1.2) };

/** Point on the head surface at azimuth `theta` (0 = straight back, + = wearer's left) and height `y`. */
function onHead(theta: number, y: number, lift = 0.028) {
	const k = Math.sqrt(Math.max(0, 1 - ((y - HEAD.c.y) / HEAD.r.y) ** 2));
	const p = new THREE.Vector3(HEAD.r.x * k * Math.sin(theta), y - HEAD.c.y, -HEAD.r.z * k * Math.cos(theta));
	return p.multiplyScalar(1 + lift).add(HEAD.c);
}

/** Point on the head's midline at elevation `a` (0 = forward, π/2 = crown, π = back). */
function onCrown(a: number, lift = 0.028) {
	const p = new THREE.Vector3(0, HEAD.r.y * Math.sin(a), HEAD.r.z * Math.cos(a));
	return p.multiplyScalar(1 + lift).add(HEAD.c);
}

/** Outward normal of the head ellipsoid through `p` (used to orient the straps). */
function headNormal(p: THREE.Vector3) {
	const d = p.clone().sub(HEAD.c);
	return new THREE.Vector3(d.x / HEAD.r.x ** 2, d.y / HEAD.r.y ** 2, d.z / HEAD.r.z ** 2).normalize();
}

/** Frame along a strap: T tangent, B across the strap's width, N out of its face. */
function frameAt(curve: THREE.Curve<THREE.Vector3>, u: number) {
	const p = curve.getPointAt(u);
	const T = curve.getTangentAt(u).normalize();
	const B = new THREE.Vector3().crossVectors(headNormal(p), T).normalize();
	const N = new THREE.Vector3().crossVectors(T, B).normalize();
	return { p, T, B, N };
}

type RibbonOpts = {
	width: number;
	thick: number;
	steps: number;
	/** Rounding length at the start / end (0 = cut square inside something). */
	taperA?: number;
	taperB?: number;
	/** Dashed stitching along both hems. */
	stitch?: boolean;
};

/**
 * Woven strap: a swept stadium section with slightly thicker rolled hems, rounded ends and smooth
 * normals so the ink hull stays continuous even though the strap is thin.
 */
function ribbon(curve: THREE.Curve<THREE.Vector3>, o: RibbonOpts) {
	const { width, thick, steps, taperA = 0.04, taperB = 0.04 } = o;
	const len = curve.getLength();
	const FACE = 5; // points across each face
	const CAP = 4; // interior points around each rolled hem
	const ring = 2 * (FACE + CAP + 1);
	const pos: number[] = [];
	const idx: number[] = [];

	const halfW = (s: number) => {
		let k = 1;
		const da = s * len;
		const db = (1 - s) * len;
		if (taperA > 0 && da < taperA) k = Math.min(k, Math.sqrt(1 - (1 - da / taperA) ** 2));
		if (taperB > 0 && db < taperB) k = Math.min(k, Math.sqrt(1 - (1 - db / taperB) ** 2));
		return (width / 2) * Math.max(k, 0.02);
	};

	// cross-section (b across, n through), counter-clockwise looking along +T
	const section = (hw: number, ht: number) => {
		const pts: [number, number][] = [];
		const r = Math.min(hw, ht);
		const flat = Math.max(hw - r, 0);
		const face = (b: number) => ht * (0.84 + 0.16 * (flat > 0 ? (Math.abs(b) / flat) ** 6 : 1));
		for (let j = 0; j <= CAP; j++) {
			const a = -Math.PI / 2 + (j / (CAP + 1)) * Math.PI;
			pts.push([flat + r * Math.cos(a), ht * Math.sin(a)]);
		}
		for (let j = 0; j < FACE; j++) {
			const b = flat - (j / FACE) * 2 * flat;
			pts.push([b, face(b)]);
		}
		// pts so far: right hem from bottom to just below top, then top face right→left.
		// mirror for the left hem and bottom face
		const half = pts.length;
		for (let j = 0; j < half; j++) {
			const [b, n] = pts[j];
			pts.push([-b, -n]);
		}
		return pts;
	};

	const frames: ReturnType<typeof frameAt>[] = [];
	for (let i = 0; i <= steps; i++) {
		const s = i / steps;
		const f = frameAt(curve, s);
		frames.push(f);
		const hw = halfW(s);
		for (const [b, n] of section(hw, thick / 2)) {
			pos.push(
				f.p.x + f.B.x * b + f.N.x * n,
				f.p.y + f.B.y * b + f.N.y * n,
				f.p.z + f.B.z * b + f.N.z * n
			);
		}
	}
	for (let i = 0; i < steps; i++) {
		for (let j = 0; j < ring; j++) {
			const a = i * ring + j;
			const b = i * ring + ((j + 1) % ring);
			const c = (i + 1) * ring + ((j + 1) % ring);
			const d = (i + 1) * ring + j;
			idx.push(a, b, d, b, c, d);
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.setIndex(idx);
	geo.computeVertexNormals();
	const mesh = inked(geo, fabric, { hull: 0.007, crease: 0 });

	if (o.stitch) {
		const inset = 0.035;
		for (const side of [-1, 1]) {
			const pts: THREE.Vector3[] = [];
			frames.forEach((f, i) => {
				const hw = halfW(i / steps);
				if (hw < width / 2 - 0.001) return;
				pts.push(
					f.p
						.clone()
						.addScaledVector(f.B, side * (hw - inset))
						.addScaledVector(f.N, thick * 0.42 + 0.004)
				);
			});
			if (pts.length < 2) continue;
			const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), stitchMat);
			line.computeLineDistances();
			mesh.add(line);
		}
	}
	return mesh;
}

/** Orient an object so local x → T, y → B, z → N at a strap frame. */
function placeOnFrame(obj: THREE.Object3D, f: { p: THREE.Vector3; T: THREE.Vector3; B: THREE.Vector3; N: THREE.Vector3 }) {
	obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.T, f.B, f.N));
	obj.position.copy(f.p);
	return obj;
}

/** Side profile of an arm / sleeve in (u = -z, v = y): a long paddle, taller at the hinge end. */
function armProfile<T extends THREE.Path = THREE.Shape>(grow: number, path: T = new THREE.Shape() as unknown as T): T {
	const F = { u: 0.35, v: VISOR.armY, r: 0.2 + grow };
	const R = { u: 1.98, v: -0.03, r: 0.155 + grow };
	path.moveTo(F.u, F.v - F.r);
	path.quadraticCurveTo((F.u + R.u) / 2, (F.v - F.r + R.v - R.r) / 2 - 0.015, R.u, R.v - R.r);
	path.absarc(R.u, R.v, R.r, -Math.PI / 2, Math.PI / 2, false);
	path.quadraticCurveTo((F.u + R.u) / 2, (F.v + F.r + R.v + R.r) / 2 + 0.02, F.u, F.v + F.r);
	path.absarc(F.u, F.v, F.r, Math.PI / 2, (3 * Math.PI) / 2, false);
	return path;
}

/** Arms toe in slightly toward the back so the strap follows the head. */
const toeIn = (z: number) => 0.05 * THREE.MathUtils.clamp((-z - 0.35) / 1.65, 0, 1) ** 2;

/** Profile shape → geometry lying in the yz plane, x centred on `xc` (per side). */
function sideSlab(shape: THREE.Shape, depth: number, bevel: number, xc: number, s: number) {
	const geo = smoothExtrude(shape, {
		depth,
		bevelEnabled: true,
		bevelThickness: bevel,
		bevelSize: bevel,
		bevelSegments: 3,
		curveSegments: 14
	}).rotateY(Math.PI / 2); // shape u → z = -u, extrusion depth → x
	const p = geo.getAttribute('position');
	for (let i = 0; i < p.count; i++) p.setX(i, s * (xc - toeIn(p.getZ(i))) + p.getX(i));
	geo.computeVertexNormals();
	return geo;
}

export function buildStraps({ part, anchor }: BuildCtx) {
	const ARM_IN = VISOR.armX; // inner face of the arm at the hinge
	const ARM_T = 0.08; // arm thickness (≈5.5 mm)
	const armXc = ARM_IN + ARM_T / 2;
	const SLV_T = 0.07;
	const slvXc = armXc + 0.035;

	// --- rigid side arms -----------------------------------------------------
	for (const s of [-1, 1]) {
		const arm = new THREE.Group();
		arm.add(inked(sideSlab(armProfile(0), ARM_T - 0.03, 0.015, armXc, s), mat.shell, { hull: 0.01, crease: 40 }));

		// pivot boss tucked against the visor flank
		const boss = inked(
			new THREE.CylinderGeometry(0.12, 0.12, 0.05, 28).rotateZ(Math.PI / 2),
			mat.shell,
			{ hull: 0.006, crease: 40 }
		);
		boss.position.set(s * (ARM_IN - 0.02), VISOR.armY, VISOR.armZ);
		arm.add(boss);

		// inner face: speaker slot just ahead of the ear, eye-relief button by the hinge
		const inner = (z: number) => s * (ARM_IN - toeIn(z) - 0.002);
		const slot = new THREE.Mesh(
			smoothExtrude(roundedRect(0.34, 0.045, 0.022), { depth: 0.02, bevelEnabled: false, curveSegments: 6 }).rotateY(
				Math.PI / 2
			),
			mat.dark
		);
		slot.position.set(inner(-1.6), -0.1, -1.6);
		slot.rotation.x = 0.03;
		arm.add(slot);
		const btn = inked(
			smoothExtrude(roundedRect(0.13, 0.06, 0.03), {
				depth: 0.012,
				bevelEnabled: true,
				bevelThickness: 0.008,
				bevelSize: 0.008,
				bevelSegments: 2,
				curveSegments: 8
			}).rotateY(Math.PI / 2),
			mat.dark,
			{ hull: 0.004, crease: 0 }
		);
		btn.position.set(inner(-0.7) - s * 0.008, -0.07, -0.7);
		arm.add(btn);
		part(arm, [s * 0.85, 0, -0.35]);

		// --- fabric sleeve: the soft strap's end, snapped over the arm's outer face ----
		const sleeve = new THREE.Group();
		sleeve.add(inked(sideSlab(armProfile(0.028), SLV_T - 0.024, 0.012, slvXc, s), fabric, { hull: 0.008, crease: 50 }));
		const outer = (z: number) => s * (slvXc - toeIn(z) + SLV_T / 2 + 0.002);
		// stitched hem following the sleeve outline
		const hem = armProfile(0.028 - 0.04, new THREE.Path()).getSpacedPoints(160);
		const stitch = new THREE.Line(
			new THREE.BufferGeometry().setFromPoints(hem.map((q) => new THREE.Vector3(outer(-q.x) + s * 0.002, q.y, -q.x))),
			stitchMat
		);
		stitch.computeLineDistances();
		sleeve.add(stitch);
		// oval release snap
		const snap = inked(
			smoothExtrude(roundedRect(0.15, 0.075, 0.037), {
				depth: 0.012,
				bevelEnabled: true,
				bevelThickness: 0.008,
				bevelSize: 0.008,
				bevelSegments: 2,
				curveSegments: 10
			}).rotateY(Math.PI / 2),
			mat.shell,
			{ hull: 0.004, crease: 0 }
		);
		snap.position.set(outer(-0.62) + s * 0.004, VISOR.armY, -0.62);
		const snapSlot = new THREE.Mesh(
			smoothExtrude(roundedRect(0.075, 0.016, 0.008), { depth: 0.01, bevelEnabled: false, curveSegments: 4 }).rotateY(
				Math.PI / 2
			),
			mat.dark
		);
		snapSlot.position.x = s * 0.013;
		snap.add(snapSlot);
		sleeve.add(snap);
		part(sleeve, [s * 0.3, 0, -0.05], arm);
	}

	// --- soft rear strap: side bands → sliders → split upper / lower bands -----
	const rear = new THREE.Group();
	const THETA_B = THREE.MathUtils.degToRad(50); // where each side band meets its slider
	const Y_B = -0.06;
	const W_SIDE = 0.36;
	const W_SPLIT = 0.2;
	const THICK = 0.036;

	const splitY = (theta: number, up: number) => {
		const s = Math.sin((Math.PI / 2) * (1 - Math.abs(theta) / THETA_B));
		return up > 0 ? Y_B + 0.1 + 0.32 * s : Y_B - 0.1 - 0.29 * s;
	};

	for (const s of [-1, 1]) {
		const zEnd = -1.98;
		const side = new THREE.CatmullRomCurve3(
			[
				new THREE.Vector3(s * (slvXc - toeIn(-1.62) - 0.018), -0.0, -1.62),
				new THREE.Vector3(s * (slvXc - toeIn(zEnd) - 0.018), -0.03, zEnd - 0.06),
				new THREE.Vector3(s * 1.31, -0.05, -2.32),
				new THREE.Vector3(s * 1.15, Y_B, -2.6),
				onHead(s * THETA_B, Y_B)
			],
			false,
			'centripetal'
		);
		rear.add(ribbon(side, { width: W_SIDE, thick: THICK, steps: 48, taperA: 0.03, taperB: 0.03, stitch: true }));
	}

	for (const up of [1, -1]) {
		const pts: THREE.Vector3[] = [];
		for (let i = 0; i <= 16; i++) {
			const theta = -THETA_B + (i / 16) * 2 * THETA_B;
			pts.push(onHead(theta, splitY(theta, up)));
		}
		const band = ribbon(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), {
			width: W_SPLIT,
			thick: THICK * 0.9,
			steps: 90,
			taperA: 0.03,
			taperB: 0.03,
			stitch: true
		});
		rear.add(band);
	}

	// sliders: the split's adjusters, wrapping the band where it divides
	const sliderGeo = smoothExtrude(roundedRect(0.15, W_SIDE + 0.08, 0.05), {
		depth: 0.04,
		bevelEnabled: true,
		bevelThickness: 0.012,
		bevelSize: 0.012,
		bevelSegments: 3,
		curveSegments: 10
	});
	for (const s of [-1, 1]) {
		const theta = s * THETA_B;
		const ahead = new THREE.CatmullRomCurve3([onHead(theta * 1.1, Y_B), onHead(theta, Y_B), onHead(theta * 0.9, Y_B)]);
		const f = frameAt(ahead, 0.5);
		f.p.addScaledVector(f.N, 0.004);
		rear.add(placeOnFrame(inked(sliderGeo, mat.dark, { hull: 0.006, crease: 40 }), f));
	}

	// top-strap buckle: a loop riding on the upper band at the back centre
	const yUp = splitY(0, 1);
	const upperMid = new THREE.CatmullRomCurve3([onHead(-0.1, splitY(-0.1, 1)), onHead(0, yUp), onHead(0.1, splitY(0.1, 1))]);
	const fb = frameAt(upperMid, 0.5);
	const loopShape = roundedRect(0.48, 0.17, 0.05);
	loopShape.holes.push(roundedRect(0.4, 0.06, 0.025, new THREE.Path()));
	const loop = inked(
		smoothExtrude(loopShape, {
			depth: 0.03,
			bevelEnabled: true,
			bevelThickness: 0.012,
			bevelSize: 0.01,
			bevelSegments: 3,
			curveSegments: 10
		}),
		mat.dark,
		{ hull: 0.006, crease: 40 }
	);
	fb.p.addScaledVector(fb.N, THICK * 0.9);
	rear.add(placeOnFrame(loop, fb));

	part(rear, [0, 0, -1.15]);
	const back = onHead(0, splitY(0, -1), 0.045);
	anchor('strap', rear, back.x, back.y, back.z);

	// --- top strap ---------------------------------------------------------------
	const top = new THREE.Group();
	const crownEnd = Math.PI - Math.asin((yUp + 0.03 - HEAD.c.y) / (HEAD.r.y * 1.05));
	const topCurve = new THREE.CatmullRomCurve3(
		[
			new THREE.Vector3(0, VISOR.h / 2 - 0.12, -0.42),
			new THREE.Vector3(0, VISOR.h / 2 + 0.06, -0.62),
			new THREE.Vector3(0, 1.08, -1.05),
			...[0.95, 1.25, 1.55, 1.85, 2.15, 2.45].map((a) => onCrown(a)),
			onCrown(crownEnd, 0.05)
		],
		false,
		'centripetal'
	);
	top.add(ribbon(topCurve, { width: 0.36, thick: THICK, steps: 110, taperA: 0.03, taperB: 0.03, stitch: true }));
	// tail: folded back up through the buckle and lying on the strap
	const tailLen = 0.6 / topCurve.getLength();
	const tailPts: THREE.Vector3[] = [];
	for (let i = 0; i <= 8; i++) {
		const u = 1 - tailLen + (i / 8) * tailLen;
		const f = frameAt(topCurve, Math.min(u, 0.999));
		tailPts.push(f.p.addScaledVector(f.N, THICK * 1.05));
	}
	top.add(
		ribbon(new THREE.CatmullRomCurve3(tailPts.reverse(), false, 'centripetal'), {
			width: 0.34,
			thick: THICK * 0.9,
			steps: 30,
			taperA: 0.03,
			taperB: 0.17,
			stitch: false
		})
	);
	part(top, [0, 0.8, -0.95]);
}
