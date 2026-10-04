#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import album from "../src/content/photos/cotswolds.json";
import { variants } from "./photo-assets";

// Run against a plain static server or the published site, never Vite middleware.
const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base)) throw new Error("Usage: bun run photos:smoke -- http://127.0.0.1:4174");
const receipt = JSON.parse(await readFile(new URL("../.photo-build/delivery.json", import.meta.url), "utf8")) as {
	files: Record<string, { sha256: string; bytes: number }>;
};
const page = await fetch(new URL("/cotswolds/", base));
if (!page.ok || !(await page.text()).includes('type="module"')) throw new Error("Gallery entry is not a built HTML page");
const missing = await fetch(new URL("/photos/not-an-image.avif", base));
if (missing.status !== 404) throw new Error("Missing images must return 404, not an HTML fallback");
const files = variants(album.images);
let cursor = 0;
async function verify() {
	while (cursor < files.length) {
		const { path, width, format, photo } = files[cursor++];
		const response = await fetch(new URL(`/${path}`, base));
		if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== `image/${format}`) {
			throw new Error(`Invalid response for ${path}: ${response.status} ${response.headers.get("content-type")}`);
		}
		const bytes = Buffer.from(await response.arrayBuffer());
		if (bytes.length !== receipt.files[path].bytes || createHash("sha256").update(bytes).digest("hex") !== receipt.files[path].sha256) {
			throw new Error(`HTTP bytes do not match the delivery receipt: ${path}`);
		}
		const metadata = await sharp(bytes).metadata();
		if (metadata.width !== width || Math.abs(metadata.height! - photo.height * width / photo.width) > 1 ||
			metadata.exif || metadata.xmp || metadata.iptc || metadata.icc || metadata.orientation) {
			throw new Error(`Incorrect dimensions or unexpected metadata: ${path}`);
		}
	}
}
await Promise.all([verify(), verify(), verify(), verify()]);
console.log(`HTTP verified ${files.length} images across ${album.images.length} photos: types, checksums, responsive dimensions, stripped metadata, and real 404s.`);
