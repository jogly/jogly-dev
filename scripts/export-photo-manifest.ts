#!/usr/bin/env bun

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type { PhotoShot } from "../src/lib/photoShot";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));

type PublicImage = {
	order: number;
	id: string;
	key: string;
	width: number;
	height: number;
	alt: string;
	caption: string;
	shot?: PhotoShot;
};

type StageManifest = {
	schemaVersion: 1;
	recipeVersion: number;
	album: string;
	settings: { maxEdge: number; quality: number };
	images: PublicImage[];
};

type PublishedManifest = StageManifest & {
	title: string;
	dateRange: string;
};

export async function createBlurSource(source: string | Buffer): Promise<string> {
	const bytes = await sharp(source)
		.resize({ width: 32, height: 32, fit: "inside", withoutEnlargement: true })
		.webp({ quality: 35 })
		.toBuffer();
	return `data:image/webp;base64,${bytes.toString("base64")}`;
}

function albumFromArgs(argv: string[]): string {
	if (argv.length !== 2 || argv[0] !== "--album") {
		throw new Error("Usage: bun run photos:export -- --album <slug>");
	}
	const album = argv[1];
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(album)) {
		throw new Error("--album must be a lowercase URL-safe slug");
	}
	return album;
}

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readExisting(path: string): Promise<PublishedManifest | null> {
	try {
		return await readJson<PublishedManifest>(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

async function main(): Promise<void> {
	const album = albumFromArgs(process.argv.slice(2));
	const sourcePath = join(PROJECT_ROOT, ".photo-build", album, "manifest.json");
	const targetPath = join(
		PROJECT_ROOT,
		"src",
		"content",
		"photos",
		`${album}.json`,
	);
	const stage = await readJson<StageManifest>(sourcePath);
	if (stage.album !== album) {
		throw new Error(`Stage album mismatch: expected ${album}, found ${stage.album}`);
	}

	const existing = await readExisting(targetPath);
	const existingById = new Map(
		(existing?.images ?? []).map((image) => [image.id, image]),
	);
	const images = [];
	for (const image of stage.images) {
		const previous = existingById.get(image.id);
		images.push({
			order: image.order,
			id: image.id,
			key: image.key,
			width: image.width,
			height: image.height,
			alt: previous?.alt || image.alt,
			caption: previous?.caption || image.caption,
			shot: image.shot,
			blurSrc: await createBlurSource(join(dirname(sourcePath), "masters", `${image.id}.jpg`)),
		});
	}
	const published: PublishedManifest = {
		schemaVersion: stage.schemaVersion,
		recipeVersion: stage.recipeVersion,
		album,
		title:
			existing?.title ??
			album
				.split("-")
				.map((part) => part[0].toUpperCase() + part.slice(1))
				.join(" "),
		dateRange: existing?.dateRange ?? "",
		settings: stage.settings,
		images,
	};

	await mkdir(dirname(targetPath), { recursive: true });
	const temporaryPath = `${targetPath}.${process.pid}.tmp`;
	await writeFile(temporaryPath, `${JSON.stringify(published, null, 2)}\n`);
	await rename(temporaryPath, targetPath);
	console.log(`exported ${published.images.length} photos → ${targetPath}`);
}

if (import.meta.main) main().catch((error: unknown) => {
	console.error(`photo manifest export failed: ${(error as Error).message}`);
	process.exitCode = 1;
});
