/** Keep a readable shelf around the target; only the distant sleeves form piles. */
export function photoStack(count: number, expanded: number, height: number) {
	const lastTop = Math.max(0, height - 56);
	const flatCount = Math.min(count, Math.max(1, Math.floor((height * 0.84 + 4) / 60)));
	const pileStep = count > flatCount ? Math.max(0, (lastTop - (flatCount - 1) * 60) / (count - flatCount)) : 0;
	// Hold the viewport at the midpoint until the last sleeves have unfolded.
	const firstFlat = Math.max(0, Math.min(count - flatCount, (expanded * 60 - lastTop / 2) / (60 - pileStep)));
	const lastFlat = firstFlat + flatCount - 1;
	const shelfTop = count === flatCount ? (lastTop - (flatCount - 1) * 60) / 2 : firstFlat * pileStep;
	return Array.from({ length: count }, (_, index) => {
		const distance = index < firstFlat ? index - firstFlat : index > lastFlat ? index - lastFlat : 0;
		return {
			top: shelfTop + Math.max(0, Math.min(flatCount - 1, index - firstFlat)) * 60 + distance * pileStep,
			depth: count - Math.abs(index - expanded),
			flat: distance === 0,
			tilt: Math.sign(distance) * Math.min(20, Math.abs(distance) * 8),
			scale: 1 - Math.min(1, Math.abs(distance)) * 0.06,
		};
	});
}

/** Project the visible slice of the gallery onto its corresponding thumbnails. */
export function photoViewport(photos: { top: number; height: number }[], height: number) {
	const visible = photos.map((photo, index) => ({ ...photo, index }))
		.filter((photo) => photo.height > 0 && photo.top < height && photo.top + photo.height > 0);
	if (!visible.length) return null;
	const first = visible[0];
	const last = visible[visible.length - 1];
	const active = visible.reduce((nearest, photo) =>
		Math.abs(photo.top + photo.height / 2 - height / 2) < Math.abs(nearest.top + nearest.height / 2 - height / 2) ? photo : nearest);
	const start = Math.max(0, -first.top / first.height);
	const end = Math.min(1, (height - last.top) / last.height);
	// Center the actual visible slice, including unequal photo heights and gaps.
	const position = (first.index + last.index) / 2 + ((start + end) / 2 - 0.5) * 56 / 60;
	return {
		active: active.index, position, first: first.index, last: last.index,
		start, end,
	};
}
