import { useEffect, useMemo, useRef, useState } from "react";
import {
	cellToBoundary,
	cellToParent,
	getHexagonAreaAvg,
	getHexagonEdgeLengthAvg,
	latLngToCell,
} from "h3-js";
import { getCityStreets } from "../lib/cityStreets";
import { hexToCharCode } from "../lib/h3Encoding";

const RESOLUTIONS = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const LEAF_RES = RESOLUTIONS[RESOLUTIONS.length - 1];
const EARTH_R = 6371000;

// Altitude drives meters-per-pixel exponentially. 0 = ground, 1 = orbital.
const MPP_MIN = 0.18; // m/px at z=0 — leaf hex (29m edge) ≈ 160px, well read
const MPP_MAX = 18_000; // m/px at z=1 — res-0 cell still readable

// Cell visibility band (pixel diameter). Below FADE_IN: too small to see;
// above FADE_OUT: bigger than the frame. Between READ_IN/READ_OUT: fully lit.
const FADE_IN = 34;
const READ_IN = 90;
const READ_OUT = 560;
const FADE_OUT = 1100;

function mppFromZoom(z: number): number {
	const k = Math.min(1, Math.max(0, z));
	return MPP_MIN * Math.pow(MPP_MAX / MPP_MIN, k);
}

function cellOpacity(diamPx: number): number {
	if (diamPx <= FADE_IN || diamPx >= FADE_OUT) return 0;
	if (diamPx < READ_IN) return (diamPx - FADE_IN) / (READ_IN - FADE_IN);
	if (diamPx > READ_OUT) return (FADE_OUT - diamPx) / (FADE_OUT - READ_OUT);
	return 1;
}

function formatArea(km2: number): string {
	if (km2 >= 1e5) return `${(km2 / 1e6).toFixed(2)} Mm²`;
	if (km2 >= 100) return `${km2.toFixed(0)} km²`;
	if (km2 >= 1) return `${km2.toFixed(2)} km²`;
	if (km2 >= 0.001) return `${(km2 * 1e6).toFixed(0)} m²`;
	return `${(km2 * 1e6).toFixed(1)} m²`;
}

function formatEdge(m: number): string {
	if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
	if (m >= 1) return `${m.toFixed(0)} m`;
	return `${(m * 100).toFixed(0)} cm`;
}

function formatAlt(m: number): string {
	if (m >= 1e6) return `${(m / 1e6).toFixed(1)} Mm`;
	if (m >= 1e4) return `${(m / 1000).toFixed(0)} km`;
	if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
	return `${m.toFixed(0)} m`;
}

type CellGeom = {
	res: number;
	cell: string;
	pts: readonly (readonly [number, number])[]; // meters, origin at lat/lng
	edge: number;
	area: number;
	maxR: number; // bounding radius in meters
};

type Props = { lat: number; lng: number; address?: string };

export function CityStage({ lat, lng, address }: Props) {
	const cosLat = useMemo(() => Math.cos((lat * Math.PI) / 180), [lat]);

	// Precompute hex boundaries in local meters for every resolution.
	const cells = useMemo<CellGeom[]>(() => {
		const leaf = latLngToCell(lat, lng, LEAF_RES);
		return RESOLUTIONS.map((res) => {
			const cell = cellToParent(leaf, res);
			const boundary = cellToBoundary(cell, true);
			const pts = boundary.map(([ln, la]) => {
				const dx = (ln - lng) * cosLat * (Math.PI / 180) * EARTH_R;
				const dy = (la - lat) * (Math.PI / 180) * EARTH_R;
				return [dx, dy] as const;
			});
			const maxR = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
			return {
				res,
				cell,
				pts,
				edge: getHexagonEdgeLengthAvg(res, "m"),
				area: getHexagonAreaAvg(res, "km2"),
				maxR,
			};
		});
	}, [lat, lng, cosLat]);

	// Load neighborhood streets and project to meters once.
	const [streets, setStreets] = useState<[number, number][][]>([]);
	useEffect(() => {
		let cancelled = false;
		getCityStreets(lat, lng, 2200)
			.then((lines) => {
				if (cancelled) return;
				setStreets(
					lines.map((line) =>
						line.map(([la, ln]) => {
							const dx = (ln - lng) * cosLat * (Math.PI / 180) * EARTH_R;
							const dy = (la - lat) * (Math.PI / 180) * EARTH_R;
							return [dx, dy] as [number, number];
						}),
					),
				);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [lat, lng, cosLat]);

	// Stage size (for viewBox + performance tuning).
	const stageRef = useRef<HTMLDivElement | null>(null);
	const [stage, setStage] = useState({ w: 480, h: 600 });
	useEffect(() => {
		const el = stageRef.current;
		if (!el) return;
		const ro = new ResizeObserver((entries) => {
			const r = entries[0].contentRect;
			setStage({ w: r.width, h: r.height });
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// Animated altitude. `zoom` drives render; `target` is user input.
	const [zoom, setZoom] = useState(0);
	const zoomRef = useRef(0);
	const targetRef = useRef(0);
	const rafRef = useRef<number | null>(null);

	const tick = () => {
		const diff = targetRef.current - zoomRef.current;
		if (Math.abs(diff) > 0.0004) {
			zoomRef.current += diff * 0.18;
			setZoom(zoomRef.current);
			rafRef.current = requestAnimationFrame(tick);
		} else if (zoomRef.current !== targetRef.current) {
			zoomRef.current = targetRef.current;
			setZoom(zoomRef.current);
			rafRef.current = null;
		} else {
			rafRef.current = null;
		}
	};
	const kick = () => {
		if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
	};

	// Wheel + pointer drag drive altitude.
	useEffect(() => {
		const el = stageRef.current;
		if (!el) return;
		const clamp = (v: number) => Math.max(0, Math.min(1, v));

		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			targetRef.current = clamp(targetRef.current + e.deltaY * 0.00075);
			kick();
		};

		let dragging = false;
		let lastY = 0;
		const onDown = (e: PointerEvent) => {
			dragging = true;
			lastY = e.clientY;
			el.setPointerCapture(e.pointerId);
		};
		const onMove = (e: PointerEvent) => {
			if (!dragging) return;
			const dy = e.clientY - lastY;
			lastY = e.clientY;
			// drag DOWN → rise; drag UP → descend.
			targetRef.current = clamp(targetRef.current + dy * 0.0025);
			kick();
		};
		const onUp = (e: PointerEvent) => {
			dragging = false;
			try {
				el.releasePointerCapture(e.pointerId);
			} catch {}
		};

		el.addEventListener("wheel", onWheel, { passive: false });
		el.addEventListener("pointerdown", onDown);
		el.addEventListener("pointermove", onMove);
		el.addEventListener("pointerup", onUp);
		el.addEventListener("pointercancel", onUp);
		return () => {
			el.removeEventListener("wheel", onWheel);
			el.removeEventListener("pointerdown", onDown);
			el.removeEventListener("pointermove", onMove);
			el.removeEventListener("pointerup", onUp);
			el.removeEventListener("pointercancel", onUp);
		};
	}, []);

	// Current frame derivations.
	const mpp = mppFromZoom(zoom);
	const vw = stage.w;
	const vh = stage.h;

	const scaled = cells.map((c) => {
		const diamPx = (c.maxR * 2) / mpp;
		return { ...c, diamPx, opacity: cellOpacity(diamPx) };
	});

	// Focused cell = most readable at this zoom.
	const focusMid = (READ_IN + READ_OUT) / 2;
	let focused = scaled[scaled.length - 1];
	let bestD = Infinity;
	for (const c of scaled) {
		const d = Math.abs(Math.log(c.diamPx / focusMid));
		if (d < bestD) {
			bestD = d;
			focused = c;
		}
	}

	const tierIdx = RESOLUTIONS.indexOf(
		focused.res as (typeof RESOLUTIONS)[number],
	);

	// Pre-project geometry once in METERS. Zoom only updates a single
	// scale transform on the parent group — React never regenerates these
	// path strings, so dense street networks stay smooth under animation.
	const hexPathsM = useMemo(
		() =>
			cells.map(
				(c) =>
					c.pts
						.map(
							([x, y], i) =>
								`${i === 0 ? "M" : "L"}${x.toFixed(0)} ${(-y).toFixed(0)}`,
						)
						.join(" ") + " Z",
			),
		[cells],
	);
	const streetPathsM = useMemo(
		() =>
			streets.map((line) =>
				line
					.map(
						([x, y], j) =>
							`${j === 0 ? "M" : "L"}${x.toFixed(0)} ${(-y).toFixed(0)}`,
					)
					.join(" "),
			),
		[streets],
	);

	// Streets linger longer than cells — gentle power-curve fade.
	const streetOpacity = Math.max(0, Math.pow(1 - Math.min(1, zoom * 1.5), 3));
	const worldScale = 1 / mpp;

	// Approximate altitude in meters (camera distance ≈ mpp * vh for 30°-ish fov).
	const altMeters = mpp * vh * 1.5;

	// Dynamic tilt: deeper at ground, flatter at altitude.
	const tiltDeg = 22 + (1 - zoom) * 30; // 52° on ground → 22° at top

	return (
		<div className="city-stage">
			<header className="cs-head">
				<div className="cs-head-kicker">
					<span className="cs-head-sig">§</span>
					<span className="cs-head-k">Focus</span>
					<span className="cs-head-rule" aria-hidden />
					<span className="cs-head-tier">
						tier {String(tierIdx + 1).padStart(2, "0")} / {RESOLUTIONS.length}
					</span>
				</div>
				<h3 className="cs-head-res">
					resolution&nbsp;
					<span className="cs-head-num">
						{String(focused.res).padStart(2, "0")}
					</span>
				</h3>
				{address && <div className="cs-head-addr">{address}</div>}
				<dl className="cs-head-grid">
					<div className="cs-head-pair">
						<dt>Area</dt>
						<dd>{formatArea(focused.area)}</dd>
					</div>
					<div className="cs-head-pair">
						<dt>Edge</dt>
						<dd>{formatEdge(focused.edge)}</dd>
					</div>
					<div className="cs-head-pair cs-head-pair-wide">
						<dt>H3 index</dt>
						<dd className="cs-head-mono">{focused.cell}</dd>
					</div>
					<div className="cs-head-pair cs-head-pair-wide">
						<dt>Encoded</dt>
						<dd className="cs-head-accent">{hexToCharCode(focused.cell)}</dd>
					</div>
				</dl>
			</header>

			<div className="cs-stage" ref={stageRef}>
				<svg
					className="cs-canvas"
					viewBox={`${-vw / 2} ${-vh / 2} ${vw} ${vh}`}
					preserveAspectRatio="xMidYMid meet"
					style={
						{
							// @ts-expect-error CSS custom property
							"--tilt": `${tiltDeg}deg`,
						} as React.CSSProperties
					}
					aria-hidden="true"
				>
					<defs>
						{scaled.map((s) => (
							<pattern
								key={s.res}
								id={`cs-hatch-${s.res}`}
								patternUnits="userSpaceOnUse"
								width="11"
								height="11"
								patternTransform={`scale(${mpp}) rotate(45)`}
							>
								<line
									x1="0"
									y1="0"
									x2="0"
									y2="11"
									className="cs-hatch-line"
								/>
							</pattern>
						))}
					</defs>

					{/* Single scale transform — path strings stay stable. */}
					<g className="cs-world" transform={`scale(${worldScale})`}>
						{/* streets (pre-projected in meters) */}
						{streetOpacity > 0.02 && (
							<g className="cs-streets" style={{ opacity: streetOpacity }}>
								{streetPathsM.map((d, i) => (
									<path key={i} d={d} className="cs-street" />
								))}
							</g>
						)}

						{/* hex cells — geometry stable, only opacity changes per frame */}
						{scaled.map((s, i) => {
							if (s.opacity < 0.01) return null;
							const isFocus = s.res === focused.res;
							const d = hexPathsM[i];
							return (
								<g
									key={s.res}
									className={`cs-cell${isFocus ? " is-focus" : ""}`}
									style={{ opacity: s.opacity }}
								>
									<path d={d} className="cs-hex-face" />
									<path
										d={d}
										className="cs-hex-hatch"
										fill={`url(#cs-hatch-${s.res})`}
									/>
									<path d={d} className="cs-hex-outline" />
								</g>
							);
						})}
					</g>

					{/* Anchor dot lives OUTSIDE the scaled world so it stays crisp
					    at any zoom and doesn't inherit the scale. */}
					<g className="cs-anchor">
						<circle cx="0" cy="0" r="4.5" className="cs-anchor-dot" />
						<circle cx="0" cy="0" r="9" className="cs-anchor-ring" />
					</g>
				</svg>

				{/* Altimeter HUD */}
				<div className="cs-hud" aria-hidden>
					<div className="cs-hud-k">Altitude</div>
					<div className="cs-hud-v">{formatAlt(altMeters)}</div>
					<div className="cs-hud-track">
						<div
							className="cs-hud-fill"
							style={{ height: `${zoom * 100}%` }}
						/>
						{RESOLUTIONS.map((res, i) => {
							const c = cells[i];
							const zForCell = Math.min(
								1,
								Math.max(
									0,
									Math.log(((c.maxR * 2) / focusMid) / MPP_MIN) /
										Math.log(MPP_MAX / MPP_MIN),
								),
							);
							const isFocus = res === focused.res;
							return (
								<button
									key={res}
									type="button"
									className={`cs-hud-tick${isFocus ? " is-focus" : ""}`}
									style={{ bottom: `${zForCell * 100}%` }}
									onClick={() => {
										targetRef.current = zForCell;
										kick();
									}}
									aria-label={`Fly to resolution ${res}`}
								>
									<span className="cs-hud-tick-label">
										R{String(res).padStart(2, "0")}
									</span>
								</button>
							);
						})}
					</div>
					<div className="cs-hud-hint">drag · scroll</div>
				</div>
			</div>
		</div>
	);
}
