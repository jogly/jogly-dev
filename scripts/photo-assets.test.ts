import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import album from "../src/content/photos/cotswolds.json";
import { photoSrcSet, photoUrl, responsiveWidths } from "../src/lib/photoUrl";
import { fingerprint, variants, verifyFiles } from "./photo-assets";

describe("static photo delivery", () => {
	test("all responsive URLs are concrete unique files, with no upscaling", () => {
		const all = variants(album.images);
		expect(new Set(all.map(({ path }) => path)).size).toBe(all.length);
		for (const { path, photo, width } of all) {
			expect(path).toMatch(/^photos\/v1\/cotswolds\/[a-f0-9]{64}\/\d+\.(avif|webp|jpeg)$/);
			expect(width).toBeLessThanOrEqual(photo.width);
			expect(path).not.toContain("?");
		}
	});

	test("fallback, preview and full-size URLs all belong to the bundle", () => {
		const paths = new Set(variants(album.images).map(({ path }) => `/${path}`));
		for (const photo of album.images) {
			for (const width of [768, 1600, photo.width, photo.width * 2]) {
				expect(paths.has(photoUrl(photo, width, "jpeg"))).toBe(true);
			}
			for (const format of ["avif", "webp", "jpeg"] as const) {
				for (const entry of photoSrcSet(photo, format).split(", ")) {
					expect(paths.has(entry.split(" ")[0])).toBe(true);
				}
			}
		}
	});

	test("natural width is included once, even at a breakpoint", () => {
		expect(responsiveWidths({ ...album.images[0], width: 1600 })).toEqual([480, 768, 1200, 1600]);
	});

	test("rejects path traversal and invalid dimensions", () => {
		expect(() => variants([{ ...album.images[0], key: "../private.jpg" }])).toThrow();
		expect(() => variants([{ ...album.images[0], width: 0 }])).toThrow();
	});

	test("fails closed on missing or outdated asset receipts", async () => {
		await expect(verifyFiles("/unused", { fingerprint: "old", files: {} })).rejects.toThrow("does not match");
		await expect(verifyFiles("/unused", { fingerprint, files: {} })).rejects.toThrow("does not match");
	});

	test("detects corrupt image bytes instead of accepting a successful build", async () => {
		const root = await mkdtemp(join(tmpdir(), "jogly-delivery-test-"));
		try {
			const all = variants(album.images);
			const bytes = Buffer.from("expected");
			const files = Object.fromEntries(all.map(({ path }) => [path, {
				bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
			}]));
			const target = join(root, all[0].path);
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, "corrupt!");
			await expect(verifyFiles(root, { fingerprint, files })).rejects.toThrow("checksum mismatch");
		} finally {
			await rm(root, { recursive: true });
		}
	});
});
