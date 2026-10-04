import { createHash } from "node:crypto";
import {
	mkdtemp,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import sharp from "sharp";
import {
	assertPathsDoNotOverlap,
	captureInstantMillis,
	inferCaptureOffsets,
	importAlbum,
	parseArgs,
	replaceStageDirectory,
	type ImportOptions,
} from "./import-photos";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "jogly-photo-import-test-"));
	temporaryDirectories.push(directory);
	return directory;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) =>
			rm(directory, { recursive: true, force: true }),
		),
	);
});

function digest(data: Buffer): string {
	return createHash("sha256").update(data).digest("hex");
}

async function treeDigests(directory: string): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	async function walk(current: string, prefix = ""): Promise<void> {
		const entries = await readdir(current, { withFileTypes: true });
		for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
			const path = join(current, entry.name);
			const relativePath = prefix ? join(prefix, entry.name) : entry.name;
			if (entry.isDirectory()) await walk(path, relativePath);
			else result[relativePath] = digest(await readFile(path));
		}
	}
	await walk(directory);
	return result;
}

function options(sourceDirectory: string, outputDirectory: string): ImportOptions {
	return {
		album: "test-album",
		sourceDirectory,
		outputDirectory,
		maxEdge: 256,
		quality: 85,
	};
}

async function writeTimestampedJpeg(
	path: string,
	background: string,
	captureLocal: string,
	captureOffset: string,
): Promise<void> {
	await sharp({
		create: { width: 640, height: 480, channels: 3, background },
	})
		.jpeg()
		.withExif({
			IFD0: { Make: "Test", Model: "Clock" },
			IFD2: {
				DateTimeOriginal: captureLocal,
				OffsetTimeOriginal: captureOffset,
			},
		})
		.toFile(path);
}

describe("parseArgs", () => {
	test("requires an explicit dry run and rejects traversal-like album names", () => {
		expect(() =>
			parseArgs(["--album", "cotswolds", "--source", "/tmp/photos"]),
		).toThrow("--dry-run is required");
		expect(() =>
			parseArgs([
				"--album",
				"../../escape",
				"--source",
				"/tmp/photos",
				"--dry-run",
			]),
		).toThrow("URL-safe slug");
	});

	test("uses the ignored local stage by default", () => {
		const parsed = parseArgs([
			"--album",
			"cotswolds",
			"--source",
			"/tmp/photos",
			"--dry-run",
		]);
		expect(parsed.outputDirectory.endsWith("/.photo-build/cotswolds")).toBe(true);
	});
});

describe("capture time ordering", () => {
	test("compares explicit offsets as absolute instants", () => {
		const iphone = captureInstantMillis("2026:09:13 09:44:22", "+01:00");
		const camera = captureInstantMillis("2026:09:13 02:21:02", "-08:00");
		expect(new Date(iphone ?? 0).toISOString()).toBe("2026-09-13T08:44:22.000Z");
		expect(new Date(camera ?? 0).toISOString()).toBe("2026-09-13T10:21:02.000Z");
		expect(iphone).toBeLessThan(camera ?? 0);
	});

	test("validates calendar values and offset date-boundary crossings", () => {
		expect(
			new Date(
				captureInstantMillis("2024:02:29 00:00:00", "+14:00") ?? 0,
			).toISOString(),
		).toBe("2024-02-28T10:00:00.000Z");
		expect(captureInstantMillis("2025:02:29 00:00:00", "+00:00")).toBeNull();
		expect(captureInstantMillis("2026:09:13 09:44:22", null)).toBeNull();
	});

	test("infers a missing offset only from a unanimous camera group", () => {
		const base = {
			captureLocal: "2026:09:17 07:51:05",
			make: "OM Digital Solutions",
			model: "OM-5MarkII",
		};
		expect(
			inferCaptureOffsets([
				{ ...base, captureOffset: "-08:00" },
				{ ...base, captureOffset: null },
			]),
		).toEqual(["-08:00", "-08:00"]);
		expect(
			inferCaptureOffsets([
				{ ...base, captureOffset: "-08:00" },
				{ ...base, captureOffset: "+01:00" },
				{ ...base, captureOffset: null },
			]),
		).toEqual(["-08:00", "+01:00", null]);
	});
});

test("rejects overlapping source and output directories", () => {
	expect(() => assertPathsDoNotOverlap("/tmp/photos", "/tmp/photos/stage")).toThrow(
		"must not overlap",
	);
	expect(() => assertPathsDoNotOverlap("/tmp/photos/source", "/tmp/photos")).toThrow(
		"must not overlap",
	);
});

test("rejects symlink-mediated source overlap and deployable outputs", async () => {
	const root = await temporaryDirectory();
	const source = join(root, "source");
	const alias = join(root, "source-alias");
	await mkdir(source);
	await symlink(source, alias, "dir");

	await expect(
		importAlbum(options(source, join(alias, "stage")), () => undefined),
	).rejects.toThrow("must not overlap");
	expect(await readdir(source)).toEqual([]);

	await expect(
		importAlbum(
			options(source, join(process.cwd(), "public", "private-photo-stage")),
			() => undefined,
		),
	).rejects.toThrow("must stay under .photo-build");
});

test("refuses to overwrite an unmanaged non-empty output", async () => {
	const root = await temporaryDirectory();
	const source = join(root, "source");
	const output = join(root, "stage");
	await mkdir(source);
	await mkdir(output);
	await writeFile(join(output, "keep.txt"), "keep me");

	await expect(importAlbum(options(source, output), () => undefined)).rejects.toThrow(
		"unmanaged non-empty output",
	);
	expect(await readFile(join(output, "keep.txt"), "utf8")).toBe("keep me");
});

test("a failed stage swap restores the previous complete generation", async () => {
	const root = await temporaryDirectory();
	const output = join(root, "stage");
	const replacement = join(root, "replacement");
	await mkdir(output);
	await mkdir(replacement);
	await writeFile(join(output, "generation.txt"), "old");
	await writeFile(join(replacement, "generation.txt"), "new");
	let renameCalls = 0;

	await expect(
		replaceStageDirectory(replacement, output, async (oldPath, newPath) => {
			renameCalls += 1;
			if (renameCalls === 2) {
				throw Object.assign(new Error("injected install failure"), { code: "EIO" });
			}
			await rename(oldPath, newPath);
		}),
	).rejects.toThrow("injected install failure");

	expect(await readFile(join(output, "generation.txt"), "utf8")).toBe("old");
	expect(await readFile(join(replacement, "generation.txt"), "utf8")).toBe("new");
});

test("stages deterministic, metadata-free masters without changing sources", async () => {
	const root = await temporaryDirectory();
	const source = join(root, "source");
	const output = join(root, "stage");
	await mkdir(source);
	await sharp({
		create: { width: 800, height: 600, channels: 3, background: "#ad341f" },
	})
		.jpeg()
		.withMetadata({ orientation: 6 })
		.toFile(join(source, "B.JPG"));
	await sharp({
		create: { width: 600, height: 800, channels: 3, background: "#264d71" },
	})
		.withIccProfile("p3")
		.jpeg()
		.toFile(join(source, "a.jpeg"));
	await writeFile(join(source, ".DS_Store"), "ignored");

	const sourceBefore = await treeDigests(source);
	const first = await importAlbum(options(source, output), () => undefined);
	const stageBefore = await treeDigests(output);
	const second = await importAlbum(options(source, output), () => undefined);
	const stageAfter = await treeDigests(output);

	expect(first.manifest.images).toHaveLength(2);
	expect(second.manifest).toEqual(first.manifest);
	expect(stageAfter).toEqual(stageBefore);
	expect(await treeDigests(source)).toEqual(sourceBefore);
	expect(first.report.summary.sourceIntegrityVerified).toBe(true);
	expect(first.report.ignoredFiles).toEqual([".DS_Store"]);
	expect(first.manifest.images.every((image) => image.width <= 256)).toBe(true);
	expect(first.manifest.images.every((image) => image.height <= 256)).toBe(true);
	const rotated = first.report.images.find((image) => image.sourceFile === "B.JPG");
	expect(rotated?.inputOrientation).toBe(6);
	expect([rotated?.width, rotated?.height]).toEqual([192, 256]);
	const p3Source = await sharp(join(source, "a.jpeg")).metadata();
	expect(p3Source.icc).toBeDefined();

	for (const image of first.manifest.images) {
		const metadata = await sharp(join(output, "masters", `${image.id}.jpg`)).metadata();
		expect(metadata.format).toBe("jpeg");
		expect(metadata.space).toBe("srgb");
		expect(metadata.orientation).toBeUndefined();
		expect(metadata.exif).toBeUndefined();
		expect(metadata.xmp).toBeUndefined();
		expect(metadata.iptc).toBeUndefined();
		expect(metadata.icc).toBeUndefined();
	}

	expect((await readFile(join(output, "contact-sheet.jpg"))).length).toBeGreaterThan(0);
	expect(
		JSON.parse(await readFile(join(output, ".jogly-photo-stage.json"), "utf8")),
	).toEqual({ schemaVersion: 1, owner: "jogly-photo-importer", album: "test-album" });
	expect((await readFile(join(output, "contact-sheet.html"), "utf8"))).toContain(
		"test-album · 2 photos",
	);

	const editedManifest = structuredClone(first.manifest);
	editedManifest.images[0].order = 2;
	editedManifest.images[0].alt = "Curated alt text";
	editedManifest.images[0].caption = "Curated caption";
	editedManifest.images[1].order = 1;
	await writeFile(
		join(output, "manifest.json"),
		`${JSON.stringify(editedManifest, null, 2)}\n`,
	);
	const curated = await importAlbum(options(source, output), () => undefined);
	const curatedImage = curated.manifest.images.find(
		(image) => image.alt === "Curated alt text",
	);
	expect(curatedImage?.order).toBe(1);
	expect(curatedImage?.caption).toBe("Curated caption");
});

test("a later import re-sorts every photo by absolute capture time", async () => {
	const root = await temporaryDirectory();
	const source = join(root, "source");
	const output = join(root, "stage");
	await mkdir(source);
	await writeTimestampedJpeg(
		join(source, "a-later.jpg"),
		"#264d71",
		"2026:09:13 02:21:02",
		"-08:00",
	);
	await importAlbum(options(source, output), () => undefined);

	await writeTimestampedJpeg(
		join(source, "z-earlier.jpg"),
		"#ad341f",
		"2026:09:13 09:44:22",
		"+01:00",
	);
	const updated = await importAlbum(options(source, output), () => undefined);

	expect(updated.report.images.map((image) => image.sourceFile)).toEqual([
		"z-earlier.jpg",
		"a-later.jpg",
	]);
	expect(updated.report.images.map((image) => image.order)).toEqual([1, 2]);
	expect(updated.report.images.map((image) => image.orderingInstantUtc)).toEqual([
		"2026-09-13T08:44:22.000Z",
		"2026-09-13T10:21:02.000Z",
	]);
});

test("a decode failure leaves an existing stage unchanged", async () => {
	const root = await temporaryDirectory();
	const goodSource = join(root, "good-source");
	const badSource = join(root, "bad-source");
	const output = join(root, "stage");
	await mkdir(goodSource);
	await mkdir(badSource);
	await sharp({
		create: { width: 640, height: 480, channels: 3, background: "#222222" },
	})
		.jpeg()
		.toFile(join(goodSource, "good.jpg"));
	await importAlbum(options(goodSource, output), () => undefined);
	const before = await treeDigests(output);

	await writeFile(join(badSource, "broken.JPG"), "not a jpeg");
	await expect(importAlbum(options(badSource, output), () => undefined)).rejects.toThrow();
	expect(await treeDigests(output)).toEqual(before);
});
