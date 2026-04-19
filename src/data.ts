export type WorkEntry = {
	company: string;
	role: string;
	dates: string;
	short: string;
	badge: string | null;
	link?: string;
	coord?: [number, number];
	address?: string;
	slug: string;
	html: string;
};

export type ProjectEntry = {
	name: string;
	desc: string;
	href: string;
	html: string;
};

type MdModule = { default: { frontmatter: Record<string, unknown>; html: string } };

const workModules = import.meta.glob<MdModule>("./content/work/*.md", {
	eager: true,
});
const projectModules = import.meta.glob<MdModule>("./content/projects/*.md", {
	eager: true,
});

function byFilename<T>(modules: Record<string, T>): T[] {
	return Object.keys(modules)
		.sort()
		.map((k) => modules[k]);
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function toWork(m: MdModule): WorkEntry {
	const f = m.default.frontmatter;
	const company = String(f.company);
	return {
		company,
		role: String(f.role),
		dates: String(f.dates),
		short: String(f.short),
		badge: f.badge ? String(f.badge) : null,
		link: f.link ? String(f.link) : undefined,
		coord: Array.isArray(f.coord) ? (f.coord as [number, number]) : undefined,
		address: f.address ? String(f.address) : undefined,
		slug: f.slug ? String(f.slug) : slugify(company),
		html: m.default.html,
	};
}

function toProject(m: MdModule): ProjectEntry {
	const f = m.default.frontmatter;
	return {
		name: String(f.name),
		desc: String(f.desc),
		href: String(f.href),
		html: m.default.html,
	};
}

export const WORK: WorkEntry[] = byFilename(workModules).map(toWork);
export const PROJECTS: ProjectEntry[] = byFilename(projectModules).map(toProject);
