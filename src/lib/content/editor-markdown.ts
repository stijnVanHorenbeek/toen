import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
	$convertFromMarkdownString,
	$convertToMarkdownString,
	BOLD_ITALIC_STAR,
	BOLD_STAR,
	HEADING,
	ITALIC_STAR,
	LINK,
	ORDERED_LIST,
	QUOTE,
	type Transformer,
	UNORDERED_LIST,
} from "@lexical/markdown";
import { $isHeadingNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot, createEditor } from "lexical";
import { fromMarkdown } from "mdast-util-from-markdown";

const EVENT_HEADING = { ...HEADING, regExp: /^(#{2,3})\s/ };

export const eventMarkdownTransformers: Transformer[] = [
	EVENT_HEADING,
	QUOTE,
	UNORDERED_LIST,
	ORDERED_LIST,
	BOLD_ITALIC_STAR,
	BOLD_STAR,
	ITALIC_STAR,
	LINK,
];

export const eventEditorNodes = [
	HeadingNode,
	QuoteNode,
	ListNode,
	ListItemNode,
	LinkNode,
];

function createMarkdownEditor(markdown: string) {
	const editor = createEditor({ nodes: eventEditorNodes });
	editor.update(
		() => $convertFromMarkdownString(markdown, eventMarkdownTransformers),
		{ discrete: true },
	);
	return editor;
}

export function normalizeEditorMarkdown(markdown: string): string {
	return createMarkdownEditor(markdown)
		.getEditorState()
		.read(() => `${$convertToMarkdownString(eventMarkdownTransformers)}\n`);
}

export function isSafeEditorLink(value: string): boolean {
	if (!URL.canParse(value)) return false;
	const protocol = new URL(value).protocol;
	return protocol === "http:" || protocol === "https:";
}

export function isSupportedEditorMarkdown(markdown: string): boolean {
	const result = inspectMarkdown(fromMarkdown(markdown), markdown);
	if (!result.supported) return false;
	return (
		!result.hasHardBreak ||
		normalizeEditorMarkdown(markdown).trimEnd() === markdown.trimEnd()
	);
}

type MarkdownNode =
	| ReturnType<typeof fromMarkdown>
	| ReturnType<typeof fromMarkdown>["children"][number];

function inspectMarkdown(
	root: MarkdownNode,
	markdown: string,
): {
	supported: boolean;
	hasHardBreak: boolean;
} {
	const nodes: Array<{ node: MarkdownNode; depth: number }> = [
		{ node: root, depth: 0 },
	];
	let hasHardBreak = false;

	while (nodes.length > 0) {
		const current = nodes.pop();
		if (!current || current.depth > 100) {
			return { supported: false, hasHardBreak };
		}
		const { node } = current;
		if (node.type === "heading" && node.depth !== 2 && node.depth !== 3) {
			return { supported: false, hasHardBreak };
		}
		if (
			node.type === "link" &&
			(node.title !== null || !isSafeEditorLink(node.url))
		) {
			return { supported: false, hasHardBreak };
		}
		if (node.type === "break") {
			const start = node.position?.start.offset;
			const end = node.position?.end.offset;
			if (
				typeof start !== "number" ||
				typeof end !== "number" ||
				markdown.slice(start, end) !== "  \n"
			) {
				return { supported: false, hasHardBreak };
			}
			hasHardBreak = true;
		}
		if (
			![
				"root",
				"paragraph",
				"text",
				"heading",
				"strong",
				"emphasis",
				"list",
				"listItem",
				"blockquote",
				"link",
				"break",
			].includes(node.type)
		) {
			return { supported: false, hasHardBreak };
		}
		if ("children" in node) {
			for (const child of node.children) {
				nodes.push({ node: child, depth: current.depth + 1 });
			}
		}
	}

	return { supported: true, hasHardBreak };
}

export function getEditorHeadingTags(markdown: string): string[] {
	return createMarkdownEditor(markdown)
		.getEditorState()
		.read(() =>
			$getRoot()
				.getChildren()
				.filter($isHeadingNode)
				.map((node) => node.getTag()),
		);
}
