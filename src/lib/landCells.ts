import { polygonToCells } from "h3-js";
import { feature } from "topojson-client";
import landTopoRaw from "world-atlas/land-110m.json";
import type { Feature, MultiPolygon, Polygon } from "geojson";

let cache: string[] | null = null;

export async function getLandCells(res = 2): Promise<string[]> {
	if (cache) return cache;
	// biome-ignore lint/suspicious/noExplicitAny: topojson typing
	const topo = landTopoRaw as any;
	const decoded = feature(topo, topo.objects.land) as unknown as
		| Feature<Polygon | MultiPolygon>
		| { type: "FeatureCollection"; features: Feature<Polygon | MultiPolygon>[] };

	const features: Feature<Polygon | MultiPolygon>[] =
		decoded.type === "FeatureCollection" ? decoded.features : [decoded];

	const cellSet = new Set<string>();
	for (const f of features) {
		const geom = f.geometry;
		const polygons: number[][][][] =
			geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];
		for (const poly of polygons) {
			try {
				const cells = polygonToCells(
					poly as unknown as number[][][],
					res,
					true,
				);
				for (const c of cells) cellSet.add(c);
			} catch {
				// Some polygons (very large or at the poles) confuse polygonToCells;
				// skip them — the rest of the world still renders.
			}
		}
	}

	cache = Array.from(cellSet);
	return cache;
}
