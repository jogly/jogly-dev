export type PhotoFormat = "avif" | "webp" | "jpeg";

export const PHOTO_RECIPE = "v1";
export const PHOTO_QUALITY = { avif: 66, webp: 78, jpeg: 84 } as const;

export type GalleryPhoto = {
	order: number;
	id: string;
	key: string;
	width: number;
	height: number;
	alt: string;
	caption: string;
	blurSrc: string;
};

export function photoUrl(
	photo: GalleryPhoto,
	width: number,
	format: PhotoFormat,
): string {
	const safeWidth = responsiveWidths(photo).find((candidate) => candidate >= width) ?? photo.width;
	return `/photos/${PHOTO_RECIPE}/${photo.key.slice(0, -4)}/${safeWidth}.${format}`;
}

export function responsiveWidths(photo: GalleryPhoto): number[] {
	const candidates = [480, 768, 1200, 1600, 2400, photo.width];
	return [...new Set(candidates.filter((width) => width <= photo.width))].sort(
		(left, right) => left - right,
	);
}

export function photoSrcSet(
	photo: GalleryPhoto,
	format: PhotoFormat,
): string {
	return responsiveWidths(photo)
		.map((width) => `${photoUrl(photo, width, format)} ${width}w`)
		.join(", ");
}
