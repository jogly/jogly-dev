#!/usr/bin/env bun

import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import {
	access,
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	realpath,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import {
	basename,
	dirname,
	extname,
	isAbsolute,
	join,
	relative,
	resolve,
} from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import exifr from "exifr";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".heic", ".heif"]);
const RECIPE_VERSION = 2;
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 240;
const STAGE_MARKER_FILE = ".jogly-photo-stage.json";
const STAGE_OWNER = "jogly-photo-importer";

export type ImportOptions = {
	album: string;
	sourceDirectory: string;
	outputDirectory: string;
	maxEdge: number;
	quality: number;
};

type RawMetadata = {
	captureLocal: string | null;
	captureOffset: string | null;
	make: string | null;
	model: string | null;
	orientation: number | null;
	gpsPresent: boolean;
};

export type CaptureOrderingMetadata = Pick<
	RawMetadata,
	"captureLocal" | "captureOffset" | "make" | "model"
>;

type SourceSnapshot = {
	fileName: string;
	path: string;
	bytes: number;
	mtimeMs: number;
	sha256: string;
};

type ProcessedPhoto = {
	source: SourceSnapshot;
	decoder: "sharp" | "sips+sharp" | "imagemagick+sharp";
	metadata: RawMetadata;
	inputWidth: number | null;
	inputHeight: number | null;
	masterSha256: string;
	masterBytes: number;
	width: number;
	height: number;
	masterRelativePath: string;
	thumbnailRelativePath: string;
	temporaryThumbnailPath: string;
};

type PublicImage = {
	order: number;
	id: string;
	key: string;
	width: number;
	height: number;
	alt: string;
	caption: string;
};

type PublicManifest = {
	schemaVersion: 1;
	recipeVersion: number;
	album: string;
	settings: {
		maxEdge: number;
		quality: number;
	};
	images: PublicImage[];
};

type ImportReportImage = {
	order: number;
	id: string;
	sourceFile: string;
	sourceSha256: string;
	sourceBytes: number;
	decoder: ProcessedPhoto["decoder"];
	inputWidth: number | null;
	inputHeight: number | null;
	inputOrientation: number | null;
	captureLocal: string | null;
	captureOffset: string | null;
	orderingOffset: string | null;
	orderingOffsetInferred: boolean;
	orderingInstantUtc: string | null;
	make: string | null;
	model: string | null;
	gpsPresent: boolean;
	masterBytes: number;
	width: number;
	height: number;
	masterRelativePath: string;
	thumbnailRelativePath: string;
};

type ImportReport = {
	schemaVersion: 1;
	recipeVersion: number;
	mode: "local-dry-run";
	album: string;
	sourceDirectory: string;
	outputDirectory: string;
	settings: PublicManifest["settings"];
	summary: {
		acceptedFiles: number;
		ignoredFiles: number;
		sourceBytes: number;
		masterBytes: number;
		gpsFilesDetected: number;
		sourceIntegrityVerified: true;
	};
	ignoredFiles: string[];
	warnings: string[];
	images: ImportReportImage[];
};

type ImportResult = {
	manifest: PublicManifest;
	report: ImportReport;
	outputDirectory: string;
};

type StageMarker = {
	schemaVersion: 1;
	owner: typeof STAGE_OWNER;
	album: string;
};

type LogFunction = (message: string) => void;

function usage(): string {
	return `Usage:
  bun run photos:import -- \\
    --album <slug> \\
    --source <directory> \\
    [--output <directory>] \\
    [--max-edge 2560] \\
    [--quality 90] \\
    --dry-run

This command writes only a local ignored stage. It contains no upload or publish path.`;
}

function parseInteger(value: string | undefined, flag: string): number {
	if (!value || !/^\d+$/.test(value)) {
		throw new Error(`${flag} requires an integer`);
	}
	return Number(value);
}

export function parseArgs(argv: string[]): ImportOptions {
	let album: string | undefined;
	let sourceDirectory: string | undefined;
	let outputDirectory: string | undefined;
	let maxEdge = 2560;
	let quality = 90;
	let dryRun = false;

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		switch (argument) {
			case "--album":
				album = argv[++index];
				break;
			case "--source":
				sourceDirectory = argv[++index];
				break;
			case "--output":
				outputDirectory = argv[++index];
				break;
			case "--max-edge":
				maxEdge = parseInteger(argv[++index], "--max-edge");
				break;
			case "--quality":
				quality = parseInteger(argv[++index], "--quality");
				break;
			case "--dry-run":
				dryRun = true;
				break;
			default:
				throw new Error(`Unknown argument: ${argument}`);
		}
	}

	if (!album || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(album)) {
		throw new Error("--album must be a lowercase URL-safe slug");
	}
	if (!sourceDirectory) {
		throw new Error("--source is required");
	}
	if (!dryRun) {
		throw new Error("--dry-run is required; publishing is intentionally not implemented");
	}
	if (maxEdge < 320 || maxEdge > 8192) {
		throw new Error("--max-edge must be between 320 and 8192");
	}
	if (quality < 1 || quality > 100) {
		throw new Error("--quality must be between 1 and 100");
	}

	return {
		album,
		sourceDirectory: resolve(sourceDirectory),
		outputDirectory: outputDirectory
			? resolve(outputDirectory)
			: join(PROJECT_ROOT, ".photo-build", album),
		maxEdge,
		quality,
	};
}

function isWithin(parent: string, candidate: string): boolean {
	const difference = relative(parent, candidate);
	return (
		difference === "" ||
		(!difference.startsWith("..") && !isAbsolute(difference))
	);
}

export function assertPathsDoNotOverlap(
	sourceDirectory: string,
	outputDirectory: string,
): void {
	if (
		isWithin(sourceDirectory, outputDirectory) ||
		isWithin(outputDirectory, sourceDirectory)
	) {
		throw new Error("Source and output directories must not overlap");
	}
}

function sha256(data: Buffer | string): string {
	return createHash("sha256").update(data).digest("hex");
}

async function sha256File(path: string): Promise<string> {
	return sha256(await readFile(path));
}

async function canonicalizePotentialPath(path: string): Promise<string> {
	const missingSegments: string[] = [];
	let candidate = resolve(path);

	while (true) {
		try {
			const existingPath = await realpath(candidate);
			return resolve(existingPath, ...missingSegments.reverse());
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
			const parent = dirname(candidate);
			if (parent === candidate) throw error;
			missingSegments.push(basename(candidate));
			candidate = parent;
		}
	}
}

async function readJsonIfPresent<T>(path: string): Promise<T | null> {
	try {
		return JSON.parse(await readFile(path, "utf8")) as T;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

async function assertOutputIsSafe(
	requestedOutputDirectory: string,
	outputDirectory: string,
	album: string,
): Promise<void> {
	const projectRoot = await realpath(PROJECT_ROOT);
	const stageRoot = join(projectRoot, ".photo-build");
	for (const candidate of [requestedOutputDirectory, outputDirectory]) {
		if (isWithin(projectRoot, candidate) && !isWithin(stageRoot, candidate)) {
			throw new Error(
				"Photo stages inside the repository must stay under .photo-build/ so private reports cannot be deployed",
			);
		}
	}
	if (outputDirectory === stageRoot) {
		throw new Error("The output must be an album directory below .photo-build/");
	}

	let entries;
	try {
		entries = await readdir(outputDirectory);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}
	if (entries.length === 0) return;

	const marker = await readJsonIfPresent<StageMarker>(
		join(outputDirectory, STAGE_MARKER_FILE),
	);
	if (
		marker?.schemaVersion === 1 &&
		marker.owner === STAGE_OWNER &&
		marker.album === album
	) {
		return;
	}

	const legacyReport = await readJsonIfPresent<ImportReport>(
		join(outputDirectory, "import-report.json"),
	);
	if (
		legacyReport?.mode === "local-dry-run" &&
		legacyReport.album === album
	) {
		return;
	}

	throw new Error(
		`Refusing to replace unmanaged non-empty output directory: ${outputDirectory}`,
	);
}

async function discoverFiles(sourceDirectory: string): Promise<{
	accepted: string[];
	ignored: string[];
}> {
	const entries = await readdir(sourceDirectory, { withFileTypes: true });
	const accepted: string[] = [];
	const ignored: string[] = [];

	for (const entry of entries) {
		if (!entry.isFile()) {
			ignored.push(entry.name);
			continue;
		}
		if (SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
			accepted.push(entry.name);
		} else {
			ignored.push(entry.name);
		}
	}

	accepted.sort((left, right) => left.localeCompare(right, "en"));
	ignored.sort((left, right) => left.localeCompare(right, "en"));
	return { accepted, ignored };
}

async function snapshotSource(
	sourceDirectory: string,
	fileName: string,
): Promise<SourceSnapshot> {
	const path = join(sourceDirectory, fileName);
	const details = await stat(path);
	return {
		fileName,
		path,
		bytes: details.size,
		mtimeMs: details.mtimeMs,
		sha256: await sha256File(path),
	};
}

async function runDecoder(command: string, args: string[]): Promise<void> {
	await execFileAsync(command, args, { maxBuffer: 8 * 1024 * 1024 });
}

async function prepareInput(
	source: SourceSnapshot,
	temporaryDirectory: string,
): Promise<{
	path: string;
	decoder: ProcessedPhoto["decoder"];
}> {
	const extension = extname(source.fileName).toLowerCase();
	if (extension !== ".heic" && extension !== ".heif") {
		return { path: source.path, decoder: "sharp" };
	}

	const decodedPath = join(
		temporaryDirectory,
		`${source.sha256.slice(0, 16)}-decoded.png`,
	);
	const failures: string[] = [];

	if (process.platform === "darwin") {
		try {
			await access("/usr/bin/sips");
			await runDecoder("/usr/bin/sips", [
				"-s",
				"format",
				"png",
				source.path,
				"--out",
				decodedPath,
			]);
			return { path: decodedPath, decoder: "sips+sharp" };
		} catch (error) {
			failures.push(`sips: ${(error as Error).message}`);
		}
	}

	try {
		await runDecoder("magick", [source.path, "-auto-orient", decodedPath]);
		return { path: decodedPath, decoder: "imagemagick+sharp" };
	} catch (error) {
		failures.push(`ImageMagick: ${(error as Error).message}`);
	}

	throw new Error(
		`Unable to decode ${source.fileName}. Install ImageMagick with HEIC support. ${failures.join(" | ")}`,
	);
}

function optionalString(
	metadata: Record<string, unknown> | undefined,
	key: string,
): string | null {
	const value = metadata?.[key];
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(
	metadata: Record<string, unknown> | undefined,
	key: string,
): number | null {
	const value = metadata?.[key];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function readRawMetadata(path: string): Promise<RawMetadata> {
	let metadata: Record<string, unknown> | undefined;
	try {
		metadata = (await exifr.parse(path, {
			pick: [
				"DateTimeOriginal",
				"OffsetTimeOriginal",
				"Orientation",
				"Make",
				"Model",
			],
			translateValues: false,
			reviveValues: false,
			sanitize: true,
		})) as Record<string, unknown> | undefined;
	} catch {
		metadata = undefined;
	}

	let gpsPresent = false;
	try {
		const gps = await exifr.gps(path);
		gpsPresent =
			gps !== undefined &&
			Number.isFinite(gps.latitude) &&
			Number.isFinite(gps.longitude);
	} catch {
		gpsPresent = false;
	}

	return {
		captureLocal: optionalString(metadata, "DateTimeOriginal"),
		captureOffset: optionalString(metadata, "OffsetTimeOriginal"),
		make: optionalString(metadata, "Make"),
		model: optionalString(metadata, "Model"),
		orientation: optionalNumber(metadata, "Orientation"),
		gpsPresent,
	};
}

async function normalizePhoto(
	inputPath: string,
	options: ImportOptions,
): Promise<{
	master: Buffer;
	thumbnail: Buffer;
	width: number;
	height: number;
}> {
	const { data: master, info } = await sharp(inputPath, { failOn: "error" })
		.autoOrient()
		.withIccProfile("srgb", { attach: false })
		.resize({
			width: options.maxEdge,
			height: options.maxEdge,
			fit: "inside",
			withoutEnlargement: true,
		})
		.jpeg({
			quality: options.quality,
			progressive: true,
			mozjpeg: true,
			chromaSubsampling: "4:2:0",
		})
		.toBuffer({ resolveWithObject: true });

	if (!info.width || !info.height) {
		throw new Error(`Decoder did not return output dimensions for ${inputPath}`);
	}

	const normalizedMetadata = await sharp(master).metadata();
	if (
		normalizedMetadata.format !== "jpeg" ||
		normalizedMetadata.width !== info.width ||
		normalizedMetadata.height !== info.height ||
		normalizedMetadata.space !== "srgb" ||
		info.width > options.maxEdge ||
		info.height > options.maxEdge ||
		normalizedMetadata.orientation !== undefined ||
		normalizedMetadata.exif !== undefined ||
		normalizedMetadata.xmp !== undefined ||
		normalizedMetadata.iptc !== undefined ||
		normalizedMetadata.icc !== undefined
	) {
		throw new Error(`Normalized output validation failed for ${inputPath}`);
	}

	const thumbnail = await sharp(master)
		.resize({
			width: THUMBNAIL_WIDTH,
			height: THUMBNAIL_HEIGHT,
			fit: "contain",
			background: "#eee9dc",
		})
		.jpeg({ quality: 78, progressive: true, mozjpeg: true })
		.toBuffer();

	return { master, thumbnail, width: info.width, height: info.height };
}

export function captureInstantMillis(
	captureLocal: string | null,
	captureOffset: string | null,
): number | null {
	if (!captureLocal || !captureOffset) return null;
	const localMatch =
		/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(captureLocal);
	const offsetMatch = /^([+-])(\d{2}):(\d{2})$/.exec(captureOffset);
	if (!localMatch || !offsetMatch) return null;

	const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
		localMatch;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const hour = Number(hourText);
	const minute = Number(minuteText);
	const second = Number(secondText);
	const offsetHours = Number(offsetMatch[2]);
	const offsetMinutesPart = Number(offsetMatch[3]);
	if (offsetHours > 23 || offsetMinutesPart > 59) return null;

	const localMillis = Date.UTC(year, month - 1, day, hour, minute, second);
	const normalized = new Date(localMillis);
	if (
		normalized.getUTCFullYear() !== year ||
		normalized.getUTCMonth() !== month - 1 ||
		normalized.getUTCDate() !== day ||
		normalized.getUTCHours() !== hour ||
		normalized.getUTCMinutes() !== minute ||
		normalized.getUTCSeconds() !== second
	) {
		return null;
	}

	const direction = offsetMatch[1] === "+" ? 1 : -1;
	const offsetMinutes = direction * (offsetHours * 60 + offsetMinutesPart);
	return localMillis - offsetMinutes * 60_000;
}

function cameraGroup(metadata: CaptureOrderingMetadata): string | null {
	return metadata.make && metadata.model
		? `${metadata.make}\u0000${metadata.model}`
		: null;
}

export function inferCaptureOffsets(
	records: CaptureOrderingMetadata[],
): Array<string | null> {
	const offsetsByCamera = new Map<string, Set<string>>();
	for (const record of records) {
		const group = cameraGroup(record);
		if (
			!group ||
			!record.captureOffset ||
			captureInstantMillis(record.captureLocal, record.captureOffset) === null
		) {
			continue;
		}
		const offsets = offsetsByCamera.get(group) ?? new Set<string>();
		offsets.add(record.captureOffset);
		offsetsByCamera.set(group, offsets);
	}

	return records.map((record) => {
		if (captureInstantMillis(record.captureLocal, record.captureOffset) !== null) {
			return record.captureOffset;
		}
		if (!record.captureLocal || record.captureOffset) return null;
		const group = cameraGroup(record);
		if (!group) return null;
		const offsets = offsetsByCamera.get(group);
		return offsets?.size === 1 ? [...offsets][0] : null;
	});
}

function compareForChronologicalOrder(
	left: ProcessedPhoto,
	right: ProcessedPhoto,
	resolvedOffsets: Map<ProcessedPhoto, string | null>,
): number {
	const leftInstant = captureInstantMillis(
		left.metadata.captureLocal,
		resolvedOffsets.get(left) ?? null,
	);
	const rightInstant = captureInstantMillis(
		right.metadata.captureLocal,
		resolvedOffsets.get(right) ?? null,
	);
	if (leftInstant !== null && rightInstant !== null) {
		return (
			leftInstant - rightInstant ||
			left.source.fileName.localeCompare(right.source.fileName, "en") ||
			left.source.sha256.localeCompare(right.source.sha256, "en")
		);
	}
	if (leftInstant !== null && rightInstant === null) return -1;
	if (leftInstant === null && rightInstant !== null) return 1;

	const leftDate = left.metadata.captureLocal ?? "9999:99:99 99:99:99";
	const rightDate = right.metadata.captureLocal ?? "9999:99:99 99:99:99";
	return (
		leftDate.localeCompare(rightDate, "en") ||
		left.source.fileName.localeCompare(right.source.fileName, "en") ||
		left.source.sha256.localeCompare(right.source.sha256, "en")
	);
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

async function buildContactSheet(
	photos: Array<{ photo: ProcessedPhoto; order: number }>,
): Promise<Buffer> {
	const columns = 6;
	const gap = 16;
	const labelHeight = 42;
	const cardWidth = THUMBNAIL_WIDTH;
	const cardHeight = THUMBNAIL_HEIGHT + labelHeight;
	const rows = Math.ceil(photos.length / columns);
	const width = gap + columns * (cardWidth + gap);
	const height = gap + rows * (cardHeight + gap);
	const composites: Array<{ input: Buffer; left: number; top: number }> = [];

	for (const [index, item] of photos.entries()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const left = gap + column * (cardWidth + gap);
		const top = gap + row * (cardHeight + gap);
		const thumbnail = await readFile(item.photo.temporaryThumbnailPath);
		const label = `${String(item.order).padStart(2, "0")} · ${item.photo.source.fileName}`;
		const date = [
			item.photo.metadata.captureLocal,
			item.photo.metadata.captureOffset,
		]
			.filter(Boolean)
			.join(" ");
		const svg = Buffer.from(`<svg width="${cardWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
	<rect width="100%" height="100%" fill="#f4f1e8"/>
	<text x="4" y="16" font-family="monospace" font-size="12" fill="#15120e">${escapeXml(label)}</text>
	<text x="4" y="33" font-family="monospace" font-size="10" fill="#6d655b">${escapeXml(date || "capture time unavailable")}</text>
</svg>`);
		composites.push({ input: thumbnail, left, top });
		composites.push({ input: svg, left, top: top + THUMBNAIL_HEIGHT });
	}

	return sharp({
		create: {
			width,
			height,
			channels: 3,
			background: "#f4f1e8",
		},
	})
		.composite(composites)
		.jpeg({ quality: 88, progressive: true, mozjpeg: true })
		.toBuffer();
}

function buildContactSheetHtml(
	album: string,
	photos: Array<{ photo: ProcessedPhoto; order: number }>,
): string {
	const cards = photos
		.map(({ photo, order }) => {
			const date = [photo.metadata.captureLocal, photo.metadata.captureOffset]
				.filter(Boolean)
				.join(" ");
			return `<figure>
	<img src="${escapeXml(photo.thumbnailRelativePath)}" width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" alt="">
	<figcaption><strong>${String(order).padStart(2, "0")} · ${escapeXml(photo.source.fileName)}</strong><br>${escapeXml(date || "capture time unavailable")}</figcaption>
</figure>`;
		})
		.join("\n");

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeXml(album)} photo import review</title>
<style>
body{margin:0;padding:24px;background:#f4f1e8;color:#15120e;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
h1{font:600 28px/1.1 Georgia,serif;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}
figure{margin:0}img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:contain;background:#eee9dc}figcaption{padding-top:8px;color:#6d655b}strong{color:#15120e}
</style>
</head>
<body>
<h1>${escapeXml(album)} · ${photos.length} photos</h1>
<main class="grid">${cards}</main>
</body>
</html>
`;
}

async function verifySourceUnchanged(
	sourceDirectory: string,
	snapshots: SourceSnapshot[],
): Promise<void> {
	const current = await discoverFiles(sourceDirectory);
	const expectedNames = snapshots.map((snapshot) => snapshot.fileName);
	if (JSON.stringify(current.accepted) !== JSON.stringify(expectedNames)) {
		throw new Error("Source image list changed during import; stage was not committed");
	}

	for (const snapshot of snapshots) {
		const details = await stat(snapshot.path);
		const currentHash = await sha256File(snapshot.path);
		if (
			details.size !== snapshot.bytes ||
			details.mtimeMs !== snapshot.mtimeMs ||
			currentHash !== snapshot.sha256
		) {
			throw new Error(
				`Source changed during import: ${snapshot.fileName}; stage was not committed`,
			);
		}
	}
}

async function preserveExistingMasters(
	outputDirectory: string,
	temporaryDirectory: string,
): Promise<void> {
	let entries;
	try {
		entries = await readdir(join(outputDirectory, "masters"), {
			withFileTypes: true,
		});
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}

	for (const entry of entries) {
		if (!entry.isFile() || !/^[a-f0-9]{64}\.jpg$/.test(entry.name)) continue;
		const target = join(temporaryDirectory, "masters", entry.name);
		try {
			await access(target);
			continue;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}

		const source = join(outputDirectory, "masters", entry.name);
		const expectedHash = entry.name.slice(0, -4);
		if ((await sha256File(source)) !== expectedHash) {
			throw new Error(`Existing content-addressed master is corrupt: ${source}`);
		}
		await copyFile(source, target);
	}
}

type RenameDirectory = (oldPath: string, newPath: string) => Promise<void>;

export async function replaceStageDirectory(
	temporaryDirectory: string,
	outputDirectory: string,
	renameDirectory: RenameDirectory = rename,
): Promise<void> {
	const backupDirectory = join(
		dirname(outputDirectory),
		`.${basename(outputDirectory)}-backup-${randomUUID()}`,
	);
	let previousStageMoved = false;

	try {
		await renameDirectory(outputDirectory, backupDirectory);
		previousStageMoved = true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}

	try {
		await renameDirectory(temporaryDirectory, outputDirectory);
	} catch (installError) {
		if (previousStageMoved) {
			try {
				await renameDirectory(backupDirectory, outputDirectory);
			} catch (rollbackError) {
				throw new AggregateError(
					[installError, rollbackError],
					`Stage install and rollback both failed; prior stage remains at ${backupDirectory}`,
				);
			}
		}
		throw installError;
	}

	if (previousStageMoved) {
		await rm(backupDirectory, { recursive: true, force: true });
	}
}

async function commitStage(
	temporaryDirectory: string,
	outputDirectory: string,
): Promise<void> {
	await preserveExistingMasters(outputDirectory, temporaryDirectory);
	await replaceStageDirectory(temporaryDirectory, outputDirectory);
}

function previousManifestValues(
	manifest: PublicManifest | null,
	report: ImportReport | null,
): Map<string, { alt: string; caption: string }> {
	const values = new Map<string, { alt: string; caption: string }>();
	if (!manifest || !report || manifest.album !== report.album) return values;
	const manifestById = new Map(manifest.images.map((image) => [image.id, image]));
	for (const image of report.images) {
		const publicImage = manifestById.get(image.id);
		if (!publicImage) continue;
		values.set(image.sourceSha256, {
			alt: publicImage.alt,
			caption: publicImage.caption,
		});
	}
	return values;
}

export async function importAlbum(
	options: ImportOptions,
	log: LogFunction = console.log,
): Promise<ImportResult> {
	const sourceDirectory = await realpath(options.sourceDirectory);
	const requestedOutputDirectory = resolve(options.outputDirectory);
	const outputDirectory = await canonicalizePotentialPath(requestedOutputDirectory);
	assertPathsDoNotOverlap(sourceDirectory, outputDirectory);
	await assertOutputIsSafe(
		requestedOutputDirectory,
		outputDirectory,
		options.album,
	);

	const { accepted, ignored } = await discoverFiles(sourceDirectory);
	if (accepted.length === 0) {
		throw new Error(`No supported images found in ${sourceDirectory}`);
	}

	const previousManifest = await readJsonIfPresent<PublicManifest>(
		join(outputDirectory, "manifest.json"),
	);
	const previousReport = await readJsonIfPresent<ImportReport>(
		join(outputDirectory, "import-report.json"),
	);
	const previousValues = previousManifestValues(previousManifest, previousReport);

	await mkdir(dirname(outputDirectory), { recursive: true });
	const temporaryDirectory = await mkdtemp(
		join(dirname(outputDirectory), `.${basename(outputDirectory)}-run-`),
	);
	const scratchDirectory = join(temporaryDirectory, ".scratch");
	await mkdir(join(temporaryDirectory, "masters"), { recursive: true });
	await mkdir(join(temporaryDirectory, "thumbnails"), { recursive: true });
	await mkdir(scratchDirectory);

	const photos: ProcessedPhoto[] = [];
	try {
		for (const [index, fileName] of accepted.entries()) {
			const source = await snapshotSource(sourceDirectory, fileName);
			const prepared = await prepareInput(source, scratchDirectory);
			const inputMetadata = await sharp(prepared.path).metadata();
			const metadata = await readRawMetadata(prepared.path);
			const normalized = await normalizePhoto(prepared.path, options);
			const masterSha256 = sha256(normalized.master);
			const masterRelativePath = join("masters", `${masterSha256}.jpg`);
			const thumbnailRelativePath = join(
				"thumbnails",
				`${masterSha256}.jpg`,
			);
			const temporaryMasterPath = join(
				temporaryDirectory,
				masterRelativePath,
			);
			const temporaryThumbnailPath = join(
				temporaryDirectory,
				thumbnailRelativePath,
			);
			await writeFile(temporaryMasterPath, normalized.master);
			await writeFile(temporaryThumbnailPath, normalized.thumbnail);

			photos.push({
				source,
				decoder: prepared.decoder,
				metadata,
				inputWidth: inputMetadata.width ?? null,
				inputHeight: inputMetadata.height ?? null,
				masterSha256,
				masterBytes: normalized.master.length,
				width: normalized.width,
				height: normalized.height,
				masterRelativePath,
				thumbnailRelativePath,
				temporaryThumbnailPath,
			});
			log(`[${index + 1}/${accepted.length}] ${fileName} → ${masterSha256.slice(0, 12)}`);
		}

		const inferredOffsets = inferCaptureOffsets(
			photos.map((photo) => photo.metadata),
		);
		const resolvedOffsets = new Map(
			photos.map((photo, index) => [photo, inferredOffsets[index]]),
		);
		const ordered = [...photos]
			.sort((left, right) =>
				compareForChronologicalOrder(left, right, resolvedOffsets),
			)
			.map((photo, index) => ({ photo, order: index + 1 }));

		const manifest: PublicManifest = {
			schemaVersion: 1,
			recipeVersion: RECIPE_VERSION,
			album: options.album,
			settings: { maxEdge: options.maxEdge, quality: options.quality },
			images: ordered.map(({ photo, order }) => {
				const previous = previousValues.get(photo.source.sha256);
				return {
					order,
					id: photo.masterSha256,
					key: `${options.album}/${photo.masterSha256}.jpg`,
					width: photo.width,
					height: photo.height,
					alt: previous?.alt ?? "",
					caption: previous?.caption ?? "",
				};
			}),
		};

		const warnings: string[] = [];
		const inferredOffsetPhotos = photos.filter(
			(photo) =>
				photo.metadata.captureLocal &&
				!photo.metadata.captureOffset &&
				resolvedOffsets.get(photo),
		);
		if (inferredOffsetPhotos.length > 0) {
			const inferredValues = [
				...new Set(
					inferredOffsetPhotos.map((photo) => resolvedOffsets.get(photo)),
				),
			].sort();
			warnings.push(
				`${inferredOffsetPhotos.length} photo(s) lack a capture offset; inferred ${inferredValues.join(", ")} from matching camera metadata for absolute-time ordering.`,
			);
		}
		const unresolvedCaptureTimes = photos.filter(
			(photo) =>
				photo.metadata.captureLocal &&
				captureInstantMillis(
					photo.metadata.captureLocal,
					resolvedOffsets.get(photo) ?? null,
				) === null,
		).length;
		if (unresolvedCaptureTimes > 0) {
			warnings.push(
				`${unresolvedCaptureTimes} photo(s) have unresolved capture times and were sorted after offset-aware timestamps.`,
			);
		}
		const gpsFilesDetected = photos.filter(
			(photo) => photo.metadata.gpsPresent,
		).length;
		if (gpsFilesDetected > 0) {
			warnings.push(
				`${gpsFilesDetected} source photo(s) contain GPS coordinates. Coordinates were not copied to the public manifest or normalized masters.`,
			);
		}

		const report: ImportReport = {
			schemaVersion: 1,
			recipeVersion: RECIPE_VERSION,
			mode: "local-dry-run",
			album: options.album,
			sourceDirectory,
			outputDirectory,
			settings: manifest.settings,
			summary: {
				acceptedFiles: photos.length,
				ignoredFiles: ignored.length,
				sourceBytes: photos.reduce(
					(total, photo) => total + photo.source.bytes,
					0,
				),
				masterBytes: photos.reduce(
					(total, photo) => total + photo.masterBytes,
					0,
				),
				gpsFilesDetected,
				sourceIntegrityVerified: true,
			},
			ignoredFiles: ignored,
			warnings,
			images: ordered.map(({ photo, order }) => {
				const orderingOffset = resolvedOffsets.get(photo) ?? null;
				const orderingInstant = captureInstantMillis(
					photo.metadata.captureLocal,
					orderingOffset,
				);
				return {
					order,
					id: photo.masterSha256,
					sourceFile: photo.source.fileName,
					sourceSha256: photo.source.sha256,
					sourceBytes: photo.source.bytes,
					decoder: photo.decoder,
					inputWidth: photo.inputWidth,
					inputHeight: photo.inputHeight,
					inputOrientation: photo.metadata.orientation,
					captureLocal: photo.metadata.captureLocal,
					captureOffset: photo.metadata.captureOffset,
					orderingOffset,
					orderingOffsetInferred:
						photo.metadata.captureOffset === null && orderingOffset !== null,
					orderingInstantUtc:
						orderingInstant === null
							? null
							: new Date(orderingInstant).toISOString(),
					make: photo.metadata.make,
					model: photo.metadata.model,
					gpsPresent: photo.metadata.gpsPresent,
					masterBytes: photo.masterBytes,
					width: photo.width,
					height: photo.height,
					masterRelativePath: photo.masterRelativePath,
					thumbnailRelativePath: photo.thumbnailRelativePath,
				};
			}),
		};

		await writeFile(
			join(temporaryDirectory, "manifest.json"),
			`${JSON.stringify(manifest, null, 2)}\n`,
		);
		await writeFile(
			join(temporaryDirectory, "import-report.json"),
			`${JSON.stringify(report, null, 2)}\n`,
		);
		await writeFile(
			join(temporaryDirectory, "contact-sheet.html"),
			buildContactSheetHtml(options.album, ordered),
		);
		await writeFile(
			join(temporaryDirectory, "contact-sheet.jpg"),
			await buildContactSheet(ordered),
		);
		const marker: StageMarker = {
			schemaVersion: 1,
			owner: STAGE_OWNER,
			album: options.album,
		};
		await writeFile(
			join(temporaryDirectory, STAGE_MARKER_FILE),
			`${JSON.stringify(marker, null, 2)}\n`,
		);

		await verifySourceUnchanged(
			sourceDirectory,
			photos.map((photo) => photo.source),
		);
		await rm(scratchDirectory, { recursive: true, force: true });
		await commitStage(temporaryDirectory, outputDirectory);
		return { manifest, report, outputDirectory };
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log(usage());
		return;
	}

	const options = parseArgs(argv);
	const result = await importAlbum(options);
	const { summary } = result.report;
	console.log(`\n✓ staged ${summary.acceptedFiles} photos → ${result.outputDirectory}`);
	console.log(`✓ source integrity verified (${summary.sourceBytes} bytes)`);
	console.log(`✓ normalized masters: ${summary.masterBytes} bytes`);
	console.log("✓ no uploads or remote changes performed");
	for (const warning of result.report.warnings) console.warn(`! ${warning}`);
}

if (import.meta.main) {
	main().catch((error: unknown) => {
		console.error(`photo import failed: ${(error as Error).message}`);
		process.exitCode = 1;
	});
}
