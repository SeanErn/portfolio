import * as THREE from 'three';
import { buildChassis } from './chassis';
import { buildEffector } from './effector';
import { CARRIAGE_TRAVEL, MOUNT, STAGE_TRAVEL, buildSuperstructure } from './superstructure';

/**
 * FRC 5152's 2025 (Reefscape) competition robot, procedurally, after reference photos: square swerve
 * base with red 5152 bumpers, carbon electronics hump along the front with the radio, Quest mast and
 * beacon at front-center, a black two-stage cascade elevator just left of center braced to the right
 * side, and a pivoting roller end effector on the elevator's left (+x) side that scores coral out
 * that side.
 *
 * Coordinates: meters, origin on the floor at the center of the frame, +y up, +z = robot forward
 * (the side the Quest looks out of). Frame perimeter 0.70 m square, bumpers ≈ 0.87 m outside.
 */
export type RobotPose = {
	/** Elevator extension, 0 = stowed, 1 = fully raised. */
	elevator: number;
	/** End-effector pivot in radians: 0 = stowed, positive tips it out toward the scoring side. */
	wrist: number;
	/** Coral (white PVC tube) in the end effector: 0 = held, 1 = fully released and gone. */
	coral: number;
};

export type Robot2025 = {
	group: THREE.Group;
	/**
	 * Where the Quest 3 headset sits (front-center mast under the beacon light): the center of the
	 * visor body, +z out of the visor.
	 */
	mount: THREE.Object3D;
	/** A point at the business end of the coral in the end effector (moves with elevator/wrist). */
	scoreTip: THREE.Object3D;
	/** Which side of the robot the end effector scores toward, in robot-local space (unit vector). */
	scoreDir: THREE.Vector3;
	setPose(p: RobotPose): void;
};

export function buildRobot2025(): Robot2025 {
	const group = new THREE.Group();
	group.name = 'robot2025';
	buildChassis(group);
	const { stage2, carriage, hang } = buildSuperstructure(group);
	const effector = buildEffector();
	carriage.add(effector.arm);

	const mount = new THREE.Object3D();
	mount.position.copy(MOUNT);
	group.add(mount);

	const carriageY = carriage.position.y;
	const setPose = ({ elevator, wrist, coral }: RobotPose) => {
		const e = THREE.MathUtils.clamp(elevator, 0, 1);
		stage2.position.y = e * STAGE_TRAVEL;
		carriage.position.y = carriageY + e * CARRIAGE_TRAVEL;
		hang(stage2.position.y + carriage.position.y);
		effector.arm.rotation.z = -wrist;
		effector.setCoral(coral);
	};
	setPose({ elevator: 0, wrist: 0, coral: 0 });

	return { group, mount, scoreTip: effector.scoreTip, scoreDir: new THREE.Vector3(1, 0, 0), setPose };
}
