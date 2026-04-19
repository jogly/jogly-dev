import react from "@vitejs/plugin-react";
import matter from "gray-matter";
import { marked } from "marked";
import { defineConfig, type Plugin } from "vite";

marked.setOptions({ gfm: true, breaks: false });

function markdownEntry(): Plugin {
	return {
		name: "markdown-entry",
		enforce: "pre",
		transform(src, id) {
			if (!id.endsWith(".md")) return;
			const { data, content } = matter(src);
			const html = marked.parse(content.trim(), { async: false }) as string;
			return {
				code: `export default ${JSON.stringify({ frontmatter: data, html })};`,
				map: null,
			};
		},
	};
}

export default defineConfig({
	plugins: [react(), markdownEntry()],
	base: "/",
});
