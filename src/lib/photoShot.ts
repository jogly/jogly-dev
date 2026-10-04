export type PhotoShot = {
	focalLengthMm?: number;
	aperture?: number;
	exposureSeconds?: number;
	iso?: number;
};

export function formatPhotoShot(shot?: PhotoShot): string {
	if (!shot) return "";
	const { focalLengthMm, aperture, exposureSeconds, iso } = shot;
	const denominator = exposureSeconds ? Math.round(1 / exposureSeconds) : 0;
	return [
		focalLengthMm && `${Number(focalLengthMm.toFixed(1))} mm`,
		aperture && `ƒ/${Number(aperture.toFixed(1))}`,
		exposureSeconds && (exposureSeconds < 1 && Math.abs(denominator * exposureSeconds - 1) < 0.02
			? `1/${denominator} s`
			: `${Number(exposureSeconds.toFixed(2))} s`),
		iso && `ISO ${iso}`,
	].filter(Boolean).join("\u2003");
}
