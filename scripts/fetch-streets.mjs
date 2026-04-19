#!/usr/bin/env bun
// Precomputes OSM street geometry for each WORK coord and writes a static
// JSON bundle to src/data/streets.json so the site doesn't hit Overpass at
// runtime (rate limits were killing 3/5 thumbnails).

import { writeFileSync, mkdirSync } from "node:fs";
import { WORK } from "../src/data.ts";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const RADIUS = 1800;

async function fetchOne(lat, lng) {
	const q = `[out:json][timeout:25];
		way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service)$"]
			(around:${RADIUS},${lat},${lng});
		out geom;`;
	const res = await fetch(ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: `data=${encodeURIComponent(q)}`,
	});
	if (!res.ok) throw new Error(`overpass ${res.status}`);
	const json = await res.json();
	const lines = [];
	for (const el of json.elements ?? []) {
		if (!el.geometry) continue;
		const pts = el.geometry.map((p) => [p.lat, p.lon]);
		if (pts.length >= 2) lines.push(pts);
	}
	return lines;
}

const out = {};
for (const w of WORK) {
	const [lat, lng] = w.coord;
	const key = `${lat.toFixed(4)},${lng.toFixed(4)},${RADIUS}`;
	process.stderr.write(`fetching ${w.company} (${key})... `);
	let attempt = 0;
	while (true) {
		try {
			const lines = await fetchOne(lat, lng);
			out[key] = lines;
			process.stderr.write(`${lines.length} ways\n`);
			break;
		} catch (e) {
			attempt++;
			if (attempt >= 4) {
				process.stderr.write(`FAILED: ${e.message}\n`);
				out[key] = [];
				break;
			}
			const wait = 3000 * attempt;
			process.stderr.write(`retry in ${wait}ms (${e.message})... `);
			await new Promise((r) => setTimeout(r, wait));
		}
	}
	await new Promise((r) => setTimeout(r, 1500));
}

mkdirSync("public", { recursive: true });
writeFileSync("public/streets.json", JSON.stringify(out));
process.stderr.write(`\nwrote public/streets.json with ${Object.keys(out).length} entries\n`);
