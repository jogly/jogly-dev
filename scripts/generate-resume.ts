import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import puppeteer from "puppeteer";

marked.setOptions({ gfm: true, breaks: false });

type WorkFrontmatter = {
	company: string;
	role: string;
	dates: string;
	badge?: string | null;
	link?: string;
};

type ProjectFrontmatter = {
	name: string;
	desc: string;
	href: string;
};

function loadDir<T>(relDir: string): { frontmatter: T; html: string }[] {
	const dir = fileURLToPath(new URL(relDir, import.meta.url));
	return readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.sort()
		.map((f) => {
			const src = readFileSync(`${dir}/${f}`, "utf8");
			const { data, content } = matter(src);
			const html = marked.parse(content.trim(), { async: false }) as string;
			return { frontmatter: data as T, html };
		});
}

const work = loadDir<WorkFrontmatter>("../src/content/work/");
const projects = loadDir<ProjectFrontmatter>("../src/content/projects/");

const workHtml = work
	.map(({ frontmatter: w, html }) => {
		const companyEl = w.link
			? `<a class="entry-co-link" href="${w.link}">${w.company}<span class="entry-co-arrow">↗</span></a>`
			: w.company;
		return `
  <div class="entry">
    <div class="entry-header">
      <span class="entry-co">${companyEl}${w.badge ? ` · ${w.badge}` : ""}</span>
      <span class="entry-dates">${w.dates}</span>
    </div>
    <div class="entry-role">${w.role}</div>
    <div class="entry-blurb">${html}</div>
  </div>`;
	})
	.join("");

const projectsHtml = projects
	.map(
		({ frontmatter: p }) => `
  <div class="project">
    <span class="project-name">${p.name}</span>
    <span class="project-sep"> — </span>
    <span class="project-desc">${p.desc}</span>
    <a class="project-url" href="${p.href}">${p.href.replace("https://", "")}</a>
  </div>`,
	)
	.join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Joseph Gilley — Resume</title>
<style>
  @page { size: letter; margin: 0.75in 0.9in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.55; color: #111; -webkit-font-smoothing: antialiased; }
  .name { font-size: 22pt; font-weight: 700; letter-spacing: -0.02em; }
  .contact { font-size: 8.5pt; color: #555; margin-top: 3pt; }
  .contact a { color: #555; text-decoration: none; }
  .section { margin-top: 20pt; }
  .section-title { font-size: 7pt; letter-spacing: 0.2em; text-transform: uppercase; color: #555; border-bottom: 0.5pt solid #ccc; padding-bottom: 3pt; margin-bottom: 10pt; }
  .entry { margin-bottom: 12pt; page-break-inside: avoid; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; }
  .entry-co { font-weight: 600; font-size: 10.5pt; }
  .entry-co-link { color: #111; text-decoration: none; }
  .entry-co-arrow { color: #999; font-weight: 400; font-size: 9.5pt; margin-left: 2pt; vertical-align: baseline; }
  .entry-dates { font-size: 8.5pt; color: #555; }
  .entry-role { font-style: italic; font-size: 9.5pt; color: #444; margin-top: 1pt; }
  .entry-blurb { font-size: 9pt; color: #333; margin-top: 4pt; line-height: 1.5; }
  .entry-blurb p { margin-bottom: 4pt; }
  .entry-blurb p:last-child { margin-bottom: 0; }
  .entry-blurb code { font-family: "Menlo", "Consolas", monospace; font-size: 8.5pt; background: #f2efe7; padding: 0 3pt; border-radius: 2pt; }
  .entry-blurb a { color: #111; }
  .entry-blurb strong { font-weight: 600; color: #111; }
  .entry-blurb em { font-style: italic; }
  .project { display: flex; align-items: baseline; gap: 0; margin-bottom: 5pt; font-size: 9pt; flex-wrap: wrap; }
  .project-name { font-weight: 600; }
  .project-sep { color: #888; margin: 0 4pt; }
  .project-desc { font-style: italic; color: #444; flex: 1; }
  .project-url { color: #888; font-size: 8pt; margin-left: auto; text-decoration: none; }
</style>
</head>
<body>
  <div class="name">Joseph Gilley</div>
  <div class="contact">
    San Francisco, CA
    &nbsp;·&nbsp; <a href="mailto:joe.gilley@gmail.com">joe.gilley@gmail.com</a>
    &nbsp;·&nbsp; <a href="https://jogly.dev">jogly.dev</a>
    &nbsp;·&nbsp; <a href="https://github.com/jogly">github.com/jogly</a>
    &nbsp;·&nbsp; <a href="https://linkedin.com/in/jogly">linkedin.com/in/jogly</a>
  </div>

  <div class="section">
    <div class="section-title">Experience</div>
    ${workHtml}
  </div>

  <div class="section">
    <div class="section-title">Projects</div>
    ${projectsHtml}
  </div>
</body>
</html>`;

const browser = await puppeteer.launch({ headless: true });
try {
	const page = await browser.newPage();
	await page.setContent(html, { waitUntil: "networkidle0" });
	const pdf = await page.pdf({
		preferCSSPageSize: true,
		printBackground: true,
	});
	writeFileSync(new URL("../public/resume.pdf", import.meta.url), pdf);
	console.log(`✓ resume generated → public/resume.pdf (${pdf.length} bytes)`);
} finally {
	await browser.close();
}
