import { useEffect, useMemo, useState } from "react";
import { cellToBoundary, latLngToCell } from "h3-js";
import { getCityStreets } from "../lib/cityStreets";

type Props = {
	lat: number;
	lng: number;
	radiusMeters?: number;
	viewMeters?: number;
	res?: number;
	width?: number;
	height?: number;
	className?: string;
};

const EARTH_R = 6371000;

// Deterministic 0..1 hash from two numbers — used to make the radial
// drop-off reproducible across renders instead of stochastic.
function hash2(a: number, b: number): number {
	const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
	return x - Math.floor(x);
}

export function CityThumb({
	lat,
	lng,
	radiusMeters = 1800,
	viewMeters = 700,
	res = 11,
	width = 180,
	height = 120,
	className = "entry-thumb",
}: Props) {
	const [path, setPath] = useState<string | null>(null);
	const W = width;
	const H = height;

	const hexPath = useMemo(() => {
		const cosLat = Math.cos((lat * Math.PI) / 180);
		const scale = H / (2 * viewMeters);
		const cell = latLngToCell(lat, lng, res);
		const boundary = cellToBoundary(cell, true); // [lng, lat] pairs
		const pts = boundary.map(([ln, la]) => {
			const dx = (ln - lng) * cosLat * (Math.PI / 180) * EARTH_R;
			const dy = (la - lat) * (Math.PI / 180) * EARTH_R;
			return [W / 2 + dx * scale, H / 2 - dy * scale] as const;
		});
		return (
			pts
				.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
				.join(" ") + " Z"
		);
	}, [lat, lng, viewMeters, res, W, H]);

	useEffect(() => {
		let cancelled = false;
		getCityStreets(lat, lng, radiusMeters)
			.then((lines) => {
				if (cancelled) return;
				const cosLat = Math.cos((lat * Math.PI) / 180);
				const scale = H / (2 * viewMeters);
				const rInner = 0.45;
				const rOuter = 0.98;

				const project = (la: number, ln: number): [number, number, number] => {
					const dx = (ln - lng) * cosLat * (Math.PI / 180) * EARTH_R;
					const dy = (la - lat) * (Math.PI / 180) * EARTH_R;
					const x = W / 2 + dx * scale;
					const y = H / 2 - dy * scale;
					const nx = (x - W / 2) / (W / 2);
					const ny = (y - H / 2) / (H / 2);
					const dist = Math.sqrt(nx * nx + ny * ny);
					return [x, y, dist];
				};

				const parts: string[] = [];
				for (const line of lines) {
					if (line.length < 2) continue;
					const [la0, ln0] = line[0];
					let started = false;
					for (let j = 0; j < line.length; j++) {
						const [la, ln] = line[j];
						const [x, y, dist] = project(la, ln);
						let drop = false;
						if (dist >= rOuter) drop = true;
						else if (dist > rInner) {
							const t = (dist - rInner) / (rOuter - rInner);
							const keep = 1 - t * t;
							if (hash2(la0 + j * 0.001, ln0) > keep) drop = true;
						}
						if (drop) {
							started = false;
							continue;
						}
						parts.push(`${started ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
						started = true;
					}
				}
				setPath(parts.join(" "));
			})
			.catch(() => {
				/* silent */
			});
		return () => {
			cancelled = true;
		};
	}, [lat, lng, radiusMeters, viewMeters, W, H]);

	return (
		<svg
			className={className}
			viewBox={`0 0 ${W} ${H}`}
			width={W}
			height={H}
			aria-hidden="true"
		>
			{path && <path d={path} className="entry-thumb-path" />}
			<path d={hexPath} className="entry-thumb-hex" />
		</svg>
	);
}
