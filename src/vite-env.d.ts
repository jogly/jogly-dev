/// <reference types="vite/client" />

declare module "*.md" {
	const mod: { frontmatter: Record<string, unknown>; html: string };
	export default mod;
}
