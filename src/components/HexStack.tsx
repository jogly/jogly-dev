import { useMemo } from "react";
import {
	cellToBoundary,
	cellToParent,
	getHexagonAreaAvg,
	latLngToCell,
} from "h3-js";

const RESOLUTIONS = [2, 5, 7, 9, 11] as const;
const EARTH_R = 6371000;

type Layer = {
	res: number;
	cell: string;
	norm: readonly (readonly [number, number])[];
	area: number;
};

function formatArea(km2: number): string {
	if (km2 >= 1e5) return `${(km2 / 1e6).toFixed(2)} Mm²`;
	if (km2 >= 100) return `${km2.toFixed(0)} km²`;
	if (km2 >= 1) return `${km2.toFixed(2)} km²`;
	if (km2 >= 0.001) return `${(km2 * 1e6).toFixed(0)} m²`;
	return `${(km2 * 1e6).toFixed(1)} m²`;
}

export function HexStack({ lat, lng }: { lat: number; lng: number }) {
	const layers = useMemo<Layer[]>(() => {
		const cosLat = Math.cos((lat * Math.PI) / 180);
		const leaf = latLngToCell(lat, lng, RESOLUTIONS[RESOLUTIONS.length - 1]);
		return RESOLUTIONS.map((res) => {
			// Parent of the leaf so the chain is strictly nested (child-of-child).
			const cell = cellToParent(leaf, res);
			const boundary = cellToBoundary(cell, true); // [lng, lat] pairs
			const pts = boundary.map(([ln, la]) => {
				const dx = (ln - lng) * cosLat * (Math.PI / 180) * EARTH_R;
				const dy = (la - lat) * (Math.PI / 180) * EARTH_R;
				return [dx, dy] as const;
			});
			const maxR = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
			const norm = pts.map(
				([x, y]) => [x / maxR, y / maxR] as const,
			);
			return {
				res,
				cell,
				norm,
				area: getHexagonAreaAvg(res, "km2"),
			};
		});
	}, [lat, lng]);

	const W = 420;
	const topPad = 30;
	const rowH = 92;
	const bottomPad = 20;
	const totalH = topPad + rowH * layers.length + bottomPad;
	const cx = W / 2;

	// Hex size tapers as you go up the hierarchy (finest hex sits lowest and
	// largest, so it reads as "near"; coarsest hexes recede and shrink).
	const rMax = 44;
	const rMin = 18;

	return (
		<svg
			className="hex-stack"
			viewBox={`0 0 ${W} ${totalH}`}
			preserveAspectRatio="xMidYMid meet"
			aria-hidden="true"
		>
			<g className="hs-plate">
				<line x1={32} y1={16} x2={W - 32} y2={16} className="hs-rule" />
				<text x={32} y={12} className="hs-meta" textAnchor="start">
					FIG · H3 HIERARCHY
				</text>
				<text x={W - 32} y={12} className="hs-meta" textAnchor="end">
					5 LAYERS · Δ2
				</text>
				{/* registration marks */}
				<path d={`M6 6 H18 M6 6 V18`} className="hs-rule" />
				<path
					d={`M${W - 6} 6 H${W - 18} M${W - 6} 6 V18`}
					className="hs-rule"
				/>
			</g>

			{layers.map((layer, i) => {
				const cy = topPad + i * rowH + rowH / 2;
				const t = layers.length > 1 ? i / (layers.length - 1) : 0;
				const r = rMin + (rMax - rMin) * t;
				const prevR =
					i > 0
						? rMin +
							(rMax - rMin) * ((i - 1) / (layers.length - 1))
						: 0;
				const isLeaf = i === layers.length - 1;

				const d =
					layer.norm
						.map(
							([nx, ny], j) =>
								`${j === 0 ? "M" : "L"}${(cx + nx * r).toFixed(2)} ${(cy - ny * r).toFixed(2)}`,
						)
						.join(" ") + " Z";

				return (
					<g key={layer.res}>
						{/* leader from the coarser layer above down into this one */}
						{i > 0 && (
							<line
								x1={cx}
								y1={topPad + (i - 1) * rowH + rowH / 2 + prevR + 6}
								x2={cx}
								y2={cy - r - 6}
								className="hs-leader"
							/>
						)}
							{/* measurement hairlines */}
							<line
								x1={cx - r - 12}
								y1={cy}
								x2={cx - r - 4}
								y2={cy}
								className="hs-rule"
							/>
							<line
								x1={cx + r + 4}
								y1={cy}
								x2={cx + r + 12}
								y2={cy}
								className="hs-rule"
							/>
							{/* hex outline (leaf is filled) */}
							<path d={d} className={`hs-hex${isLeaf ? " is-leaf" : ""}`} />
							{/* center dot */}
							<circle cx={cx} cy={cy} r={0.9} className="hs-center" />

							{/* left-side label */}
							<text
								x={cx - r - 18}
								y={cy - 2}
								textAnchor="end"
								className="hs-res-num"
							>
								{String(layer.res).padStart(2, "0")}
							</text>
							<text
								x={cx - r - 18}
								y={cy + 10}
								textAnchor="end"
								className="hs-res-lbl"
							>
								RESOLUTION
							</text>

							{/* right-side label */}
							<text
								x={cx + r + 18}
								y={cy - 2}
								textAnchor="start"
								className="hs-area"
							>
								{formatArea(layer.area)}
							</text>
							<text
								x={cx + r + 18}
								y={cy + 10}
								textAnchor="start"
								className="hs-code"
							>
								{layer.cell}
							</text>
						</g>
					);
				})}

			{/* baseline near the map floor */}
			<line
				x1={32}
				y1={totalH - 8}
				x2={W - 32}
				y2={totalH - 8}
				className="hs-rule"
			/>
			<text
				x={cx}
				y={totalH - 12}
				className="hs-meta"
				textAnchor="middle"
			>
				↓ GROUND PLANE
			</text>
		</svg>
	);
}
