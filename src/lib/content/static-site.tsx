import { randomUUID } from "node:crypto";
import {
	copyFile,
	lstat,
	mkdir,
	readdir,
	readFile,
	realpath,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import type { ReactNode } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { BeatPlayer } from "@/app/_components/beat-player";
import { EventArchiveList } from "@/app/_components/event-archive-list";
import { EventArchiveShell } from "@/app/_components/event-archive-shell";
import { EventArticle } from "@/app/_components/event-article";
import { EventExplorer } from "@/app/_components/event-explorer/event-explorer";
import {
	compareLocalized,
	formatNumber,
	historicalDateMessages,
	primaryLocale,
} from "../i18n/locale";
import { messages } from "../i18n/messages.nl-BE";
import {
	createPeriodArchives,
	createTopicArchives,
	type PeriodArchive,
	type TopicArchive,
} from "./event-archives";
import { collectTopicLabels, toEventCatalogEntry } from "./event-catalog";
import type { Event } from "./event-document";
import { createEventExplorerBootstrap } from "./event-explorer-data";
import { getEventVisual } from "./event-media";

export const staticPublicSiteHardFileLimit = 18_000;
const maximumStaticHtmlFiles = 10_500;

type Discovery = {
	releaseId: string;
	searchIndexUrl: string;
	workerUrl: string;
};

type GenerateStaticPublicSiteOptions = {
	discovery: Discovery;
	events: Event[];
	nextStaticDirectory: string;
	origin: string;
	outputDirectory: string;
	publicDirectory: string;
};

export type StaticPublicSiteResult = {
	eventCount: number;
	fileCount: number;
	htmlFileCount: number;
	paths: string[];
};

export async function generateStaticPublicSite({
	discovery,
	events,
	nextStaticDirectory,
	origin,
	outputDirectory,
	publicDirectory,
}: GenerateStaticPublicSiteOptions): Promise<StaticPublicSiteResult> {
	const siteOrigin = requireOrigin(origin);
	const nextStaticRoot = await requireRealDirectory(
		nextStaticDirectory,
		"Next static directory",
	);
	const publicRoot = await requireRealDirectory(
		publicDirectory,
		"Public directory",
	);
	const outputParent = await requireRealDirectory(
		path.dirname(outputDirectory),
		"Static output parent",
	);
	const outputRoot = path.join(outputParent, path.basename(outputDirectory));
	await requireOptionalRealDirectory(outputRoot, "Static output directory");
	const stagedRoot = path.join(outputParent, `.static-site-${randomUUID()}`);
	const backupRoot = path.join(
		outputParent,
		`.static-site-backup-${randomUUID()}`,
	);
	await mkdir(stagedRoot);
	let backedUp = false;
	let activated = false;
	try {
		const shared = await stageSharedAssets({
			discovery,
			events,
			nextStaticRoot,
			publicRoot,
			stagedRoot,
		});
		const bundles = await buildBrowserBundles(stagedRoot);
		const catalog = events.map(toEventCatalogEntry);
		const periods = createPeriodArchives(catalog);
		const topics = createTopicArchives(catalog);
		const bootstrap = createEventExplorerBootstrap(catalog, {
			releaseId: discovery.releaseId,
			workerUrl: discovery.workerUrl,
		});
		const adminBootstrap = {
			topicLabels: collectTopicLabels(catalog),
			topicOptions: [...new Set(catalog.flatMap((event) => event.topics))].sort(
				compareLocalized,
			),
		};
		if (bootstrap.searchIndexUrl !== discovery.searchIndexUrl) {
			throw new Error("Static discovery search URL does not match release ID");
		}
		await writeSiteFile(
			stagedRoot,
			"index.html",
			renderHomeDocument({
				bootstrap,
				bodyClassName: shared.bodyClassName,
				cssPaths: shared.cssPaths,
				homeBundleUrl: bundles.home,
				origin: siteOrigin,
			}),
		);
		await writeSiteFile(
			stagedRoot,
			"admin.html",
			renderAdminDocument({
				adminBundleUrl: bundles.admin,
				bodyClassName: shared.bodyClassName,
				bootstrap: adminBootstrap,
				cssPaths: shared.cssPaths,
				origin: siteOrigin,
			}),
		);
		for (const event of events) {
			await writeSiteFile(
				stagedRoot,
				`events/${event.slug}.html`,
				renderArticleDocument({
					bodyClassName: shared.bodyClassName,
					cssPaths: shared.cssPaths,
					event,
					origin: siteOrigin,
				}),
			);
			await writeSiteFile(
				stagedRoot,
				`events/${event.slug}/play.html`,
				renderClassroomDocument({
					bodyClassName: shared.bodyClassName,
					classroomBundleUrl: bundles.classroom,
					cssPaths: shared.cssPaths,
					event,
					origin: siteOrigin,
				}),
			);
		}
		await writeArchiveDocuments({
			bodyClassName: shared.bodyClassName,
			cssPaths: shared.cssPaths,
			origin: siteOrigin,
			periods,
			stagedRoot,
			topics,
		});
		await writeSiteFile(
			stagedRoot,
			"404.html",
			renderNotFoundDocument(shared.cssPaths, shared.bodyClassName, siteOrigin),
		);
		const sitemapPaths = [
			"/",
			...events.map(({ slug }) => `/events/${slug}`),
			"/archive",
			...periods.map(({ id }) => `/archive/periods/${id}`),
			...topics.map(({ id }) => `/archive/topics/${id}`),
		];
		await writeSiteFile(
			stagedRoot,
			"sitemap.xml",
			renderSitemap(siteOrigin, sitemapPaths),
		);
		await writeSiteFile(
			stagedRoot,
			"robots.txt",
			`User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin}/sitemap.xml\n`,
		);

		const inspection = await inspectStaticPublicSite(stagedRoot);
		const expectedHtmlFiles =
			4 + events.length * 2 + periods.length + topics.length;
		if (inspection.htmlFileCount !== expectedHtmlFiles) {
			throw new Error(
				`Static HTML inventory mismatch: expected ${expectedHtmlFiles}, received ${inspection.htmlFileCount}`,
			);
		}
		if (inspection.htmlFileCount > maximumStaticHtmlFiles) {
			throw new Error(
				`Static HTML count ${inspection.htmlFileCount} exceeds target ${maximumStaticHtmlFiles}`,
			);
		}
		await requireRealDirectory(outputParent, "Static output parent");
		await requireOptionalRealDirectory(outputRoot, "Static output directory");
		try {
			await rename(outputRoot, backupRoot);
			backedUp = true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
		await rename(stagedRoot, outputRoot);
		activated = true;
		if (backedUp) {
			await rm(backupRoot, { recursive: true, force: true }).catch(() => {
				console.warn(
					JSON.stringify({ event: "static-site-backup-cleanup-failed" }),
				);
			});
		}
		return {
			eventCount: events.length,
			fileCount: inspection.fileCount,
			htmlFileCount: inspection.htmlFileCount,
			paths: inspection.paths,
		};
	} catch (error) {
		if (backedUp && !activated) {
			await rename(backupRoot, outputRoot);
		}
		throw error;
	} finally {
		await rm(stagedRoot, { recursive: true, force: true });
	}
}

export async function inspectStaticPublicSite(
	root: string,
	{ hardFileLimit = staticPublicSiteHardFileLimit } = {},
): Promise<{ fileCount: number; htmlFileCount: number; paths: string[] }> {
	const realRoot = await requireRealDirectory(root, "Static site directory");
	const paths: string[] = [];
	async function visit(directory: string): Promise<void> {
		const entries = await readdir(directory, { withFileTypes: true });
		for (const entry of entries) {
			const absolute = path.join(directory, entry.name);
			const relative = path
				.relative(realRoot, absolute)
				.split(path.sep)
				.join("/");
			const metadata = await lstat(absolute);
			if (metadata.isSymbolicLink()) {
				throw new Error(`Static site contains symbolic link: ${relative}`);
			}
			if (metadata.isDirectory()) {
				await visit(absolute);
				continue;
			}
			if (!metadata.isFile()) {
				throw new Error(`Static site contains unsupported entry: ${relative}`);
			}
			if (metadata.size > 25 * 1024 ** 2) {
				throw new Error(`Static site file exceeds 25 MiB: ${relative}`);
			}
			paths.push(relative);
			if (paths.length > hardFileLimit) {
				throw new Error(
					`Static site file count ${paths.length} exceeds hard limit ${hardFileLimit}`,
				);
			}
		}
	}
	await visit(realRoot);
	paths.sort();
	return {
		fileCount: paths.length,
		htmlFileCount: paths.filter((entry) => entry.endsWith(".html")).length,
		paths,
	};
}

async function stageSharedAssets({
	discovery,
	events,
	nextStaticRoot,
	publicRoot,
	stagedRoot,
}: {
	discovery: Discovery;
	events: Event[];
	nextStaticRoot: string;
	publicRoot: string;
	stagedRoot: string;
}): Promise<{ bodyClassName: string; cssPaths: string[] }> {
	await copyRealFile(
		path.join(publicRoot, "favicon.svg"),
		path.join(stagedRoot, "favicon.svg"),
	);
	await copyRealFile(
		path.join(publicRoot, "_headers"),
		path.join(stagedRoot, "_headers"),
	);
	for (const publicPath of [
		discovery.workerUrl,
		discovery.searchIndexUrl,
		path.posix.join(
			path.posix.dirname(discovery.searchIndexUrl),
			"facets.json",
		),
	]) {
		await copyPublicAsset(publicRoot, stagedRoot, publicPath);
	}
	const visualPaths = new Set(
		events.flatMap((event) => {
			const visual = getEventVisual(event.slug);
			return visual ? [visual.src] : [];
		}),
	);
	for (const visualPath of visualPaths) {
		await copyPublicAsset(publicRoot, stagedRoot, visualPath);
	}

	const cssSource = path.join(nextStaticRoot, "chunks");
	const cssNames = (await readRealDirectory(cssSource, "Next CSS directory"))
		.filter((entry) => entry.endsWith(".css"))
		.sort();
	if (cssNames.length === 0)
		throw new Error("Next static build has no CSS assets");
	const cssPaths: string[] = [];
	let css = "";
	for (const name of cssNames) {
		const source = path.join(cssSource, name);
		const destination = path.join(stagedRoot, "_next/static/chunks", name);
		await copyRealFile(source, destination);
		cssPaths.push(`/_next/static/chunks/${name}`);
		css += await readFile(source, "utf8");
	}
	const fontSource = path.join(nextStaticRoot, "media");
	for (const name of (
		await readRealDirectory(fontSource, "Next font directory")
	)
		.filter((entry) => entry.endsWith(".woff2"))
		.sort()) {
		await copyRealFile(
			path.join(fontSource, name),
			path.join(stagedRoot, "_next/static/media", name),
		);
	}
	const bodyClassName = [
		findFontVariableClass(css, "body"),
		findFontVariableClass(css, "display"),
	]
		.filter(Boolean)
		.join(" ");
	return { bodyClassName, cssPaths };
}

async function buildBrowserBundles(stagedRoot: string) {
	const outputDirectory = path.join(stagedRoot, "assets");
	await mkdir(outputDirectory, { recursive: true });
	const result = await build({
		absWorkingDir: process.cwd(),
		bundle: true,
		chunkNames: "chunks/[name]-[hash]",
		entryNames: "[name]-[hash]",
		entryPoints: {
			admin: "src/static/admin-entry.tsx",
			classroom: "src/static/classroom-entry.tsx",
			home: "src/static/home-entry.tsx",
		},
		format: "esm",
		legalComments: "none",
		metafile: true,
		minify: true,
		outdir: outputDirectory,
		platform: "browser",
		publicPath: "/assets",
		sourcemap: false,
		splitting: true,
		target: ["es2022"],
		tsconfig: "tsconfig.json",
		write: true,
	});
	const entries = Object.entries(result.metafile.outputs);
	function entryUrl(entryName: "admin" | "classroom" | "home") {
		const match = entries.find(([, output]) =>
			output.entryPoint?.endsWith(`src/static/${entryName}-entry.tsx`),
		);
		if (!match) throw new Error(`Missing ${entryName} browser bundle`);
		return `/${path.relative(stagedRoot, path.resolve(match[0])).split(path.sep).join("/")}`;
	}
	return {
		admin: entryUrl("admin"),
		classroom: entryUrl("classroom"),
		home: entryUrl("home"),
	};
}

function renderAdminDocument({
	adminBundleUrl,
	bodyClassName,
	bootstrap,
	cssPaths,
	origin,
}: {
	adminBundleUrl: string;
	bodyClassName: string;
	bootstrap: { topicLabels: Record<string, string>; topicOptions: string[] };
	cssPaths: string[];
	origin: string;
}) {
	const body = `<div class="min-h-screen"><header class="border-ink/15 border-b"><div class="mx-auto flex max-w-7xl items-baseline justify-between px-6 py-6 lg:px-10"><a href="/" class="font-serif text-3xl font-semibold">${escapeHtml(messages.site.name)}</a><p class="font-mono text-ink/70 text-xs uppercase tracking-widest">${escapeHtml(messages.admin.eyebrow)}</p></div></header><main class="mx-auto max-w-5xl px-6 py-12 lg:px-10 lg:py-16"><header class="mb-10 max-w-3xl"><p class="font-semibold text-accent text-xs uppercase tracking-[0.2em]">${escapeHtml(messages.admin.eyebrow)}</p><h1 class="mt-4 text-balance font-serif text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">${escapeHtml(messages.admin.title)}</h1><p class="mt-5 text-pretty text-base leading-7 text-ink/75">${escapeHtml(messages.admin.intro)}</p></header><div data-static-admin-root><p role="status" class="text-ink/70">${escapeHtml(messages.admin.review.loading)}</p></div><noscript>${escapeHtml(messages.admin.intro)}</noscript></main></div><script id="static-admin-data" type="application/json">${serializeInlineJson(bootstrap)}</script><script type="module" src="${escapeAttribute(adminBundleUrl)}"></script>`;
	return renderDocument({
		body,
		bodyClassName,
		canonical: `${origin}/admin`,
		cssPaths,
		description: messages.admin.intro,
		robots: "noindex,nofollow",
		title: `${messages.admin.title} | ${messages.site.name}`,
	});
}

function renderHomeDocument({
	bootstrap,
	bodyClassName,
	cssPaths,
	homeBundleUrl,
	origin,
}: {
	bootstrap: ReturnType<typeof createEventExplorerBootstrap>;
	bodyClassName: string;
	cssPaths: string[];
	homeBundleUrl: string;
	origin: string;
}) {
	const explorer = renderToString(<EventExplorer bootstrap={bootstrap} />);
	const body = `<div class="min-h-screen"><header class="border-ink/15 border-b"><div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-10"><a href="/" class="flex min-h-11 shrink-0 items-center font-serif text-2xl font-semibold tracking-[-0.04em]">${escapeHtml(messages.site.name)}</a><a href="/admin" class="text-button inline-flex shrink-0 items-center text-sm">${escapeHtml(messages.home.createActivity)}</a></div></header><main class="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8"><section aria-label="${escapeAttribute(messages.home.events)}"><div data-static-explorer-root>${explorer}</div></section><nav aria-label="${escapeAttribute(messages.archive.title)}" class="mt-10 border-ink/15 border-t pt-6"><a href="/archive" class="text-button inline-flex min-h-11 items-center">${escapeHtml(messages.archive.browseAll)}</a></nav></main></div><script id="static-explorer-data" type="application/json">${serializeInlineJson(bootstrap)}</script><script type="module" src="${escapeAttribute(homeBundleUrl)}"></script>`;
	return renderDocument({
		body,
		bodyClassName,
		canonical: `${origin}/`,
		cssPaths,
		description: messages.site.description,
		title: messages.site.name,
	});
}

function renderArticleDocument({
	bodyClassName,
	cssPaths,
	event,
	origin,
}: {
	bodyClassName: string;
	cssPaths: string[];
	event: Event;
	origin: string;
}) {
	const canonical = `${origin}/events/${event.slug}`;
	const visual = getEventVisual(event.slug);
	const article = renderToStaticMarkup(
		<EventArticle event={event} variant="page" />,
	);
	const body = `<div class="min-h-screen"><header class="border-ink/15 border-b"><div class="mx-auto flex max-w-5xl items-baseline justify-between px-6 py-6 lg:px-10"><a href="/" class="font-serif text-3xl font-semibold tracking-[-0.04em] transition-colors hover:text-accent">${escapeHtml(messages.site.name)}</a><a href="/" class="text-sm text-ink/55 underline-offset-4 hover:text-ink hover:underline">${escapeHtml(messages.event.allEvents)}</a></div></header><main class="mx-auto max-w-5xl px-6 py-14 lg:px-10 lg:py-20">${article}</main></div>`;
	const structuredData = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Article",
				about: event.topics,
				description: event.summary,
				headline: event.title,
				inLanguage: primaryLocale,
				...(visual ? { image: `${origin}${visual.src}` } : {}),
				mainEntityOfPage: canonical,
				url: canonical,
			},
			{
				"@type": "LearningResource",
				description: event.summary,
				educationalUse: event.beat
					? "classroom activity"
					: "background reading",
				inLanguage: primaryLocale,
				isBasedOn: event.sources.map(({ url }) => url),
				name: event.title,
				url: canonical,
			},
		],
	};
	return renderDocument({
		body,
		bodyClassName,
		canonical,
		cssPaths,
		description: event.summary,
		openGraph: {
			description: event.summary,
			...(visual ? { image: `${origin}${visual.src}` } : {}),
			title: event.title,
			type: "article",
			url: canonical,
		},
		structuredData,
		title: `${event.title} | ${messages.site.name}`,
	});
}

function renderClassroomDocument({
	bodyClassName,
	classroomBundleUrl,
	cssPaths,
	event,
	origin,
}: {
	bodyClassName: string;
	classroomBundleUrl: string;
	cssPaths: string[];
	event: Event;
	origin: string;
}) {
	const canonical = `${origin}/events/${event.slug}`;
	let body: string;
	if (event.beat) {
		const playerEvent = {
			beat: event.beat,
			slug: event.slug,
			sources: event.sources,
			title: event.title,
		};
		body = `<div data-static-classroom-root>${renderToString(<BeatPlayer event={playerEvent} />)}</div><script id="static-classroom-data" type="application/json">${serializeInlineJson(playerEvent)}</script><script type="module" src="${escapeAttribute(classroomBundleUrl)}"></script>`;
	} else {
		body = renderToStaticMarkup(
			<main className="classroom-shell flex min-h-screen items-center justify-center px-6 py-8 text-center">
				<section className="w-full max-w-3xl rounded-md border border-ink/20 bg-paper p-8 shadow-[0_24px_90px_rgb(33_31_26_/_12%)] sm:p-12">
					<p className="font-bold text-accent text-sm uppercase tracking-[0.18em]">
						{messages.site.name}
					</p>
					<h1 className="mt-4 text-balance font-serif text-4xl font-medium leading-none sm:text-6xl">
						{event.title}
					</h1>
					<p className="mt-6 text-ink/65 text-lg">
						{messages.beat.unavailable}
					</p>
					<div className="mt-8 flex flex-wrap justify-center gap-5">
						<a
							href={`/events/${event.slug}`}
							className="primary-button flex items-center"
						>
							{messages.beat.article}
						</a>
						<a href="/" className="text-button flex items-center">
							{messages.beat.home}
						</a>
					</div>
				</section>
			</main>,
		);
	}
	return renderDocument({
		body,
		bodyClassName,
		canonical,
		cssPaths,
		description: event.summary,
		robots: "noindex,follow",
		title: `${event.title} | ${messages.site.name}`,
	});
}

async function writeArchiveDocuments({
	bodyClassName,
	cssPaths,
	origin,
	periods,
	stagedRoot,
	topics,
}: {
	bodyClassName: string;
	cssPaths: string[];
	origin: string;
	periods: PeriodArchive[];
	stagedRoot: string;
	topics: TopicArchive[];
}) {
	const index = (
		<EventArchiveShell title={messages.archive.title}>
			<p className="mt-4 max-w-2xl text-ink/65 leading-7">
				{messages.archive.intro}
			</p>
			<div className="mt-10 grid gap-10 md:grid-cols-2">
				<ArchiveLinks id="archive-periods" title={messages.archive.periods}>
					{periods.map((period) => (
						<a
							key={period.id}
							href={`/archive/periods/${period.id}`}
							className="inline-flex min-h-11 items-center text-button"
						>
							{formatSignedYear(period.minimumYear)}–
							{formatSignedYear(period.maximumYear)}
						</a>
					))}
				</ArchiveLinks>
				<ArchiveLinks id="archive-topics" title={messages.archive.topics}>
					{topics.map((topic) => (
						<a
							key={topic.id}
							href={`/archive/topics/${topic.id}`}
							className="inline-flex min-h-11 items-center text-button"
						>
							{topic.label}
						</a>
					))}
				</ArchiveLinks>
			</div>
		</EventArchiveShell>
	);
	await writeSiteFile(
		stagedRoot,
		"archive.html",
		renderArchiveDocument(
			index,
			messages.archive.title,
			"/archive",
			cssPaths,
			bodyClassName,
			origin,
		),
	);
	for (const period of periods) {
		const title = `${formatSignedYear(period.minimumYear)}–${formatSignedYear(period.maximumYear)}`;
		await writeSiteFile(
			stagedRoot,
			`archive/periods/${period.id}.html`,
			renderArchiveDocument(
				<EventArchiveShell title={title}>
					<EventArchiveList events={period.events} />
				</EventArchiveShell>,
				title,
				`/archive/periods/${period.id}`,
				cssPaths,
				bodyClassName,
				origin,
			),
		);
	}
	for (const topic of topics) {
		await writeSiteFile(
			stagedRoot,
			`archive/topics/${topic.id}.html`,
			renderArchiveDocument(
				<EventArchiveShell title={topic.label}>
					<EventArchiveList events={topic.events} />
				</EventArchiveShell>,
				topic.label,
				`/archive/topics/${topic.id}`,
				cssPaths,
				bodyClassName,
				origin,
			),
		);
	}
}

function ArchiveLinks({
	children,
	id,
	title,
}: {
	children: ReactNode;
	id: string;
	title: string;
}) {
	return (
		<section aria-labelledby={id}>
			<h2 id={id} className="font-serif text-2xl font-semibold">
				{title}
			</h2>
			<div className="mt-3 grid gap-1">{children}</div>
		</section>
	);
}

function renderArchiveDocument(
	content: ReactNode,
	title: string,
	pathname: string,
	cssPaths: string[],
	bodyClassName: string,
	origin: string,
) {
	return renderDocument({
		body: renderToStaticMarkup(content),
		bodyClassName,
		canonical: `${origin}${pathname}`,
		cssPaths,
		description: messages.archive.intro,
		title: `${title} | ${messages.site.name}`,
	});
}

function renderNotFoundDocument(
	cssPaths: string[],
	bodyClassName: string,
	origin: string,
) {
	const body = renderToStaticMarkup(
		<main className="flex min-h-screen items-center justify-center px-6 text-center">
			<section>
				<p className="font-bold text-accent text-sm uppercase tracking-[0.18em]">
					404
				</p>
				<h1 className="mt-4 font-serif text-5xl font-semibold">
					{messages.event.notFound}
				</h1>
				<a href="/" className="primary-button mt-8">
					{messages.beat.home}
				</a>
			</section>
		</main>,
	);
	return renderDocument({
		body,
		bodyClassName,
		canonical: `${origin}/404`,
		cssPaths,
		description: messages.site.description,
		robots: "noindex,follow",
		title: `${messages.event.notFound} | ${messages.site.name}`,
	});
}

function renderDocument({
	body,
	bodyClassName,
	canonical,
	cssPaths,
	description,
	openGraph,
	robots,
	structuredData,
	title,
}: {
	body: string;
	bodyClassName: string;
	canonical: string;
	cssPaths: string[];
	description: string;
	openGraph?: {
		description: string;
		image?: string;
		title: string;
		type: string;
		url: string;
	};
	robots?: string;
	structuredData?: unknown;
	title: string;
}) {
	const head = [
		'<meta charset="utf-8">',
		'<meta name="viewport" content="width=device-width, initial-scale=1">',
		`<title>${escapeHtml(title)}</title>`,
		`<meta name="description" content="${escapeAttribute(description)}">`,
		`<link rel="canonical" href="${escapeAttribute(canonical)}">`,
		'<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
		...cssPaths.map(
			(cssPath) => `<link rel="stylesheet" href="${escapeAttribute(cssPath)}">`,
		),
		...(robots
			? [`<meta name="robots" content="${escapeAttribute(robots)}">`]
			: []),
		...(openGraph
			? [
					`<meta property="og:type" content="${escapeAttribute(openGraph.type)}">`,
					`<meta property="og:title" content="${escapeAttribute(openGraph.title)}">`,
					`<meta property="og:description" content="${escapeAttribute(openGraph.description)}">`,
					`<meta property="og:url" content="${escapeAttribute(openGraph.url)}">`,
					...(openGraph.image
						? [
								`<meta property="og:image" content="${escapeAttribute(openGraph.image)}">`,
							]
						: []),
				]
			: []),
		...(structuredData
			? [
					`<script type="application/ld+json">${serializeInlineJson(structuredData)}</script>`,
				]
			: []),
	].join("");
	return `<!doctype html><html lang="${primaryLocale}"><head>${head}</head><body class="${escapeAttribute(bodyClassName)}">${body}</body></html>\n`;
}

function renderSitemap(origin: string, paths: string[]) {
	const unique = [...new Set(paths)].sort();
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map((pathname) => `  <url><loc>${escapeXml(`${origin}${pathname}`)}</loc></url>`).join("\n")}\n</urlset>\n`;
}

async function writeSiteFile(
	root: string,
	relativePath: string,
	contents: string,
) {
	if (
		path.posix.normalize(relativePath) !== relativePath ||
		path.isAbsolute(relativePath)
	) {
		throw new Error(`Unsafe static output path: ${relativePath}`);
	}
	const target = path.join(root, ...relativePath.split("/"));
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, contents, { flag: "wx" });
}

async function copyPublicAsset(
	publicRoot: string,
	stagedRoot: string,
	publicPath: string,
) {
	if (!publicPath.startsWith("/") || publicPath.includes("\\")) {
		throw new Error(`Invalid public asset path: ${publicPath}`);
	}
	const relative = publicPath.slice(1);
	if (!relative || path.posix.normalize(relative) !== relative) {
		throw new Error(`Unsafe public asset path: ${publicPath}`);
	}
	const source = path.join(publicRoot, ...relative.split("/"));
	await requireRealPathComponents(publicRoot, relative);
	const resolvedSource = await realpath(source);
	if (!isInside(publicRoot, resolvedSource)) {
		throw new Error(`Public asset escapes trusted root: ${publicPath}`);
	}
	await copyRealFile(source, path.join(stagedRoot, ...relative.split("/")));
}

async function copyRealFile(source: string, destination: string) {
	const metadata = await lstat(source);
	if (metadata.isSymbolicLink() || !metadata.isFile()) {
		throw new Error(`Static asset source must be a real file: ${source}`);
	}
	await mkdir(path.dirname(destination), { recursive: true });
	await copyFile(source, destination, 1);
}

async function readRealDirectory(directory: string, label: string) {
	await requireRealDirectory(directory, label);
	const entries = await readdir(directory, { withFileTypes: true });
	if (entries.some((entry) => entry.isSymbolicLink())) {
		throw new Error(`${label} cannot contain symbolic links`);
	}
	return entries.filter((entry) => entry.isFile()).map(({ name }) => name);
}

async function requireRealPathComponents(root: string, relative: string) {
	let current = root;
	for (const component of relative.split("/")) {
		current = path.join(current, component);
		const metadata = await lstat(current);
		if (metadata.isSymbolicLink()) {
			throw new Error(`Public asset path contains symbolic link: ${relative}`);
		}
	}
}

function isInside(root: string, target: string) {
	const relative = path.relative(root, target);
	return (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	);
}

async function requireRealDirectory(
	target: string,
	label: string,
): Promise<string> {
	const metadata = await lstat(target);
	if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
		throw new Error(`${label} must be a real directory`);
	}
	return realpath(target);
}

async function requireOptionalRealDirectory(target: string, label: string) {
	try {
		await requireRealDirectory(target, label);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}
}

function findFontVariableClass(css: string, variable: "body" | "display") {
	const match = new RegExp(`\\.([A-Za-z0-9_-]+)\\{--font-${variable}:`).exec(
		css,
	);
	return match?.[1] ?? "";
}

function requireOrigin(value: string) {
	const url = new URL(value);
	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		url.pathname !== "/" ||
		url.search ||
		url.hash
	) {
		throw new Error("Static site origin must be an HTTPS origin without path");
	}
	return url.origin;
}

function serializeInlineJson(value: unknown) {
	return JSON.stringify(value)
		.replaceAll("&", "\\u0026")
		.replaceAll("<", "\\u003c")
		.replaceAll(">", "\\u003e")
		.replaceAll("\u2028", "\\u2028")
		.replaceAll("\u2029", "\\u2029");
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function escapeAttribute(value: string) {
	return escapeHtml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function escapeXml(value: string) {
	return escapeAttribute(value);
}

function formatSignedYear(year: number): string {
	return year < 0
		? `${formatNumber(Math.abs(year))} ${historicalDateMessages.beforeCommonEra}`
		: `${formatNumber(year)} ${historicalDateMessages.afterCommonEra}`;
}
