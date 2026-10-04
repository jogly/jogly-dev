export function reflectionBlend(progress: number, count: number) {
	const position = Math.max(0, Math.min(1, progress)) * Math.max(0, count - 1);
	const from = Math.floor(position);
	return { from, to: Math.min(from + 1, count - 1), mix: position - from };
}
