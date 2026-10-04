#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import album from "../src/content/photos/cotswolds.json";
import { PHOTO_QUALITY, photoUrl, responsiveWidths, type GalleryPhoto, type PhotoFormat } from "../src/lib/photoUrl";

const exec = promisify(execFile);
const project = fileURLToPath(new URL("../", import.meta.url));
const stage = join(project, ".photo-build");
const publicRoot = join(project, "public");
const receiptPath = join(stage, "delivery.json");
const releasePath = join(project, "photo-assets.json");
const formats = Object.keys(PHOTO_QUALITY) as PhotoFormat[];
const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

export function variants(photos: GalleryPhoto[]) {
	return photos.flatMap((photo) => {
		if (!/^[a-z0-9-]+\/[a-f0-9]{64}\.jpg$/.test(photo.key) ||
			photo.key !== `${album.album}/${photo.id}.jpg` ||
			!Number.isInteger(photo.width) || !Number.isInteger(photo.height) ||
			photo.width < 64 || photo.height < 64 || Math.max(photo.width, photo.height) > 4096) {
			throw new Error(`Invalid photo manifest entry: ${photo.id}`);
		}
		return responsiveWidths(photo).flatMap((width) => formats.map((format) => ({
			photo, width, format, path: photoUrl(photo, width, format).slice(1),
		})));
	});
}

type Receipt = { fingerprint: string; files: Record<string, { sha256: string; bytes: number }> };
const expected = variants(album.images);
export const fingerprint = sha256(JSON.stringify(expected.map(({ path, width, format, photo }) =>
	[path, width, format, PHOTO_QUALITY[format], photo.width, photo.height])));

async function readReceipt(path = receiptPath): Promise<Receipt> {
	return JSON.parse(await readFile(path, "utf8")) as Receipt;
}

export async function verifyFiles(root: string, receipt: Receipt): Promise<number> {
	if (receipt.fingerprint !== fingerprint ||
		Object.keys(receipt.files).sort().join("\n") !== expected.map(({ path }) => path).sort().join("\n")) {
		throw new Error("Photo bundle does not match the current manifest/encoding recipe. Run photos:prepare and photos:pack.");
	}
	let total = 0;
	for (const { path } of expected) {
		const file = join(root, path);
		if (!(await lstat(file)).isFile()) throw new Error(`Not a regular image: ${path}`);
		const data = await readFile(file);
		if (data.length !== receipt.files[path].bytes || sha256(data) !== receipt.files[path].sha256) {
			throw new Error(`Photo checksum mismatch: ${path}`);
		}
		total += data.length;
	}
	const files = await readdir(join(root, "photos"), { recursive: true, withFileTypes: true });
	if (files.some((file) => file.isSymbolicLink()) || files.filter((file) => file.isFile()).length !== expected.length) {
		throw new Error("Unexpected files in photos/. Only the prepared delivery bundle belongs here.");
	}
	if (total > 750_000_000) throw new Error("Photo bundle exceeds the 750 MB project budget; move image delivery off Pages before publishing.");
	return total;
}

async function prepare() {
	try {
		const total = await verifyFiles(publicRoot, await readReceipt());
		console.log(`Verified ${expected.length} static images (${(total / 1e6).toFixed(1)} MB).`);
		return;
	} catch (error) {
		console.log(`Preparing photo assets: ${(error as Error).message}`);
	}
	// Validate every input before writing any derivatives. CI never needs masters.
	for (const photo of album.images) {
		const path = join(stage, photo.key.replace("/", "/masters/"));
		let bytes: Buffer;
		try { bytes = await readFile(path); }
		catch { throw new Error("Photo assets are missing. Run photos:fetch for the pinned release bundle, or import the originals locally. A gallery-less build is not allowed."); }
		if (sha256(bytes) !== photo.id) throw new Error(`Master hash mismatch: ${photo.id}`);
		const metadata = await sharp(bytes).metadata();
		if (metadata.width !== photo.width || metadata.height !== photo.height) throw new Error(`Master dimensions mismatch: ${photo.id}`);
	}
	await mkdir(stage, { recursive: true });
	const generated = await mkdtemp(join(stage, "delivery-"));
	const receipt: Receipt = { fingerprint, files: {} };
	// Two encodes at once keeps AVIF memory/CPU bounded on laptops and CI.
	let cursor = 0;
	async function worker() {
		while (cursor < expected.length) {
			const variant = expected[cursor++];
			const { photo, width, format, path } = variant;
			const source = join(stage, photo.key.replace("/", "/masters/"));
			const data = await sharp(source).resize({ width, withoutEnlargement: true })
				.toFormat(format, { quality: PHOTO_QUALITY[format], ...(format === "jpeg" ? { mozjpeg: true } : {}) }).toBuffer();
			await mkdir(dirname(join(generated, path)), { recursive: true });
			await writeFile(join(generated, path), data);
			receipt.files[path] = { sha256: sha256(data), bytes: data.length };
			if (Object.keys(receipt.files).length % 48 === 0) console.log(`Encoded ${Object.keys(receipt.files).length}/${expected.length} images.`);
		}
	}
	await Promise.all([worker(), worker()]);
	await verifyFiles(generated, receipt);
	await install(generated, receipt);
	console.log(`Prepared ${expected.length} images; originals and masters are not in public/.`);
}

async function install(root: string, receipt: Receipt) {
	await mkdir(publicRoot, { recursive: true });
	// Preserve an existing generation rather than merging in stale public files.
	try { await rename(join(publicRoot, "photos"), join(await mkdtemp(join(stage, "previous-")), "photos")); }
	catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
	await cp(join(root, "photos"), join(publicRoot, "photos"), { recursive: true });
	await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
}

async function pack() {
	await prepare();
	const receipt = await readReceipt();
	const bundle = await mkdtemp(join(stage, "bundle-"));
	await cp(join(publicRoot, "photos"), join(bundle, "photos"), { recursive: true });
	await writeFile(join(bundle, "delivery.json"), `${JSON.stringify(receipt)}\n`);
	const archive = join(bundle, "cotswolds-photos.tar");
	await exec("tar", ["-cf", archive, "photos", "delivery.json"], { cwd: bundle, env: { ...process.env, COPYFILE_DISABLE: "1" } });
	const digest = sha256(await readFile(archive));
	const release = { tag: `photos-${digest.slice(0, 16)}`, asset: "cotswolds-photos.tar", sha256: digest };
	await writeFile(releasePath, `${JSON.stringify(release, null, 2)}\n`);
	console.log(`LOCAL ONLY: ${archive}\nRelease tag: ${release.tag}\nSHA-256: ${digest}\nNo upload performed. Commit photo-assets.json with the matching code when ready.`);
}

async function readRelease() {
	const release = JSON.parse(await readFile(releasePath, "utf8")) as { tag: string; asset: string; sha256: string };
	if (!/^photos-[a-f0-9]{16}$/.test(release.tag) || release.asset !== "cotswolds-photos.tar" || !/^[a-f0-9]{64}$/.test(release.sha256)) throw new Error("Invalid photo-assets.json");
	return release;
}

async function installArchive(archive: string) {
	const release = await readRelease();
	if (sha256(await readFile(archive)) !== release.sha256) throw new Error("Release archive checksum mismatch. Nothing extracted.");
	await mkdir(stage, { recursive: true });
	const unpacked = await mkdtemp(join(stage, "unpacked-"));
	// Only extract the locally produced archive pinned by its full SHA-256 in Git.
	await exec("tar", ["-xf", archive, "-C", unpacked]);
	const receipt = await readReceipt(join(unpacked, "delivery.json"));
	await verifyFiles(unpacked, receipt);
	await install(unpacked, receipt);
}

async function fetchBundle() {
	const release = await readRelease();
	await mkdir(stage, { recursive: true });
	const download = await mkdtemp(join(stage, "download-"));
	await exec("gh", ["release", "download", release.tag, "--pattern", release.asset, "--dir", download], { cwd: project });
	await installArchive(join(download, release.asset));
}

if (import.meta.main) {
	try {
		switch (process.argv[2]) {
			case "prepare": await prepare(); break;
			case "pack": await pack(); break;
			case "fetch": await fetchBundle(); break;
			case "install": {
				if (!process.argv[3]) throw new Error("Provide the local archive path to install.");
				await installArchive(process.argv[3]);
				break;
			}
			case "verify": {
				const total = await verifyFiles(join(project, "dist"), await readReceipt());
				console.log(`Production artifact verified: ${expected.length} images, ${(total / 1e6).toFixed(1)} MB. No image server required.`);
				break;
			}
			default: throw new Error("Usage: bun scripts/photo-assets.ts prepare|verify|pack|fetch|install <archive>");
		}
	} catch (error) {
		console.error((error as Error).message);
		process.exitCode = 1;
	}
}
