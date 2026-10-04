import { expect, test } from "bun:test";
import sharp from "sharp";
import album from "../src/content/photos/cotswolds.json";
import { createBlurSource } from "./export-photo-manifest";
import { formatPhotoShot } from "../src/lib/photoShot";

test("shot settings format real exposures and omit missing fields", () => {
	expect(formatPhotoShot({ focalLengthMm: 17, aperture: 5.6, exposureSeconds: 1 / 250, iso: 200 })).toBe("17 mm\u2003ƒ/5.6\u20031/250 s\u2003ISO 200");
	expect(formatPhotoShot({ exposureSeconds: 0.6 })).toBe("0.6 s");
	expect(formatPhotoShot({ exposureSeconds: 2.5 })).toBe("2.5 s");
	expect(formatPhotoShot()).toBe("");
	expect(formatPhotoShot({})).toBe("");
});

test("blur sources are tiny, proportional, deterministic and metadata-free", async () => {
	const source = await sharp({ create: { width: 128, height: 256, channels: 3, background: "#b06632" } })
		.jpeg().withMetadata().toBuffer();
	const result = await createBlurSource(source);
	expect(result).toBe(await createBlurSource(source));
	expect(result.startsWith("data:image/webp;base64,")).toBe(true);
	const bytes = Buffer.from(result.split(",")[1], "base64");
	const info = await sharp(bytes).metadata();
	expect([info.width, info.height]).toEqual([16, 32]);
	expect(bytes.length).toBeLessThan(1024);
	expect(info.exif).toBeUndefined();
	expect(info.icc).toBeUndefined();
});

test("every gallery photo ships a valid blur source within a 1 KB budget", async () => {
	for (const photo of album.images) {
		expect(photo.blurSrc.startsWith("data:image/webp;base64,")).toBe(true);
		const bytes = Buffer.from(photo.blurSrc.split(",")[1], "base64");
		const info = await sharp(bytes).metadata();
		expect(Math.max(info.width!, info.height!)).toBe(32);
		expect(Math.abs(info.width! / info.height! - photo.width / photo.height)).toBeLessThan(0.12);
		expect(bytes.length).toBeLessThan(1024);
		expect(info.exif).toBeUndefined();
		expect(info.xmp).toBeUndefined();
		expect(info.icc).toBeUndefined();
	}
});
