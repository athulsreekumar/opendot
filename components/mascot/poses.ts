/**
 * Odi pose data (PLAN §7.3). Poses are pure data: arm directions, eye style, mouth, tilt, prop and camera framing.
 * `flattenPose` turns a pose into a flat numeric record that the scene damps toward every frame.
 */

export const POSE_NAMES = ["hero", "thinking", "cheer", "night", "conductor", "shield", "envelope", "peek"] as const;
export type PoseName = (typeof POSE_NAMES)[number];

export type EyeStyle = "open" | "happy" | "sleepy";
export type PropName = "thought" | "sparkles" | "night" | "baton" | "shield" | "envelope";
export type Vec3 = readonly [number, number, number];

export interface Pose {
	/** Accessible description, used for the default aria-label. */
	label: string;
	/** Direction each arm points (body space, +x = screen right, -y = down, +z = toward camera). */
	armL: Vec3;
	armR: Vec3;
	/** Looping arm swing (wave / conducting): which arm, amplitude (rad) and speed (rad/s). */
	swing: { arm: "L" | "R" | null; amp: number; speed: number };
	eyeL: EyeStyle;
	eyeR: EyeStyle;
	/** Smile curvature, 0 = flat, 1 = default, negative = frown. */
	smile: number;
	/** Open "D" mouth amount 0..1. */
	mouthOpen: number;
	blush: number;
	/** Head/body roll in radians. */
	tilt: number;
	/** Body vertical offset (world units). */
	y: number;
	/** Base gaze offset added to the cursor look (-1..1). */
	lookX: number;
	lookY: number;
	prop: PropName | null;
	/** Camera framing: look-at height and distance. */
	cam: { y: number; z: number };
	/** Contact-shadow opacity multiplier. */
	shadow: number;
	/** Extra jump bounce amplitude (cheer). */
	bounce: number;
	/** Time (s) in the animation used for the frozen "still" render. */
	still: number;
}

const L_REST: Vec3 = [-0.5, -0.86, 0.12];
const CAM = { y: 0.0, z: 6.9 };

export const POSES: Record<PoseName, Pose> = {
	hero: {
		label: "Odi, the OpenDot mascot, waving hello",
		armL: [-0.52, -0.84, 0.15],
		armR: [0.86, 0.5, 0.1],
		swing: { arm: "R", amp: 0.32, speed: 7 },
		eyeL: "open",
		eyeR: "open",
		smile: 1,
		mouthOpen: 0,
		blush: 1,
		tilt: -0.04,
		y: 0,
		lookX: 0,
		lookY: 0,
		prop: null,
		cam: CAM,
		shadow: 1,
		bounce: 0,
		still: 0.28,
	},
	thinking: {
		label: "Odi, the OpenDot mascot, thinking with a hand on the chin",
		armL: L_REST,
		armR: [-0.62, -0.4, 0.66],
		swing: { arm: null, amp: 0, speed: 0 },
		eyeL: "open",
		eyeR: "open",
		smile: 0.25,
		mouthOpen: 0,
		blush: 0.7,
		tilt: 0.1,
		y: 0,
		lookX: 0.5,
		lookY: 0.8,
		prop: "thought",
		cam: { y: 0.2, z: 7.2 },
		shadow: 1,
		bounce: 0,
		still: 0,
	},
	cheer: {
		label: "Odi, the OpenDot mascot, cheering with both arms up",
		armL: [-0.62, 0.78, 0.1],
		armR: [0.62, 0.78, 0.1],
		swing: { arm: null, amp: 0, speed: 0 },
		eyeL: "happy",
		eyeR: "happy",
		smile: 1,
		mouthOpen: 1,
		blush: 1,
		tilt: 0,
		y: 0.12,
		lookX: 0,
		lookY: 0,
		prop: "sparkles",
		cam: { y: 0.15, z: 7.2 },
		shadow: 0.8,
		bounce: 0.1,
		still: 0.4,
	},
	night: {
		label: "Odi, the OpenDot mascot, sleepy-eyed beside a crescent moon and stars",
		armL: [-0.44, -0.88, 0.14],
		armR: [0.44, -0.88, 0.14],
		swing: { arm: null, amp: 0, speed: 0 },
		eyeL: "sleepy",
		eyeR: "sleepy",
		smile: 0.7,
		mouthOpen: 0,
		blush: 0.8,
		tilt: -0.1,
		y: 0,
		lookX: 0,
		lookY: -0.2,
		prop: "night",
		cam: { y: 0.2, z: 7.2 },
		shadow: 1,
		bounce: 0,
		still: 0.2,
	},
	conductor: {
		label: "Odi, the OpenDot mascot, conducting with a baton",
		armL: [-0.7, -0.45, 0.35],
		armR: [0.3, 0.85, 0.42],
		swing: { arm: "R", amp: 0.22, speed: 5 },
		eyeL: "open",
		eyeR: "open",
		smile: 1.1,
		mouthOpen: 0,
		blush: 1,
		tilt: -0.06,
		y: 0,
		lookX: 0.25,
		lookY: 0.15,
		prop: "baton",
		cam: { y: 0.2, z: 7.2 },
		shadow: 1,
		bounce: 0,
		still: 0.15,
	},
	shield: {
		label: "Odi, the OpenDot mascot, holding a shield with a check mark",
		armL: [0.5, -0.5, 0.7],
		armR: [-0.5, -0.5, 0.7],
		swing: { arm: null, amp: 0, speed: 0 },
		eyeL: "open",
		eyeR: "open",
		smile: 0.9,
		mouthOpen: 0,
		blush: 0.9,
		tilt: 0,
		y: 0.02,
		lookX: 0,
		lookY: 0.05,
		prop: "shield",
		cam: CAM,
		shadow: 1,
		bounce: 0,
		still: 0,
	},
	envelope: {
		label: "Odi, the OpenDot mascot, holding a letter",
		armL: [0.5, -0.5, 0.7],
		armR: [-0.5, -0.5, 0.7],
		swing: { arm: null, amp: 0, speed: 0 },
		eyeL: "open",
		eyeR: "happy",
		smile: 1,
		mouthOpen: 0,
		blush: 1,
		tilt: 0.05,
		y: 0.02,
		lookX: 0,
		lookY: 0,
		prop: "envelope",
		cam: CAM,
		shadow: 1,
		bounce: 0,
		still: 0,
	},
	peek: {
		label: "Odi, the OpenDot mascot, peeking up over an edge",
		armL: [-0.78, 0.5, 0.2],
		armR: [0.78, 0.5, 0.2],
		swing: { arm: null, amp: 0, speed: 0 },
		eyeL: "open",
		eyeR: "open",
		smile: 0.5,
		mouthOpen: 0,
		blush: 0.8,
		tilt: 0,
		y: -2.35,
		lookX: 0.2,
		lookY: 1,
		prop: null,
		cam: { y: -1.35, z: 6.3 },
		shadow: 0,
		bounce: 0,
		still: 0,
	},
};

export function isPoseName(v: string | null | undefined): v is PoseName {
	return !!v && (POSE_NAMES as readonly string[]).includes(v);
}

export const PROP_NAMES: readonly PropName[] = ["thought", "sparkles", "night", "baton", "shield", "envelope"];
const EYE_STYLES: readonly EyeStyle[] = ["open", "happy", "sleepy"];

/** Flat numeric target for the scene to damp toward. */
export function flattenPose(p: Pose): Record<string, number> {
	const o: Record<string, number> = {
		aLx: p.armL[0],
		aLy: p.armL[1],
		aLz: p.armL[2],
		aRx: p.armR[0],
		aRy: p.armR[1],
		aRz: p.armR[2],
		swL: p.swing.arm === "L" ? p.swing.amp : 0,
		swR: p.swing.arm === "R" ? p.swing.amp : 0,
		smile: p.smile,
		mouthOpen: p.mouthOpen,
		blush: p.blush,
		tilt: p.tilt,
		y: p.y,
		lookX: p.lookX,
		lookY: p.lookY,
		camY: p.cam.y,
		camZ: p.cam.z,
		shadow: p.shadow,
		bounce: p.bounce,
	};
	for (const side of ["L", "R"] as const) {
		const style = side === "L" ? p.eyeL : p.eyeR;
		for (const s of EYE_STYLES) o[`e${side}_${s}`] = style === s ? 1 : 0;
	}
	for (const name of PROP_NAMES) o[`p_${name}`] = p.prop === name ? 1 : 0;
	return o;
}
