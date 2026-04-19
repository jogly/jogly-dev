// Convert the 64-bit H3 hex string (e.g. "8729a1b2bffffff") into a compact
// base-36 character encoding (lowercase letters + digits).
export function hexToCharCode(hex: string): string {
	const n = BigInt("0x" + hex);
	return n.toString(36);
}
