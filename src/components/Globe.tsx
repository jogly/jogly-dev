import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cellToBoundary, gridDisk, latLngToCell } from "h3-js";
import { getLandCells } from "../lib/landCells";
import { getCityStreets } from "../lib/cityStreets";
import { WORK } from "../data";

function latLngToVec3(lat: number, lng: number, r = 1): THREE.Vector3 {
	const phi = (90 - lat) * (Math.PI / 180);
	const theta = (lng + 180) * (Math.PI / 180);
	return new THREE.Vector3(
		-r * Math.sin(phi) * Math.cos(theta),
		r * Math.cos(phi),
		r * Math.sin(phi) * Math.sin(theta),
	);
}

function cssVar(name: string, fallback: string): string {
	if (typeof window === "undefined") return fallback;
	const v = getComputedStyle(document.documentElement)
		.getPropertyValue(name)
		.trim();
	return v || fallback;
}

const VERT = `
	varying vec3 vWorldNormal;
	varying vec3 vWorldPos;
	void main() {
		vec4 wp = modelMatrix * vec4(position, 1.0);
		vWorldPos = wp.xyz;
		vWorldNormal = normalize(mat3(modelMatrix) * normalize(position));
		gl_Position = projectionMatrix * viewMatrix * wp;
	}
`;

const FRAG = `
	uniform vec3 uColor;
	uniform float uOpacity;
	uniform float uEdge0;
	uniform float uEdge1;
	varying vec3 vWorldNormal;
	varying vec3 vWorldPos;
	void main() {
		vec3 viewDir = normalize(cameraPosition - vWorldPos);
		float facing = max(dot(vWorldNormal, viewDir), 0.0);
		float a = pow(smoothstep(uEdge0, uEdge1, facing), 2.0) * uOpacity;
		gl_FragColor = vec4(uColor, a);
	}
`;

function makeShader(color: THREE.Color, edge0: number, edge1: number) {
	return new THREE.ShaderMaterial({
		transparent: true,
		uniforms: {
			uColor: { value: color },
			uOpacity: { value: 0 },
			uEdge0: { value: edge0 },
			uEdge1: { value: edge1 },
		},
		vertexShader: VERT,
		fragmentShader: FRAG,
	});
}

function buildCellLines(
	cells: string[],
	radius: number,
): THREE.BufferGeometry {
	const positions: number[] = [];
	for (const cell of cells) {
		const boundary = cellToBoundary(cell, true);
		const verts = boundary.map(([lng, lat]) => latLngToVec3(lat, lng, radius));
		for (let i = 0; i < verts.length; i++) {
			const a = verts[i];
			const b = verts[(i + 1) % verts.length];
			positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
		}
	}
	const geom = new THREE.BufferGeometry();
	geom.setAttribute(
		"position",
		new THREE.BufferAttribute(new Float32Array(positions), 3),
	);
	return geom;
}

type Props = { activeIndex: number | null };

export function Globe({ activeIndex }: Props) {
	const mountRef = useRef<HTMLDivElement>(null);
	const activeRef = useRef<number | null>(activeIndex);

	useEffect(() => {
		activeRef.current = activeIndex;
	}, [activeIndex]);

	useEffect(() => {
		const mount = mountRef.current;
		if (!mount) return;
		const mountEl: HTMLDivElement = mount;

		const root = document.querySelector(".v-anchor") as HTMLElement | null;
		const styleHost = root ?? document.documentElement;
		const inkHex =
			getComputedStyle(styleHost).getPropertyValue("--ink").trim() ||
			"#0B0907";
		const midHex =
			getComputedStyle(styleHost).getPropertyValue("--mid").trim() ||
			"#5A534B";
		const accentHex =
			getComputedStyle(styleHost).getPropertyValue("--accent").trim() ||
			"#C33E20";

		const inkColor = new THREE.Color(inkHex);
		const midColor = new THREE.Color(midHex);
		const accentColor = new THREE.Color(accentHex);

		const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		mountEl.appendChild(renderer.domElement);

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 10);
		camera.position.set(0, 0, 3.6);
		camera.lookAt(0, 0, 0);

		const globeGroup = new THREE.Group();
		scene.add(globeGroup);

		const sphereMat = new THREE.MeshBasicMaterial({
			color: cssVar("--bg", "#F4F1E8"),
			transparent: true,
			opacity: 0.95,
		});
		const sphere = new THREE.Mesh(
			new THREE.SphereGeometry(0.9995, 96, 96),
			sphereMat,
		);
		globeGroup.add(sphere);

		// Per-city multi-resolution rings. Each resolution fades in at a different
		// zoom level, giving the sensation of drilling into finer H3 hexes.
		const CITY_LAYERS: { res: number; k: number; radius: number }[] = [
			{ res: 5, k: 10, radius: 1.0015 },
			{ res: 7, k: 30, radius: 1.0025 },
			{ res: 9, k: 90, radius: 1.0035 },
		];

		const GEO_WORK = WORK.map((w, i) => ({ w, i })).filter((x) => !!x.w.coord);

		const cityLayers: THREE.LineSegments[][] = GEO_WORK.map(({ w }) => {
			return CITY_LAYERS.map(({ res, k, radius }) => {
				const cell = latLngToCell(w.coord![0], w.coord![1], res);
				const disk = gridDisk(cell, k);
				const geom = buildCellLines(disk, radius);
				const color = res >= 9 ? accentColor : res >= 7 ? midColor : inkColor;
				const mat = makeShader(color, 0.1, 0.9);
				const ls = new THREE.LineSegments(geom, mat);
				globeGroup.add(ls);
				return ls;
			});
		});

		// Lazy-loaded street layers per city (indexed by GEO_WORK position)
		const streetLayers: (THREE.LineSegments | null)[] = GEO_WORK.map(() => null);
		const streetRequested: boolean[] = GEO_WORK.map(() => false);

		function ensureStreets(gi: number) {
			if (streetRequested[gi]) return;
			streetRequested[gi] = true;
			const w = GEO_WORK[gi].w;
			getCityStreets(w.coord![0], w.coord![1])
				.then((segs) => {
					if (disposed || !segs.length) return;
					const positions: number[] = [];
					for (const seg of segs) {
						for (let j = 0; j < seg.length - 1; j++) {
							const a = latLngToVec3(seg[j][0], seg[j][1], 1.004);
							const b = latLngToVec3(seg[j + 1][0], seg[j + 1][1], 1.004);
							positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
						}
					}
					const geom = new THREE.BufferGeometry();
					geom.setAttribute(
						"position",
						new THREE.BufferAttribute(new Float32Array(positions), 3),
					);
					const mat = makeShader(inkColor, 0.05, 0.6);
					const ls = new THREE.LineSegments(geom, mat);
					globeGroup.add(ls);
					streetLayers[gi] = ls;
				})
				.catch(() => {
					/* offline or rate-limited — skip silently */
				});
		}

		let landLines: THREE.LineSegments | null = null;
		let disposed = false;

		getLandCells(3)
			.then((cells) => {
				if (disposed) return;
				const geom = buildCellLines(cells, 1.001);
				const mat = makeShader(inkColor, 0.0, 0.7);
				mat.uniforms.uOpacity.value = 0.7;
				landLines = new THREE.LineSegments(geom, mat);
				globeGroup.add(landLines);
			})
			.catch((err) => console.error("[globe] failed to load land cells", err));

		const targetVecs = GEO_WORK.map(({ w }) =>
			latLngToVec3(w.coord![0], w.coord![1], 1),
		);
		const forward = new THREE.Vector3(0, 0, 1);
		const targetQuats = targetVecs.map((v) => {
			const q = new THREE.Quaternion();
			q.setFromUnitVectors(v.clone().normalize(), forward);
			return q;
		});

		const currentQuat = new THREE.Quaternion().copy(targetQuats[0]);
		globeGroup.quaternion.copy(currentQuat);

		// Shared transition driver: both rotation and zoom are functions of
		// `transitionP` (0 → 1) so the camera elevates up, arcs over, and
		// settles back down in lock-step with the slerp. Independent lerps
		// cause the "already arrived while still descending" artifact.
		const fromQuat = new THREE.Quaternion().copy(targetQuats[0]);
		const toQuat = new THREE.Quaternion().copy(targetQuats[0]);
		let transitionP = 1;
		let transitionAngle = 0;
		let currentGeoIdx: number | null = 0;

		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		let baseDistance = 3.6;
		const zoomedDistance = 1.006;
		let currentDistance = zoomedDistance;

		mountEl.style.opacity = "0";
		mountEl.style.transition = "opacity 700ms ease-out";
		requestAnimationFrame(() => {
			mountEl.style.opacity = "1";
		});

		function smoothRange(t: number, a: number, b: number): number {
			const x = (t - a) / Math.max(1e-6, b - a);
			return Math.max(0, Math.min(1, x));
		}

		function onResize() {
			const w = mountEl.clientWidth;
			const h = mountEl.clientHeight;
			renderer.setSize(w, h, true);
			const aspect = w / Math.max(1, h);
			camera.aspect = aspect;
			const vFov = (35 * Math.PI) / 180;
			const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
			const minFov = Math.min(vFov, hFov);
			baseDistance = Math.max(2.6, 1 / Math.sin(minFov / 2) + 0.25);
			camera.updateProjectionMatrix();
		}
		const ro = new ResizeObserver(onResize);
		ro.observe(mountEl);
		onResize();
		window.addEventListener("resize", onResize);

		let raf = 0;
		function tick() {
			raf = requestAnimationFrame(tick);

			const rawActive = activeRef.current;
			const active =
				rawActive == null
					? null
					: GEO_WORK.findIndex((x) => x.i === rawActive);

			// Detect target change → start a new synchronized transition.
			if (active != null && active >= 0 && active !== currentGeoIdx) {
				fromQuat.copy(currentQuat);
				toQuat.copy(targetQuats[active]);
				transitionAngle = fromQuat.angleTo(toQuat);
				transitionP = 0;
				currentGeoIdx = active;
				ensureStreets(active);
			}

			// Advance progress. Longer arcs take longer so the flyover has
			// room to breathe; short hops complete quickly.
			const duration = 0.9 + (transitionAngle / Math.PI) * 1.2; // seconds
			const step = 1 / (60 * duration);
			if (transitionP < 1) {
				transitionP = Math.min(1, transitionP + step);
			}

			if (reducedMotion) {
				currentQuat.copy(toQuat);
			} else {
				// Sinusoidal ease-in-out — no second-derivative jumps at the
				// endpoints, which is what makes smoothstep feel snappy.
				const eased = 0.5 - 0.5 * Math.cos(Math.PI * transitionP);
				currentQuat.copy(fromQuat).slerp(toQuat, eased);
			}
			globeGroup.quaternion.copy(currentQuat);

			// Elevation peaks mid-transition and returns to 0 when the rotation
			// lands. sin(πp) matches the cosine rotation ease so altitude and
			// heading share a single "flight path" feel.
			const arcPeak = Math.min(1, transitionAngle / (Math.PI * 0.5));
			const liftShape = Math.sin(Math.PI * transitionP);
			// Cap the peak well below full zoom-out so the camera stays inside
			// the hex grid's legible range.
			const liftMax = (baseDistance - zoomedDistance) * 0.45;
			const zoomTarget =
				active != null && active >= 0
					? zoomedDistance + liftMax * liftShape * arcPeak
					: baseDistance;
			currentDistance = zoomTarget;
			camera.position.z = currentDistance;

			// Normalized zoom 0 (out) → 1 (in)
			const zoomT = smoothRange(
				currentDistance,
				zoomedDistance,
				baseDistance,
			);
			const zin = 1 - zoomT;

			// Non-overlapping bands so only ONE grid dominates at any moment.
			// Each tuple is [fadeInStart, fullIn, fadeOutStart, fullOut, max].
			// Where consecutive bands touch (e.g. 0.45==0.45) the crossfade is
			// a clean swap — no time where two grids are both partially visible.
			const bands: [number, number, number, number, number][] = [
				// res 5 — country/state level
				[0.15, 0.35, 0.55, 0.7, 0.75],
				// res 7 — regional
				[0.55, 0.7, 0.8, 0.9, 0.8],
				// res 9 — block level, holds on at rest so the hex grid stays
				// visible under the streets when fully landed.
				[0.8, 0.92, 1.5, 1.5, 0.75],
			];

			function band(t: number, b: [number, number, number, number, number]) {
				const [a0, a1, a2, a3, max] = b;
				return smoothRange(t, a0, a1) * (1 - smoothRange(t, a2, a3)) * max;
			}

			for (let i = 0; i < cityLayers.length; i++) {
				const isActive = active === i;
				const layers = cityLayers[i];
				for (let r = 0; r < layers.length; r++) {
					const mat = layers[r].material as THREE.ShaderMaterial;
					const on = isActive ? band(zin, bands[r]) : 0;
					mat.uniforms.uOpacity.value +=
						(on - mat.uniforms.uOpacity.value) * 0.1;
				}
				const streets = streetLayers[i];
				if (streets) {
					const mat = streets.material as THREE.ShaderMaterial;
					// Streets take over from res 9 at the very deepest zoom.
					const on = isActive ? smoothRange(zin, 0.88, 0.98) * 0.85 : 0;
					mat.uniforms.uOpacity.value +=
						(on - mat.uniforms.uOpacity.value) * 0.1;
				}
			}

			if (landLines) {
				const mat = landLines.material as THREE.ShaderMaterial;
				// Land wireframe hands off to res 5 cleanly.
				const on = 0.7 * (1 - smoothRange(zin, 0.18, 0.35));
				mat.uniforms.uOpacity.value +=
					(on - mat.uniforms.uOpacity.value) * 0.1;
			}

			renderer.render(scene, camera);
		}
		tick();

		return () => {
			disposed = true;
			cancelAnimationFrame(raf);
			ro.disconnect();
			window.removeEventListener("resize", onResize);
			renderer.dispose();
			if (landLines) {
				landLines.geometry.dispose();
				(landLines.material as THREE.Material).dispose();
			}
			for (const arr of cityLayers) {
				for (const cl of arr) {
					cl.geometry.dispose();
					(cl.material as THREE.Material).dispose();
				}
			}
			for (const s of streetLayers) {
				if (s) {
					s.geometry.dispose();
					(s.material as THREE.Material).dispose();
				}
			}
			sphere.geometry.dispose();
			sphereMat.dispose();
			if (renderer.domElement.parentNode === mountEl) {
				mountEl.removeChild(renderer.domElement);
			}
		};
	}, []);

	return <div ref={mountRef} className="globe-mount" />;
}
