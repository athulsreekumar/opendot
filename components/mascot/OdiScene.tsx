"use client";

import { ContactShadows, Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { Canvas, invalidate, useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { flattenPose, POSES, type PoseName } from "./poses";

/**
 * Odi, the OpenDot mascot (PLAN §7.3): a real-time 3D glossy toy.
 * - Body: clearcoat sphere with a vertical teal gradient + fresnel rim injected via onBeforeCompile.
 * - Face / arms / props: small hand-built geometries, shared materials.
 * - Poses are data (poses.ts); every numeric value is damped toward the target pose each frame.
 * Lighting is fully local: Lightformer studio environment, no network fetches.
 */

// ---------------------------------------------------------------- constants
const SX = 1.04;
const SY = 0.96;
const SZ = 1.0;
const BRAND = { mint: "#5eead4", glow: "#2dd4bf", light: "#16b39b", base: "#0e9f8a", deep: "#0b7f70" };
const INK = "#071b1e";

/** z of the body ellipsoid at (x, y) */
function surfaceZ(x: number, y: number) {
	const q = 1 - (x / SX) ** 2 - (y / SY) ** 2;
	return Math.sqrt(Math.max(q, 0)) * SZ;
}
/** Position + outward-facing orientation on the body surface. */
function onBody(x: number, y: number, lift = 0) {
	const z = surfaceZ(x, y);
	const n = new THREE.Vector3(x / (SX * SX), y / (SY * SY), z / (SZ * SZ)).normalize();
	const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
	const pos = new THREE.Vector3(x, y, z).addScaledVector(n, lift);
	return { pos, quat };
}

const damp = (cur: number, target: number, lambda: number, dt: number) =>
	cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const pop = (w: number) => w + 0.16 * Math.sin(Math.min(Math.max(w, 0), 1) * Math.PI);
const setScale = (o: THREE.Object3D | null, x: number, y = x, z = x) => {
	if (!o) return;
	const on = Math.max(x, y, z) > 0.012;
	o.visible = on;
	o.scale.set(Math.max(x, 1e-4), Math.max(y, 1e-4), Math.max(z, 1e-4));
};

// ---------------------------------------------------------------- shared assets
let softTex: THREE.CanvasTexture | null = null;
function getSoftTexture() {
	if (softTex) return softTex;
	const c = document.createElement("canvas");
	c.width = c.height = 128;
	const g = c.getContext("2d");
	if (g) {
		const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
		grad.addColorStop(0, "rgba(255,255,255,1)");
		grad.addColorStop(0.45, "rgba(255,255,255,0.55)");
		grad.addColorStop(1, "rgba(255,255,255,0)");
		g.fillStyle = grad;
		g.fillRect(0, 0, 128, 128);
	}
	softTex = new THREE.CanvasTexture(c);
	softTex.colorSpace = THREE.SRGBColorSpace;
	return softTex;
}

function makeBodyMaterial() {
	const m = new THREE.MeshPhysicalMaterial({
		color: BRAND.base,
		roughness: 0.3,
		metalness: 0,
		clearcoat: 1,
		clearcoatRoughness: 0.06,
		envMapIntensity: 1,
		sheen: 0.6,
		sheenRoughness: 0.5,
		sheenColor: new THREE.Color(BRAND.mint),
	});
	m.onBeforeCompile = (shader) => {
		shader.uniforms.uTop = { value: new THREE.Color("#7df6e3") };
		shader.uniforms.uMid = { value: new THREE.Color("#13ad97") };
		shader.uniforms.uBot = { value: new THREE.Color("#056a5f") };
		shader.uniforms.uRim = { value: new THREE.Color("#7ffbe9") };
		shader.vertexShader = shader.vertexShader
			.replace("#include <common>", "#include <common>\nvarying vec3 vOPos;")
			.replace("#include <begin_vertex>", "#include <begin_vertex>\nvOPos = position;");
		shader.fragmentShader = shader.fragmentShader
			.replace(
				"#include <common>",
				"#include <common>\nvarying vec3 vOPos;\nuniform vec3 uTop;\nuniform vec3 uMid;\nuniform vec3 uBot;\nuniform vec3 uRim;",
			)
			.replace(
				"#include <color_fragment>",
				`#include <color_fragment>
				float gy = smoothstep(-0.9, 0.95, vOPos.y);
				vec3 gcol = mix(uBot, uMid, smoothstep(0.0, 0.55, gy));
				gcol = mix(gcol, uTop, smoothstep(0.5, 1.0, gy));
				diffuseColor.rgb = gcol;`,
			)
			.replace(
				"#include <emissivemap_fragment>",
				`#include <emissivemap_fragment>
				float fres = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.6);
				totalEmissiveRadiance += uRim * fres * 0.5;
				totalEmissiveRadiance += uMid * 0.05 * (1.0 - gy);`,
			);
	};
	m.customProgramCacheKey = () => "odi-body-v1";
	return m;
}

function star(outer: number, inner: number, points = 4) {
	const s = new THREE.Shape();
	for (let i = 0; i < points * 2; i++) {
		const r = i % 2 === 0 ? outer : inner;
		const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
		const x = Math.cos(a) * r;
		const y = Math.sin(a) * r;
		if (i === 0) s.moveTo(x, y);
		else s.lineTo(x, y);
	}
	s.closePath();
	return s;
}

function crescent(ro = 0.34, ri = 0.28, dx = 0.15, dy = 0.07) {
	const d = Math.hypot(dx, dy);
	const a = (ro * ro - ri * ri + d * d) / (2 * d);
	const w = Math.acos(a / ro);
	const phi = Math.atan2(dy, dx);
	const pts: THREE.Vector2[] = [];
	const N = 40;
	for (let i = 0; i <= N; i++) {
		const t = phi + w + ((Math.PI * 2 - 2 * w) * i) / N;
		pts.push(new THREE.Vector2(Math.cos(t) * ro, Math.sin(t) * ro));
	}
	// inner arc: from the outer arc's end point back to its start, through the side facing the outer centre
	const pEnd = pts[pts.length - 1] as THREE.Vector2;
	const pStart = pts[0] as THREE.Vector2;
	const sA = Math.atan2(pEnd.y - dy, pEnd.x - dx);
	let eA = Math.atan2(pStart.y - dy, pStart.x - dx);
	const mid = phi + Math.PI;
	const norm = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));
	for (const cand of [eA, eA + Math.PI * 2, eA - Math.PI * 2]) {
		if (Math.abs(norm((sA + cand) / 2 - mid)) < Math.PI / 2 && Math.abs(cand - sA) < Math.PI * 2) {
			eA = cand;
			break;
		}
	}
	for (let i = 1; i < N; i++) {
		const t = sA + ((eA - sA) * i) / N;
		pts.push(new THREE.Vector2(dx + Math.cos(t) * ri, dy + Math.sin(t) * ri));
	}
	return new THREE.Shape(pts);
}

function shieldShape(w = 0.3, top = 0.34, bottom = -0.5, r = 0.07) {
	const s = new THREE.Shape();
	s.moveTo(-w + r, top);
	s.lineTo(w - r, top);
	s.quadraticCurveTo(w, top, w, top - r);
	s.lineTo(w, 0.02);
	s.bezierCurveTo(w, bottom * 0.5, w * 0.4, bottom * 0.85, 0, bottom);
	s.bezierCurveTo(-w * 0.4, bottom * 0.85, -w, bottom * 0.5, -w, 0.02);
	s.lineTo(-w, top - r);
	s.quadraticCurveTo(-w, top, -w + r, top);
	return s;
}

// ---------------------------------------------------------------- scene types
interface Sim {
	S: Record<string, number>;
	t: number;
	frames: number;
	// squash & stretch spring
	sq: number;
	sqv: number;
	nextBlink: number;
	blinkStart: number;
	blinkAmt: number;
	swSpeed: number;
	look: { x: number; y: number };
}
type SimRef = MutableRefObject<Sim>;
interface Shared {
	body: THREE.MeshPhysicalMaterial;
	arm: THREE.MeshPhysicalMaterial;
	hand: THREE.MeshPhysicalMaterial;
	ink: THREE.MeshPhysicalMaterial;
	white: THREE.MeshPhysicalMaterial;
	glow: THREE.MeshStandardMaterial;
	gold: THREE.MeshStandardMaterial;
}

function useShared(): Shared {
	const shared = useMemo<Shared>(() => {
		const arm = new THREE.MeshPhysicalMaterial({
			color: "#14ad98",
			roughness: 0.3,
			clearcoat: 1,
			clearcoatRoughness: 0.08,
			sheen: 0.5,
			sheenColor: new THREE.Color(BRAND.mint),
		});
		const hand = new THREE.MeshPhysicalMaterial({
			color: "#ffffff",
			emissive: "#cffaf2",
			emissiveIntensity: 0.18,
			roughness: 0.28,
			clearcoat: 1,
			clearcoatRoughness: 0.06,
		});
		const ink = new THREE.MeshPhysicalMaterial({
			color: INK,
			roughness: 0.1,
			metalness: 0,
			clearcoat: 1,
			clearcoatRoughness: 0.03,
			envMapIntensity: 1.5,
		});
		const white = new THREE.MeshPhysicalMaterial({
			color: "#ffffff",
			roughness: 0.22,
			clearcoat: 1,
			clearcoatRoughness: 0.05,
		});
		const glow = new THREE.MeshStandardMaterial({
			color: BRAND.mint,
			emissive: BRAND.glow,
			emissiveIntensity: 0.55,
			roughness: 0.3,
		});
		const gold = new THREE.MeshStandardMaterial({
			color: "#ffe39a",
			emissive: "#ffc65c",
			emissiveIntensity: 0.5,
			roughness: 0.3,
			metalness: 0.1,
		});
		return { body: makeBodyMaterial(), arm, hand, ink, white, glow, gold };
	}, []);
	useEffect(
		() => () => {
			for (const m of Object.values(shared)) m.dispose();
		},
		[shared],
	);
	return shared;
}

// ---------------------------------------------------------------- face
const eyeCapsule = new THREE.CapsuleGeometry(0.112, 0.15, 8, 20);
const eyeDome = new THREE.SphereGeometry(0.125, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const catchSphere = new THREE.SphereGeometry(1, 16, 12);
const happyArc = (() => {
	const pts: THREE.Vector3[] = [];
	for (let i = 0; i <= 16; i++) {
		const a = THREE.MathUtils.degToRad(28 + (124 * i) / 16);
		pts.push(new THREE.Vector3(Math.cos(a) * 0.115, Math.sin(a) * 0.115 - 0.05, 0));
	}
	return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.03, 10, false);
})();
const capSphere = new THREE.SphereGeometry(0.03, 12, 10);

function Eye({ side, sim, sh }: { side: "L" | "R"; sim: SimRef; sh: Shared }) {
	const x = side === "L" ? -0.45 : 0.45;
	const frame = useMemo(() => onBody(x, -0.02, 0.0), [x]);
	const gaze = useRef<THREE.Group>(null);
	const open = useRef<THREE.Group>(null);
	const happy = useRef<THREE.Group>(null);
	const sleepy = useRef<THREE.Group>(null);
	useFrame(() => {
		const { S, look } = sim.current;
		const blink = sim.current.blinkAmt;
		const k = 1 - blink * 0.92;
		const wo = S[`e${side}_open`] ?? 0;
		const wh = S[`e${side}_happy`] ?? 0;
		const ws = S[`e${side}_sleepy`] ?? 0;
		setScale(open.current, pop(wo), pop(wo) * k, pop(wo));
		setScale(happy.current, pop(wh));
		setScale(sleepy.current, pop(ws), pop(ws) * Math.max(k, 0.12), pop(ws));
		if (gaze.current) {
			const lx = (S.lookX ?? 0) + look.x;
			const ly = (S.lookY ?? 0) + look.y;
			gaze.current.position.set(
				THREE.MathUtils.clamp(lx, -1.3, 1.3) * 0.05,
				THREE.MathUtils.clamp(ly, -1.3, 1.3) * 0.045,
				0,
			);
		}
	});
	return (
		<group position={frame.pos} quaternion={frame.quat}>
			<group ref={gaze}>
				<group ref={open}>
					<mesh geometry={eyeCapsule} material={sh.ink} scale={[1, 1, 0.55]} />
					<mesh geometry={catchSphere} material={CATCH_MAT} position={[0.04, 0.09, 0.06]} scale={0.042} />
					<mesh geometry={catchSphere} material={CATCH_MAT} position={[-0.04, -0.07, 0.058]} scale={0.019} />
				</group>
				<group ref={sleepy} rotation={[0, 0, side === "L" ? 0.09 : -0.09]}>
					<mesh geometry={eyeDome} material={sh.ink} position={[0, 0.03, 0]} scale={[1.08, 1.5, 0.5]} />
					<mesh geometry={catchSphere} material={CATCH_MAT} position={[0.04, -0.02, 0.045]} scale={0.026} />
				</group>
				<group ref={happy} position={[0, 0.02, 0.012]}>
					<mesh geometry={happyArc} material={sh.ink} />
					<mesh
						geometry={capSphere}
						material={sh.ink}
						position={[Math.cos(0.489) * 0.115, Math.sin(0.489) * 0.115 - 0.05, 0]}
					/>
					<mesh
						geometry={capSphere}
						material={sh.ink}
						position={[Math.cos(2.653) * 0.115, Math.sin(2.653) * 0.115 - 0.05, 0]}
					/>
				</group>
			</group>
		</group>
	);
}
const CATCH_MAT = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });

const mouthCurve = (() => {
	const pts: THREE.Vector3[] = [];
	for (let i = 0; i <= 24; i++) {
		const u = (i / 24) * 2 - 1;
		const x = u * 0.19;
		const yRel = -0.08 * (1 - u * u);
		pts.push(new THREE.Vector3(x, yRel, surfaceZ(x, -0.22 + yRel) + 0.004));
	}
	return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.026, 8, false);
})();
const mouthCap = new THREE.SphereGeometry(0.026, 10, 8);
const dMouth = (() => {
	const s = new THREE.Shape();
	s.moveTo(-0.115, 0);
	s.lineTo(0.115, 0);
	s.absellipse(0, 0, 0.115, 0.1, 0, Math.PI, true);
	return new THREE.ShapeGeometry(s, 20);
})();
const tongue = (() => {
	const s = new THREE.Shape();
	s.absellipse(0, -0.085, 0.065, 0.045, 0, Math.PI * 2, false);
	return new THREE.ShapeGeometry(s, 16);
})();
const MOUTH_IN = new THREE.MeshStandardMaterial({ color: "#04201f", roughness: 0.6, side: THREE.DoubleSide });
const TONGUE = new THREE.MeshStandardMaterial({ color: "#ff8fa3", roughness: 0.5, side: THREE.DoubleSide });

function Mouth({ sim, sh }: { sim: SimRef; sh: Shared }) {
	const smile = useRef<THREE.Group>(null);
	const open = useRef<THREE.Group>(null);
	useFrame(() => {
		const S = sim.current.S;
		const mo = Math.min(Math.max(S.mouthOpen ?? 0, 0), 1);
		const sm = S.smile ?? 1;
		setScale(smile.current, 1, sm * (1 - mo), 1);
		setScale(open.current, mo * 0.95 + 0.0001, mo, 1);
	});
	const endX = 0.19;
	return (
		<group position={[0, -0.22, 0]}>
			<group ref={smile}>
				<mesh geometry={mouthCurve} material={sh.ink} />
				<mesh geometry={mouthCap} material={sh.ink} position={[-endX, 0, surfaceZ(endX, -0.22) + 0.004]} />
				<mesh geometry={mouthCap} material={sh.ink} position={[endX, 0, surfaceZ(endX, -0.22) + 0.004]} />
			</group>
			<group ref={open} position={[0, 0.045, surfaceZ(0, -0.2) + 0.012]}>
				<mesh geometry={dMouth} material={MOUTH_IN} />
				<mesh geometry={tongue} material={TONGUE} position={[0, 0, 0.003]} />
			</group>
		</group>
	);
}

const decalGeo = new THREE.PlaneGeometry(1, 1);
function Blush({ side, sim }: { side: "L" | "R"; sim: SimRef }) {
	const x = side === "L" ? -0.7 : 0.7;
	const frame = useMemo(() => onBody(x, -0.16, 0.012), [x]);
	const mat = useMemo(
		() =>
			new THREE.MeshBasicMaterial({
				map: getSoftTexture(),
				color: "#ff8fb0",
				transparent: true,
				opacity: 0.55,
				depthWrite: false,
				toneMapped: false,
			}),
		[],
	);
	const ref = useRef<THREE.Mesh>(null);
	useFrame(() => {
		const b = sim.current.S.blush ?? 1;
		mat.opacity = 0.62 * b;
		if (ref.current) ref.current.visible = b > 0.02;
	});
	useEffect(() => () => mat.dispose(), [mat]);
	return (
		<mesh
			ref={ref}
			geometry={decalGeo}
			material={mat}
			position={frame.pos}
			quaternion={frame.quat}
			scale={[0.36, 0.24, 1]}
			renderOrder={2}
		/>
	);
}

function Shine() {
	const frame = useMemo(() => onBody(-0.43, 0.62, 0.006), []);
	const q = useMemo(
		() => frame.quat.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.62))),
		[frame],
	);
	const mat = useMemo(
		() =>
			new THREE.MeshBasicMaterial({
				map: getSoftTexture(),
				color: "#ffffff",
				transparent: true,
				opacity: 0.55,
				depthWrite: false,
				toneMapped: false,
			}),
		[],
	);
	useEffect(() => () => mat.dispose(), [mat]);
	return (
		<mesh
			geometry={decalGeo}
			material={mat}
			position={frame.pos}
			quaternion={q}
			scale={[0.5, 0.22, 1]}
			renderOrder={3}
		/>
	);
}

// ---------------------------------------------------------------- arms
const armCapsule = new THREE.CapsuleGeometry(0.15, 0.26, 10, 22);
const handSphere = new THREE.SphereGeometry(0.185, 28, 22);
const DOWN = new THREE.Vector3(0, -1, 0);

function Arm({ side, sim, sh, children }: { side: "L" | "R"; sim: SimRef; sh: Shared; children?: React.ReactNode }) {
	const g = useRef<THREE.Group>(null);
	const v = useMemo(() => new THREE.Vector3(), []);
	const q = useMemo(() => new THREE.Quaternion(), []);
	useFrame(() => {
		const { S, t } = sim.current;
		if (!g.current) return;
		v.set(S[`a${side}x`] ?? 0, S[`a${side}y`] ?? -1, S[`a${side}z`] ?? 0);
		const sw = S[`sw${side}`] ?? 0;
		if (sw > 0.001) {
			v.applyAxisAngle(Z_AXIS, Math.sin(t * sim.current.swSpeed) * sw);
		}
		v.normalize();
		q.setFromUnitVectors(DOWN, v);
		g.current.quaternion.copy(q);
	});
	const x = side === "L" ? -0.76 : 0.76;
	return (
		<group ref={g} position={[x, -0.2, 0.4]}>
			<mesh geometry={armCapsule} material={sh.arm} position={[0, -0.25, 0]} />
			<group position={[0, -0.6, 0]}>
				<mesh geometry={handSphere} material={sh.hand} />
				{children}
			</group>
		</group>
	);
}
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// ---------------------------------------------------------------- props
function usePropGroup(name: string, sim: SimRef, anim?: (g: THREE.Group, t: number, w: number) => void) {
	const ref = useRef<THREE.Group>(null);
	useFrame(() => {
		const g = ref.current;
		if (!g) return;
		const w = sim.current.S[`p_${name}`] ?? 0;
		const p = pop(w);
		setScale(g, p);
		if (g.visible) anim?.(g, sim.current.t, w);
	});
	return ref;
}

const dotSphere = new THREE.SphereGeometry(1, 28, 20);
function ThoughtProp({ sim, sh }: { sim: SimRef; sh: Shared }) {
	const dots: [number, number, number][] = [
		[0.98, 1.02, 0.1],
		[1.24, 1.3, 0.14],
		[1.52, 1.66, 0.22],
	];
	const ref = usePropGroup("thought", sim, (g, t) => {
		g.children.forEach((c, i) => {
			const d = dots[i];
			if (d) c.position.y = d[1] + Math.sin(t * 2.2 + i * 1.1) * 0.035;
		});
	});
	return (
		<group ref={ref}>
			{dots.map(([x, y, r], i) => (
				<mesh key={i} geometry={dotSphere} material={sh.white} position={[x, y, 0.2]} scale={r} />
			))}
		</group>
	);
}

const starGeo = (() => {
	const g = new THREE.ExtrudeGeometry(star(0.2, 0.055, 4), {
		depth: 0.05,
		bevelEnabled: true,
		bevelThickness: 0.03,
		bevelSize: 0.025,
		bevelSegments: 3,
	});
	g.center();
	return g;
})();
const SPARKS: { p: [number, number]; s: number; m: "glow" | "gold" | "white"; ph: number }[] = [
	{ p: [-1.38, 1.2], s: 1.1, m: "gold", ph: 0 },
	{ p: [1.42, 1.32], s: 1.35, m: "glow", ph: 1.3 },
	{ p: [1.62, 0.05], s: 0.7, m: "white", ph: 2.1 },
	{ p: [-1.62, 0.1], s: 0.75, m: "glow", ph: 0.7 },
	{ p: [0.15, 1.62], s: 0.8, m: "white", ph: 2.9 },
	{ p: [-0.75, 1.72], s: 0.55, m: "gold", ph: 1.9 },
];
function SparklesProp({ sim, sh }: { sim: SimRef; sh: Shared }) {
	const ref = usePropGroup("sparkles", sim, (g, t) => {
		g.children.forEach((c, i) => {
			const sp = SPARKS[i];
			if (!sp) return;
			const k = 0.72 + 0.28 * Math.sin(t * 3.2 + sp.ph);
			c.scale.setScalar(sp.s * k);
			c.rotation.z = Math.sin(t * 1.4 + sp.ph) * 0.25;
		});
	});
	return (
		<group ref={ref}>
			{SPARKS.map((s, i) => (
				<mesh
					key={i}
					geometry={starGeo}
					material={sh[s.m === "gold" ? "gold" : s.m === "glow" ? "glow" : "white"]}
					position={[s.p[0], s.p[1], 0.1]}
					scale={s.s}
				/>
			))}
		</group>
	);
}

const moonGeo = (() => {
	const g = new THREE.ExtrudeGeometry(crescent(), {
		depth: 0.07,
		bevelEnabled: true,
		bevelThickness: 0.045,
		bevelSize: 0.04,
		bevelSegments: 4,
		curveSegments: 40,
	});
	g.center();
	return g;
})();
function NightProp({ sim, sh }: { sim: SimRef; sh: Shared }) {
	const stars: [number, number, number, number][] = [
		[1.78, 0.35, 0.6, 0.4],
		[0.72, 1.58, 0.75, 1.5],
		[-1.45, 1.2, 0.55, 2.4],
		[-1.7, 0.1, 0.4, 3.1],
	];
	const ref = usePropGroup("night", sim, (g, t) => {
		const moon = g.children[0];
		if (moon) {
			moon.position.y = 1.18 + Math.sin(t * 1.5) * 0.05;
			moon.rotation.z = 0.35 + Math.sin(t * 1.1) * 0.05;
		}
		stars.forEach((s, i) => {
			const c = g.children[i + 1];
			if (c) {
				c.scale.setScalar(s[2] * (0.75 + 0.25 * Math.sin(t * 2.6 + s[3])));
				c.rotation.z = Math.sin(t + s[3]) * 0.2;
			}
		});
	});
	return (
		<group ref={ref}>
			<mesh geometry={moonGeo} material={sh.gold} position={[1.2, 1.18, 0.05]} scale={1.15} />
			{stars.map(([x, y], i) => (
				<mesh key={i} geometry={starGeo} material={sh.gold} position={[x, y, 0.05]} />
			))}
		</group>
	);
}

function BatonProp({ sh }: { sh: Shared }) {
	// lives inside the right hand: continues along the arm axis, tilted forward
	return (
		<group rotation={[0.6, 0, 0.35]} position={[0, -0.05, 0.02]}>
			<mesh position={[0, -0.32, 0]}>
				<cylinderGeometry args={[0.03, 0.04, 0.6, 14]} />
				<primitive object={sh.white} attach="material" />
			</mesh>
			<mesh position={[0, -0.64, 0]} geometry={dotSphere} scale={0.06}>
				<primitive object={sh.glow} attach="material" />
			</mesh>
			<mesh position={[0, -0.03, 0]} geometry={dotSphere} scale={0.05}>
				<primitive object={sh.gold} attach="material" />
			</mesh>
		</group>
	);
}

function ShieldProp({ sim, sh }: { sim: SimRef; sh: Shared }) {
	const rim = useMemo(
		() =>
			new THREE.ExtrudeGeometry(shieldShape(0.3, 0.33, -0.48), {
				depth: 0.06,
				bevelEnabled: true,
				bevelThickness: 0.035,
				bevelSize: 0.03,
				bevelSegments: 4,
				curveSegments: 20,
			}),
		[],
	);
	const face = useMemo(
		() =>
			new THREE.ExtrudeGeometry(shieldShape(0.235, 0.27, -0.4), {
				depth: 0.02,
				bevelEnabled: true,
				bevelThickness: 0.02,
				bevelSize: 0.015,
				bevelSegments: 3,
				curveSegments: 20,
			}),
		[],
	);
	const faceMat = useMemo(
		() => new THREE.MeshPhysicalMaterial({ color: BRAND.deep, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
		[],
	);
	useEffect(
		() => () => {
			rim.dispose();
			face.dispose();
			faceMat.dispose();
		},
		[rim, face, faceMat],
	);
	const ref = usePropGroup("shield", sim, (g, t) => {
		g.position.y = -0.68 + Math.sin(t * 1.6) * 0.012;
	});
	return (
		<group ref={ref} position={[0, -0.68, 0.8]} rotation={[-0.12, 0, 0]} scale={0.001}>
			<mesh geometry={rim} material={sh.white} />
			<mesh geometry={face} material={faceMat} position={[0, 0, 0.085]} />
			<group position={[0, -0.02, 0.15]}>
				<mesh position={[-0.075, -0.025, 0]} rotation={[0, 0, 0.78]}>
					<capsuleGeometry args={[0.036, 0.1, 6, 12]} />
					<primitive object={sh.white} attach="material" />
				</mesh>
				<mesh position={[0.06, 0.025, 0]} rotation={[0, 0, -0.78]}>
					<capsuleGeometry args={[0.036, 0.22, 6, 12]} />
					<primitive object={sh.white} attach="material" />
				</mesh>
			</group>
		</group>
	);
}

const flapShape = (() => {
	const s = new THREE.Shape();
	s.moveTo(-0.33, 0.01);
	s.lineTo(0.33, 0.01);
	s.lineTo(0.03, -0.2);
	s.quadraticCurveTo(0, -0.215, -0.03, -0.2);
	s.closePath();
	return new THREE.ExtrudeGeometry(s, {
		depth: 0.012,
		bevelEnabled: true,
		bevelThickness: 0.01,
		bevelSize: 0.008,
		bevelSegments: 2,
	});
})();
function EnvelopeProp({ sim, sh }: { sim: SimRef; sh: Shared }) {
	const flapMat = useMemo(
		() => new THREE.MeshPhysicalMaterial({ color: "#e4f7f3", roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
		[],
	);
	const ref = usePropGroup("envelope", sim, (g, t) => {
		g.position.y = -0.62 + Math.sin(t * 1.6) * 0.012;
	});
	useEffect(() => () => flapMat.dispose(), [flapMat]);
	return (
		<group ref={ref} position={[0, -0.62, 0.96]} rotation={[-0.08, 0, -0.1]} scale={0.001}>
			<RoundedBox args={[0.72, 0.46, 0.06]} radius={0.03} smoothness={3}>
				<primitive object={sh.white} attach="material" />
			</RoundedBox>
			<mesh geometry={flapShape} material={flapMat} position={[0, 0.2, 0.03]} />
			<mesh position={[0, 0.0, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
				<cylinderGeometry args={[0.05, 0.05, 0.03, 20]} />
				<meshPhysicalMaterial color={BRAND.base} roughness={0.25} clearcoat={1} />
			</mesh>
		</group>
	);
}

// ---------------------------------------------------------------- character
function Character({
	pose,
	sim,
	frozen,
	view,
	pointer,
}: {
	pose: PoseName;
	sim: SimRef;
	frozen: boolean;
	view: "full" | "head";
	pointer: MutableRefObject<{ x: number; y: number }>;
}) {
	const sh = useShared();
	const root = useRef<THREE.Group>(null);
	const body = useRef<THREE.Group>(null);
	const arms = useRef<THREE.Group>(null);
	const shadow = useRef<THREE.Group>(null);
	const target = useMemo(() => flattenPose(POSES[pose]), [pose]);
	const first = useRef(true);
	const lastPose = useRef(pose);
	const bodyGeo = useMemo(() => new THREE.SphereGeometry(1, 72, 54), []);
	const { camera } = useThree();
	useEffect(() => () => bodyGeo.dispose(), [bodyGeo]);

	useEffect(() => {
		if (lastPose.current !== pose) {
			lastPose.current = pose;
			if (!frozen) {
				sim.current.sq = -0.9;
				sim.current.sqv = 0;
			}
		}
		sim.current.swSpeed = POSES[pose].swing.speed || sim.current.swSpeed;
		invalidate();
	}, [pose, frozen, sim]);

	useFrame((_, rawDelta) => {
		const s = sim.current;
		const dt = Math.min(rawDelta, 0.05);
		const snap = first.current || frozen;
		if (first.current) {
			s.S = { ...target };
			first.current = false;
		}
		// advance time
		s.t = frozen ? POSES[pose].still : s.t + dt;
		const lam = snap ? 1000 : 9;
		for (const k in target) {
			const tv = target[k] as number;
			const cur = s.S[k] ?? tv;
			s.S[k] = snap ? tv : damp(cur, tv, k.startsWith("e") || k.startsWith("p_") ? 10 : lam, dt);
		}
		// spring (squash & stretch)
		if (!frozen) {
			const a = -260 * s.sq - 15 * s.sqv;
			s.sqv += a * dt;
			s.sq += s.sqv * dt;
		} else s.sq = 0;
		// blink
		let blink = 0;
		if (!frozen) {
			if (s.t > s.nextBlink) {
				s.blinkStart = s.t;
				s.nextBlink = s.t + 3 + Math.random() * 3;
			}
			const bt = (s.t - s.blinkStart) / 0.16;
			if (bt >= 0 && bt <= 1) blink = Math.sin(bt * Math.PI);
		}
		s.blinkAmt = blink;
		// cursor look
		if (!frozen) {
			s.look.x = damp(s.look.x, pointer.current.x, 7, dt);
			s.look.y = damp(s.look.y, pointer.current.y, 7, dt);
		} else {
			s.look.x = 0;
			s.look.y = 0;
		}
		const S = s.S;
		const float = frozen ? 0 : Math.sin((s.t * Math.PI * 2) / 4) * 0.06;
		const bounce = frozen ? 0 : Math.abs(Math.sin(s.t * 3.4)) * (S.bounce ?? 0);
		if (root.current) {
			root.current.position.y = (S.y ?? 0) + float + bounce;
			const sq = s.sq;
			root.current.scale.set(1 - sq * 0.07, 1 + sq * 0.12, 1 - sq * 0.07);
		}
		if (body.current) {
			const sway = frozen ? 0 : Math.sin(s.t * 1.2) * 0.02;
			body.current.rotation.set(
				-s.look.y * 0.14,
				s.look.x * 0.14 + sway,
				(S.tilt ?? 0) + (frozen ? 0 : Math.sin(s.t * 0.9) * 0.012),
				"YXZ",
			);
		}
		if (arms.current) arms.current.visible = view !== "head";
		if (shadow.current) shadow.current.visible = view !== "head";
		// camera framing
		const camZ = view === "head" ? 4.6 : (S.camZ ?? 8);
		const camY = view === "head" ? 0.02 : (S.camY ?? 0);
		camera.position.set(0, camY, camZ);
		camera.lookAt(0, camY, 0);
		s.frames++;
	});

	return (
		<>
			<group ref={root}>
				<group ref={body}>
					<mesh geometry={bodyGeo} material={sh.body} scale={[SX, SY, SZ]} />
					<Eye side="L" sim={sim} sh={sh} />
					<Eye side="R" sim={sim} sh={sh} />
					<Mouth sim={sim} sh={sh} />
					<Blush side="L" sim={sim} />
					<Blush side="R" sim={sim} />
					<Shine />
					<group ref={arms}>
						<Arm side="L" sim={sim} sh={sh} />
						<Arm side="R" sim={sim} sh={sh}>
							<BatonHolder sim={sim} sh={sh} />
						</Arm>
					</group>
				</group>
				{view !== "head" && (
					<>
						<ThoughtProp sim={sim} sh={sh} />
						<SparklesProp sim={sim} sh={sh} />
						<NightProp sim={sim} sh={sh} />
						<ShieldProp sim={sim} sh={sh} />
						<EnvelopeProp sim={sim} sh={sh} />
					</>
				)}
			</group>
			<group ref={shadow}>
				<ShadowRig sim={sim} frozen={frozen} />
			</group>
		</>
	);
}

function BatonHolder({ sim, sh }: { sim: SimRef; sh: Shared }) {
	const ref = usePropGroup("baton", sim);
	return (
		<group ref={ref}>
			<BatonProp sh={sh} />
		</group>
	);
}

function ShadowRig({ sim, frozen }: { sim: SimRef; frozen: boolean }) {
	const ref = useRef<THREE.Group>(null);
	const [opacity, setOpacity] = useState(0.4);
	const last = useRef(0.4);
	useFrame(() => {
		const sh = sim.current.S.shadow ?? 1;
		const o = 0.5 * sh;
		if (Math.abs(o - last.current) > 0.01) {
			last.current = o;
			setOpacity(o);
		}
		if (ref.current) ref.current.visible = sh > 0.02;
	});
	return (
		<group ref={ref}>
			<ContactShadows
				position={[0, -1.18, 0]}
				scale={6.5}
				blur={3.2}
				far={2.6}
				resolution={frozen ? 768 : 256}
				opacity={opacity}
				color="#053c36"
				frames={frozen ? 4 : Number.POSITIVE_INFINITY}
			/>
		</group>
	);
}

function Studio() {
	return (
		<>
			<Environment resolution={256} frames={1}>
				<color attach="background" args={["#0d2b28"]} />
				<Lightformer
					form="rect"
					intensity={5}
					color="#ffffff"
					position={[-3.2, 6.5, 4]}
					scale={[5, 3, 1]}
					target={[0, 0, 0]}
				/>
				<Lightformer
					form="rect"
					intensity={1.6}
					color="#d6fff7"
					position={[5.5, 1, 3.5]}
					scale={[3, 5, 1]}
					target={[0, 0, 0]}
				/>
				<Lightformer
					form="rect"
					intensity={3}
					color="#ffffff"
					position={[0, 5, -4]}
					scale={[9, 2, 1]}
					target={[0, 0, 0]}
				/>
				<Lightformer
					form="rect"
					intensity={1.4}
					color="#ffffff"
					position={[0, 7, 0]}
					rotation={[Math.PI / 2, 0, 0]}
					scale={[7, 7, 1]}
				/>
				<Lightformer
					form="rect"
					intensity={0.8}
					color="#5eead4"
					position={[0, -5, 1]}
					rotation={[-Math.PI / 2, 0, 0]}
					scale={[8, 8, 1]}
				/>
				<Lightformer
					form="rect"
					intensity={2.4}
					color="#ffffff"
					position={[-6.5, 0.5, 0]}
					scale={[0.7, 7, 1]}
					target={[0, 0, 0]}
				/>
				<Lightformer
					form="rect"
					intensity={2.4}
					color="#bffcf0"
					position={[6.5, 0.5, -1]}
					scale={[0.7, 7, 1]}
					target={[0, 0, 0]}
				/>
				<Lightformer form="ring" intensity={2} color="#ffffff" position={[2, 2.5, 6]} scale={1.5} target={[0, 0, 0]} />
			</Environment>
			<ambientLight intensity={0.12} color="#e6fffb" />
			<directionalLight position={[3, 4.5, 6]} intensity={1.1} color="#ffffff" />
			<directionalLight position={[-5, 1, 3]} intensity={0.35} color="#9ff5e6" />
		</>
	);
}

// ---------------------------------------------------------------- public component
export interface OdiSceneProps {
	pose: PoseName;
	/** Render once with the animation frozen at the pose's "nice frame" (static renders). */
	still?: boolean;
	/** "head" frames only the body/face for favicon-style crops. */
	view?: "full" | "head";
	/** Called after the first few frames have been drawn. */
	onReady?: () => void;
	className?: string;
}

function useReducedMotion() {
	const [reduced, setReduced] = useState(() =>
		typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	);
	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const on = () => setReduced(mq.matches);
		mq.addEventListener("change", on);
		return () => mq.removeEventListener("change", on);
	}, []);
	return reduced;
}

function ReadyProbe({ sim, onReady, frozen }: { sim: SimRef; onReady?: () => void; frozen: boolean }) {
	const done = useRef(false);
	useFrame(() => {
		const n = sim.current.frames;
		// frozen (demand) renders: keep drawing for a short burst so the environment cube + shadows settle
		if (frozen && n < 30) invalidate();
		if (!done.current && n >= 3) {
			done.current = true;
			onReady?.();
		}
	});
	return null;
}

export default function OdiScene({ pose, still = false, view = "full", onReady, className }: OdiSceneProps) {
	const reduced = useReducedMotion();
	const frozen = still || reduced;
	const wrap = useRef<HTMLDivElement>(null);
	const pointer = useRef({ x: 0, y: 0 });
	const [visible, setVisible] = useState(true);
	const [docVisible, setDocVisible] = useState(true);
	const sim = useRef<Sim>({
		S: {},
		t: 0,
		frames: 0,
		sq: 0,
		sqv: 0,
		nextBlink: 2 + Math.random() * 2,
		blinkStart: -10,
		blinkAmt: 0,
		swSpeed: 6,
		look: { x: 0, y: 0 },
	});

	// visibility gating: only run the render loop while on screen and the tab is visible
	useEffect(() => {
		const el = wrap.current;
		if (!el) return;
		const io = new IntersectionObserver((e) => setVisible(e.some((x) => x.isIntersecting)), { rootMargin: "80px" });
		io.observe(el);
		const onVis = () => setDocVisible(!document.hidden);
		document.addEventListener("visibilitychange", onVis);
		return () => {
			io.disconnect();
			document.removeEventListener("visibilitychange", onVis);
		};
	}, []);

	// cursor tracking (window-level, desktop pointer only, never in reduced-motion / still)
	useEffect(() => {
		if (frozen || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
		const el = wrap.current;
		if (!el) return;
		const onMove = (e: PointerEvent) => {
			const r = el.getBoundingClientRect();
			const cx = r.left + r.width / 2;
			const cy = r.top + r.height / 2;
			const R = Math.max(360, r.width * 1.6);
			pointer.current.x = THREE.MathUtils.clamp((e.clientX - cx) / R, -1, 1);
			pointer.current.y = THREE.MathUtils.clamp(-(e.clientY - cy) / R, -1, 1);
		};
		window.addEventListener("pointermove", onMove, { passive: true });
		return () => window.removeEventListener("pointermove", onMove);
	}, [frozen]);

	const frameloop = frozen ? "demand" : visible && docVisible ? "always" : "never";

	return (
		<div ref={wrap} className={className} style={{ width: "100%", height: "100%" }}>
			<Canvas
				frameloop={frameloop}
				dpr={[1, 2]}
				camera={{ fov: 30, position: [0, 0, 8], near: 0.1, far: 50 }}
				gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
				onCreated={({ gl }) => {
					gl.setClearColor(0x000000, 0);
					gl.toneMapping = THREE.NeutralToneMapping;
					gl.toneMappingExposure = 1;
				}}
				style={{ background: "transparent" }}
			>
				<Studio />
				<Character pose={pose} sim={sim} frozen={frozen} view={view} pointer={pointer} />
				<ReadyProbe sim={sim} onReady={onReady} frozen={frozen} />
			</Canvas>
		</div>
	);
}
