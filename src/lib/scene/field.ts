import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { ACCENT, INK, PAPER } from './materials';
import { mulberry32 } from './headset/shared';

/*
 * The FRC 2025 REEFSCAPE field as a technical drawing, built from the game manual's nominal
 * dimensions (section 5, ARENA), the WPILib AprilTag layout and measurements taken off the official
 * field CAD (REEF pipe centerlines, CAGE heights). Everything is procedural.
 *
 * Field coordinates follow WPILib: meters, x from the blue ALLIANCE WALL toward red, y across the
 * field. The scene shifts them so the drive starts at the origin (where the headset is mounted) and
 * flips y into −z: scene = (x − START.x, h, START.y − y).
 */

export const FIELD = {
	/** 57 ft 6⅞ in × 26 ft 5 in */
	length: 17.548,
	width: 8.052,
	guardrail: 0.51,
	allianceWall: 1.98
};
const MID_X = FIELD.length / 2;
const MID_Y = FIELD.width / 2;

/** Where the drive starts: on the red ROBOT STARTING LINE, near the red PROCESSOR side. */
const START = { x: 10.25, y: 6.1 };
export const toScene = (x: number, y: number, h = 0) => new THREE.Vector3(x - START.x, h, START.y - y);
export const FIELD_CENTER = toScene(MID_X, MID_Y);

/** Each CORAL STATION cuts a field corner: this far along the side wall (x) and the alliance wall (y). */
const STATION = { dx: 1.68, dy: 1.27, height: 1.7, slot: [0.95, 1.13] as const };

const REEF = {
	/** Centers (blue, red): the near face is 12 ft from the ALLIANCE WALL. */
	centers: [
		[4.489, MID_Y],
		[FIELD.length - 4.489, MID_Y]
	] as const,
	/** 5 ft 5½ in across flats. */
	apothem: 0.83,
	/** L1 trough front edge. */
	trough: 0.46,
	/** Two pipes per face, 1 ft 1 in apart. */
	pipeLat: 0.165,
	/**
	 * Pipe centerline as (distance from the REEF center, height): up the inside, a double bend out
	 * toward the face, then straight up to L4. From the CAD.
	 */
	pipe: [
		[0.526, 0.02],
		[0.526, 1.37],
		[0.569, 1.453],
		[0.737, 1.57],
		[0.78, 1.653],
		[0.78, 1.826]
	] as const,
	/** L2/L3 branch tips (centerline) and the L4 top, and how far out they reach. */
	levels: { L2: 0.792, L3: 1.194, L4: 1.826 },
	branchReach: 0.777,
	/** The core inside the pipes that holds the ALGAE: a hex apothem and height. */
	core: [0.45, 0.8] as const
};
/** L2 and L3 branches rise toward the robot at 35°. */
const BRANCH_TILT = THREE.MathUtils.degToRad(35);

const BARGE = {
	x: MID_X,
	depth: 1.12,
	/** 29 ft 2 in wide: the end towers stand outside the guardrails. */
	halfWidth: 4.445,
	truss: [1.57, 1.88] as const,
	net: [1.93, 2.24] as const,
	height: 2.57,
	netLength: 3.66,
	/** CAGE centers from mid-field, each side; 7⅜ in square, 2 ft tall. */
	cages: [1.05, 2.14, 3.24],
	cage: { size: 0.19, height: 0.61, shallow: 0.76, deep: 0.08 }
};

/** PROCESSORS: opening centers on the side walls (blue on y = 0, red on the far wall). */
const PROCESSORS = [
	{ x: 5.988, side: 0 },
	{ x: 11.561, side: 1 }
];

const SAMPLES = 480;
/** Half the bumper width: how close the robot's center gets to the REEF base. */
const BUMPER_HALF = 0.43;
const UP = new THREE.Vector3(0, 1, 0);

export type Pose = { x: number; z: number; heading: number };
export type Level = 'L4' | 'L3' | 'L2';

/** How the robot reaches: lets the field pick a branch the robot can actually score on. */
export type ScoreSolver = {
	/** Robot-space direction the end effector scores toward. */
	dir: THREE.Vector3;
	/**
	 * Robot-space coral tip once raised to `height` (robot at the origin, unrotated), the elevator
	 * extension that takes, and whether it gets there (if not, the tip at full extension).
	 */
	reach(height: number): { tip: THREE.Vector3; elevator: number; ok: boolean };
};

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t: number) => t * t * (3 - 2 * t);

/** Collects line segments in two weights, in field coordinates. */
class Sketch {
	heavy: number[] = [];
	light: number[] = [];
	seg(a: THREE.Vector3, b: THREE.Vector3, heavy = false) {
		(heavy ? this.heavy : this.light).push(a.x, a.y, a.z, b.x, b.y, b.z);
	}
	poly(pts: THREE.Vector3[], closed = false, heavy = false) {
		for (let i = 0; i + 1 < pts.length; i++) this.seg(pts[i], pts[i + 1], heavy);
		if (closed) this.seg(pts[pts.length - 1], pts[0], heavy);
	}
	/** Box with its base on the floor-plan rectangle p + [0,u] × [0,v], from height h0 to h1. */
	box(p: THREE.Vector2, u: THREE.Vector2, v: THREE.Vector2, h0: number, h1: number, heavy = false) {
		const c = [p, p.clone().add(u), p.clone().add(u).add(v), p.clone().add(v)];
		const at = (q: THREE.Vector2, h: number) => toScene(q.x, q.y, h);
		this.poly(c.map((q) => at(q, h0)), true, heavy);
		this.poly(c.map((q) => at(q, h1)), true, heavy);
		for (const q of c) this.seg(at(q, h0), at(q, h1), heavy);
	}
}

const v2 = (x: number, y: number) => new THREE.Vector2(x, y);

/**
 * The field, the drive, and the branch it ends on. The path's last point is placed so that a robot
 * at its scoring pose (`score`) puts the coral tip on a real REEF branch, square to the face.
 */
export function buildField(resolution: THREE.Vector2, score: ScoreSolver) {
	const group = new THREE.Group();
	const { length: L, width: W } = FIELD;
	const sk = new Sketch();
	const tape = new Sketch();
	const pipes = new Sketch();

	// floor grid
	const grid = new THREE.GridHelper(48, 48, INK, INK);
	const gridMat = grid.material as THREE.LineBasicMaterial;
	gridMat.transparent = true;
	gridMat.opacity = 0;
	grid.position.set(FIELD_CENTER.x, 0.002, FIELD_CENTER.z);
	group.add(grid);

	// ---------------------------------------------------------------- perimeter
	const corners = [
		v2(STATION.dx, 0),
		v2(L - STATION.dx, 0),
		v2(L, STATION.dy),
		v2(L, W - STATION.dy),
		v2(L - STATION.dx, W),
		v2(STATION.dx, W),
		v2(0, W - STATION.dy),
		v2(0, STATION.dy)
	];
	const outlineMat = new LineMaterial({ color: INK.getHex(), linewidth: 2, transparent: true, opacity: 0 });
	outlineMat.resolution = resolution;
	const floorRing = new Line2(
		new LineGeometry().setPositions([...corners, corners[0]].flatMap((c) => toScene(c.x, c.y, 0.004).toArray())),
		outlineMat
	);
	group.add(floorRing);

	// guardrails along the side walls: top rail and posts
	for (const y of [0, W]) {
		sk.seg(toScene(STATION.dx, y, FIELD.guardrail), toScene(L - STATION.dx, y, FIELD.guardrail));
		for (let x = STATION.dx; x <= L - STATION.dx + 0.01; x += (L - 2 * STATION.dx) / 8)
			sk.seg(toScene(x, y, 0), toScene(x, y, FIELD.guardrail));
	}

	// ALLIANCE WALLS: three driver station windows each
	for (const x of [0, L]) {
		const y0 = STATION.dy;
		const y1 = W - STATION.dy;
		const H = FIELD.allianceWall;
		sk.poly([toScene(x, y0, 0), toScene(x, y0, H), toScene(x, y1, H), toScene(x, y1, 0)]);
		const n = 3;
		const w = (y1 - y0) / n;
		for (let i = 0; i < n; i++) {
			const a = y0 + i * w + 0.12;
			const b = y0 + (i + 1) * w - 0.12;
			sk.poly([toScene(x, a, 0.95), toScene(x, a, H - 0.08), toScene(x, b, H - 0.08), toScene(x, b, 0.95)], true);
		}
		sk.seg(toScene(x, y0, 0.9), toScene(x, y1, 0.9));
	}

	// CORAL STATIONS: an angled panel across each corner with the slot the CORAL drops out of,
	// and the CHUTE sloping up and away behind it at 55°
	const stationEnds: [THREE.Vector2, THREE.Vector2][] = [
		[corners[7], corners[0]],
		[corners[1], corners[2]],
		[corners[3], corners[4]],
		[corners[5], corners[6]]
	];
	for (const [a, b] of stationEnds) {
		const along = b.clone().sub(a);
		const len = along.length();
		along.normalize();
		const out = v2(along.y, -along.x); // away from the field
		const at = (s: number, o: number, h: number) => {
			const q = a.clone().addScaledVector(along, s).addScaledVector(out, o);
			return toScene(q.x, q.y, h);
		};
		const [s0, s1] = STATION.slot;
		const inset = (len - 1.93) / 2;
		sk.poly([at(0, 0, 0), at(0, 0, STATION.height), at(len, 0, STATION.height), at(len, 0, 0)]);
		sk.poly([at(inset, 0, s0), at(inset, 0, s1), at(len - inset, 0, s1), at(len - inset, 0, s0)], true);
		const run = 0.75;
		const rise = run * Math.tan(THREE.MathUtils.degToRad(55));
		for (const s of [inset, len - inset]) sk.seg(at(s, 0, s1), at(s, run, s1 + rise));
		sk.seg(at(inset, run, s1 + rise), at(len - inset, run, s1 + rise));
	}

	// PROCESSORS: a box behind the side wall with its opening facing the field
	for (const p of PROCESSORS) {
		const sgn = p.side ? 1 : -1; // outward
		const y = p.side ? W : 0;
		sk.box(v2(p.x - 0.55, y), v2(1.1, 0), v2(0, 0.6 * sgn), 0, 0.95);
		sk.poly(
			[toScene(p.x - 0.355, y, 0.18), toScene(p.x - 0.355, y, 0.69), toScene(p.x + 0.355, y, 0.69), toScene(p.x + 0.355, y, 0.18)],
			true
		);
	}

	// ---------------------------------------------------------------- BARGE
	{
		const { x, depth, halfWidth, truss, net, height, netLength, cages, cage } = BARGE;
		const y0 = MID_Y - halfWidth;
		const y1 = MID_Y + halfWidth;
		const T = 0.3; // truss / tower section
		// end towers and a center post
		for (const y of [y0, y1]) sk.box(v2(x - T / 2, y - T / 2), v2(T, 0), v2(0, T), 0, height);
		sk.box(v2(x - T / 2, MID_Y - T / 2), v2(T, 0), v2(0, T), truss[1], net[1]);
		// the horizontal truss, laced on both faces
		sk.box(v2(x - T / 2, y0 + T / 2), v2(T, 0), v2(0, y1 - y0 - T), truss[0], truss[1]);
		const bays = 24;
		for (let i = 0; i < bays; i++) {
			const a = y0 + T / 2 + ((y1 - y0 - T) * i) / bays;
			const b = y0 + T / 2 + ((y1 - y0 - T) * (i + 1)) / bays;
			for (const sx of [-T / 2, T / 2])
				sk.seg(toScene(x + sx, i % 2 ? a : b, truss[0]), toScene(x + sx, i % 2 ? b : a, truss[1]));
		}
		// a NET on each side of the center post, meshed on top
		for (const s of [-1, 1]) {
			const a = MID_Y + s * T / 2;
			const b = MID_Y + s * (T / 2 + netLength);
			sk.box(v2(x - depth / 2, Math.min(a, b)), v2(depth, 0), v2(0, Math.abs(b - a)), net[0], net[1]);
			for (let k = 1; k < 12; k++) {
				const y = a + ((b - a) * k) / 12;
				sk.seg(toScene(x - depth / 2, y, net[1]), toScene(x + depth / 2, y, net[1]));
			}
			for (let k = 1; k < 4; k++) {
				const dx = -depth / 2 + (depth * k) / 4;
				sk.seg(toScene(x + dx, a, net[1]), toScene(x + dx, b, net[1]));
			}
		}
		// the CAGES hanging under the truss: shallow in the middle of each three, deep either side
		for (const s of [-1, 1])
			cages.forEach((d, i) => {
				const yc = MID_Y + s * d;
				const bottom = i === 1 ? cage.shallow : cage.deep;
				const h = cage.size / 2;
				sk.box(v2(x - h, yc - h), v2(cage.size, 0), v2(0, cage.size), bottom, bottom + cage.height);
				sk.seg(toScene(x, yc, bottom + cage.height), toScene(x, yc, truss[0]));
			});
	}

	// ---------------------------------------------------------------- REEFS
	// drawn hidden-line style: filled with the paper color so it hides what's behind, edged in ink
	const reefBases: THREE.Group[] = [];
	const baseFill = new THREE.MeshBasicMaterial({
		color: PAPER,
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});
	const baseGeo = new THREE.CylinderGeometry(1, 1, REEF.trough, 6).scale(
		REEF.apothem / Math.cos(Math.PI / 6),
		1,
		REEF.apothem / Math.cos(Math.PI / 6)
	);
	const baseEdgeMat = new LineMaterial({ color: INK.getHex(), linewidth: 2, transparent: true, opacity: 0 });
	baseEdgeMat.resolution = resolution;
	/** A point on a REEF face: `a` from the center along the face's normal, `l` along the face. */
	const reefPt = (c: readonly [number, number], k: number, a: number, l: number, h: number) => {
		const phi = (k * Math.PI) / 3;
		const nx = Math.cos(phi);
		const ny = Math.sin(phi);
		return toScene(c[0] + nx * a - ny * l, c[1] + ny * a + nx * l, h);
	};
	for (const c of REEF.centers) {
		const base = new THREE.Group();
		base.add(
			new THREE.Mesh(baseGeo, baseFill),
			new LineSegments2(
				new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(baseGeo)),
				baseEdgeMat
			)
		);
		base.position.copy(toScene(c[0], c[1], REEF.trough / 2));
		base.scale.setScalar(0.0001);
		reefBases.push(base);
		group.add(base);

		const inner = REEF.pipe[0][0];
		for (let k = 0; k < 6; k++) {
			for (const l of [-REEF.pipeLat, REEF.pipeLat]) {
				const p = (a: number, h: number) => reefPt(c, k, a, l, h);
				pipes.poly(
					REEF.pipe.map(([a, h]) => p(a, h)),
					false,
					true
				);
				const rise = (REEF.branchReach - inner) * Math.tan(BRANCH_TILT);
				for (const h of [REEF.levels.L2, REEF.levels.L3]) pipes.seg(p(inner, h - rise), p(REEF.branchReach, h), true);
			}
		}
		// the core the pipes stand around
		const [ca, ch] = REEF.core;
		const core: THREE.Vector3[] = [];
		for (let k = 0; k < 6; k++) core.push(reefPt(c, k, ca, -ca * Math.tan(Math.PI / 6), 0));
		sk.poly(core.map((q) => q.clone().setY(REEF.trough)), true);
		sk.poly(core.map((q) => q.clone().setY(ch)), true);
		core.forEach((q) => sk.seg(q.clone().setY(REEF.trough), q.clone().setY(ch)));
		// REEF ZONE tape
		const zone: THREE.Vector3[] = [];
		for (let k = 0; k < 6; k++) zone.push(reefPt(c, k, 1.185, -1.185 * Math.tan(Math.PI / 6), 0.004));
		tape.poly(zone, true);
	}

	// floor tape: center line and ROBOT STARTING LINES
	for (const x of [MID_X, 7.56, L - 7.56]) tape.seg(toScene(x, 0, 0.004), toScene(x, W, 0.004));

	const structMat = new LineMaterial({ color: INK.getHex(), linewidth: 1.4, transparent: true, opacity: 0 });
	structMat.resolution = resolution;
	const pipeMat = new LineMaterial({ color: INK.getHex(), linewidth: 3, transparent: true, opacity: 0 });
	pipeMat.resolution = resolution;
	const tapeMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0 });
	group.add(
		new LineSegments2(new LineSegmentsGeometry().setPositions(sk.light), structMat),
		new LineSegments2(new LineSegmentsGeometry().setPositions(pipes.heavy), pipeMat),
		new THREE.LineSegments(
			new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tape.light, 3)),
			tapeMat
		)
	);

	// ---------------------------------------------------------------- the scoring branch
	// red REEF, the face toward the BARGE; the robot drives into it along +x. Take the right-hand
	// pipe (toward the near side wall, so the final camera sees it) at the highest level the robot reaches.
	const red = REEF.centers[1];
	const A = new THREE.Vector3(1, 0, 0);
	const FACE = 3; // normal along −x
	const LAT = REEF.pipeLat; // y = 4.026 − 0.165
	let level: Level = 'L2';
	let reach = score.reach(REEF.levels.L2);
	for (const l of ['L4', 'L3', 'L2'] as const) {
		const r = score.reach(REEF.levels[l] + (l === 'L4' ? 0.03 : 0));
		if (r.ok || l === 'L2') {
			level = l;
			reach = r;
			break;
		}
	}
	const tipA = level === 'L4' ? REEF.pipe[REEF.pipe.length - 1][0] : REEF.branchReach;
	const branchTip = reefPt(red, FACE, tipA, LAT, REEF.levels[level] + (level === 'L4' ? 0.03 : 0));

	// a swerve robot can face anywhere: turn it until its scoring side looks down the approach
	const endYaw = Math.atan2(A.x, A.z) - Math.atan2(score.dir.x, score.dir.z);
	const tipW = reach.tip.clone().applyAxisAngle(UP, endYaw);
	const end = branchTip.clone().sub(tipW).setY(0);
	// …but never closer to the REEF base than the bumpers allow
	const face = reefPt(red, FACE, REEF.apothem, 0, 0);
	const gap = face.clone().sub(end).dot(A) - (BUMPER_HALF + 0.02);
	if (gap < 0) end.addScaledVector(A, gap);

	// ---------------------------------------------------------------- the drive
	// off the starting line, along the far wall to the CORAL STATION, then around the near side of
	// the REEF and square into the face toward the BARGE
	const fieldPts: [number, number][] = [
		[START.x, START.y],
		[12.3, 6.95],
		[14.7, 7.0],
		[16.1, 6.8],
		[15.4, 5.2],
		[14.8, 2.5],
		[13.0, 1.45],
		[11.1, 2.0],
		[10.35, 3.2]
	];
	const pts = fieldPts.map(([x, y]) => toScene(x, y));
	pts.push(end.clone().addScaledVector(A, -1.15), end.clone());
	const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
	const truth = curve.getSpacedPoints(SAMPLES);
	const headings = truth.map((_, i) => {
		const t = curve.getTangentAt(i / SAMPLES);
		return Math.atan2(t.x, t.z);
	});
	// over the last few meters the robot yaws from its direction of travel to the scoring heading
	const pathLength = curve.getLength();
	const endTurn = wrapAngle(endYaw - headings[SAMPLES]);
	const turnAt = (t: number) =>
		endTurn * ease(THREE.MathUtils.clamp((t - (1 - 2.6 / pathLength)) / (2.1 / pathLength), 0, 1));

	// wheel odometry: integrate the true motion with a slowly growing heading bias and scale error
	const odo: THREE.Vector3[] = [truth[0].clone()];
	const rot = new THREE.Vector3();
	for (let i = 1; i <= SAMPLES; i++) {
		const d = rot.subVectors(truth[i], truth[i - 1]).multiplyScalar(1.04);
		d.applyAxisAngle(UP, 0.0009 * i);
		odo.push(odo[i - 1].clone().add(d));
	}
	// VSLAM estimate: truth plus centimeter-level jitter
	const rnd = mulberry32(11);
	const est = truth.map((p, i) =>
		i === 0 ? p.clone() : p.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.03))
	);

	const flat = (p: THREE.Vector3[]) => p.flatMap((q) => [q.x, 0.01, q.z]);
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
		new THREE.EdgesGeometry(new THREE.BoxGeometry(0.86, 0.24, 0.86)),
		new THREE.LineDashedMaterial({ color: INK, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0 })
	);
	ghost.computeLineDistances();
	ghost.position.y = 0.12;
	group.add(ghost);

	// ---------------------------------------------------------------- mapped features
	// points on the walls, REEFS, BARGE and stations that light up once the headset has seen them
	const features: number[] = [];
	const frng = mulberry32(3);
	const push = (p: THREE.Vector3) => features.push(p.x, p.y, p.z);
	for (let i = 0; i < 300; i++) {
		const x = STATION.dx + frng() * (L - 2 * STATION.dx);
		push(toScene(x, frng() < 0.5 ? 0 : W, 0.04 + frng() * (FIELD.guardrail - 0.08)));
	}
	for (let i = 0; i < 160; i++)
		push(toScene(frng() < 0.5 ? 0 : L, STATION.dy + frng() * (W - 2 * STATION.dy), 0.05 + frng() * 1.85));
	for (const [a, b] of stationEnds)
		for (let i = 0; i < 24; i++) {
			const q = a.clone().lerp(b, frng());
			push(toScene(q.x, q.y, 0.05 + frng() * (STATION.height - 0.1)));
		}
	for (const c of REEF.centers)
		for (let i = 0; i < 60; i++) {
			const k = Math.floor(frng() * 6);
			push(reefPt(c, k, REEF.apothem + 0.005, (frng() - 0.5) * 0.9, 0.03 + frng() * (REEF.trough - 0.06)));
		}
	for (let i = 0; i < 90; i++) {
		const y = MID_Y - BARGE.halfWidth + frng() * 2 * BARGE.halfWidth;
		push(toScene(BARGE.x + (frng() < 0.5 ? -0.15 : 0.15), y, BARGE.truss[0] + frng() * (BARGE.truss[1] - BARGE.truss[0])));
	}
	for (let i = 0; i < 120; i++) push(toScene(frng() * L, frng() * W, 0.01));

	const count = features.length / 3;
	const firstSeen = new Float32Array(count).fill(2);
	for (let s = 0; s <= SAMPLES; s += 2) {
		const p = truth[s];
		const h = headings[s] + turnAt(s / SAMPLES);
		const fx = Math.sin(h);
		const fz = Math.cos(h);
		for (let i = 0; i < count; i++) {
			if (firstSeen[i] < 2) continue;
			const dx = features[i * 3] - p.x;
			const dz = features[i * 3 + 2] - p.z;
			const d = Math.hypot(dx, dz);
			if (d < 6 && (dx * fx + dz * fz) / d > Math.cos(0.95)) firstSeen[i] = s / SAMPLES;
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
				// grow with nearness, but not into blobs when the camera comes down to the floor
				gl_PointSize = scale * min((2.0 + step(0.99, seen) * 1.5 + pulse * 6.0) * (14.0 / -mv.z), 4.0 + pulse * 6.0);
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

	const poseAt = (p: THREE.Vector3[], t: number): Pose => {
		const f = Math.min(t, 1) * SAMPLES;
		const i = Math.min(Math.floor(f), SAMPLES - 1);
		const k = f - i;
		const a = p[i];
		const b = p[i + 1];
		return {
			x: a.x + (b.x - a.x) * k,
			z: a.z + (b.z - a.z) * k,
			heading: Math.atan2(b.x - a.x, b.z - a.z)
		};
	};
	/** Add the end-of-drive yaw (the robot turns its scoring side to the REEF while driving straight). */
	const withYaw = (p: Pose, t: number): Pose => ({ ...p, heading: p.heading + turnAt(t) });
	const truthHeading = (t: number) => {
		const tan = curve.getTangentAt(Math.min(t, 1));
		return Math.atan2(tan.x, tan.z) + turnAt(t);
	};

	return {
		group,
		/** Where the robot stops, its yaw there, and the branch its coral meets. */
		end,
		endYaw,
		branchTip,
		score: { level, elevator: reach.elevator, reached: reach.ok && gap >= 0 },
		/** Robot pose `t` (0..1) of the way along the path; heading is where the robot faces, not where it drives. */
		truthAt: (t: number): Pose => {
			const p = curve.getPointAt(Math.min(t, 1));
			return { x: p.x, z: p.z, heading: truthHeading(t) };
		},
		// VSLAM heading is as good as its position; take it from the path rather than the jittered samples
		estAt: (t: number): Pose => ({ ...poseAt(est, t), heading: truthHeading(t) }),
		odoAt: (t: number) => withYaw(poseAt(odo, t), t),
		/** A scene pose in field terms for the HUD: x, z = −y (WPILib meters), heading = WPILib θ. */
		toField: (p: Pose): Pose => ({ x: p.x + START.x, z: p.z - START.y, heading: p.heading - Math.PI / 2 }),
		/** Show the field at `vis` (0..1) with the robot `t` (0..1) of the way along the path. */
		update(vis: number, t: number) {
			gridMat.opacity = 0.09 * vis;
			outlineMat.opacity = vis;
			structMat.opacity = 0.7 * vis;
			pipeMat.opacity = vis;
			baseEdgeMat.opacity = vis;
			tapeMat.opacity = 0.35 * vis;
			pointsMat.uniforms.opacity.value = vis;
			reefBases.forEach((o) => o.scale.setScalar(Math.max(vis, 0.0001)));
			const n = Math.floor(t * SAMPLES);
			(estLine.geometry as LineGeometry).instanceCount = n;
			(odoLine.geometry as LineGeometry).instanceCount = n;
			for (let i = 0; i < count; i++) {
				const f = firstSeen[i];
				seen[i] = f > 1 ? 0 : THREE.MathUtils.clamp((t - f) / 0.04, 0, 1);
			}
			pointsGeo.getAttribute('seen').needsUpdate = true;
			const o = withYaw(poseAt(odo, t), t);
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
