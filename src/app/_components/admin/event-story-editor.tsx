"use client";

import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
	INSERT_ORDERED_LIST_COMMAND,
	INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import {
	$convertFromMarkdownString,
	$convertToMarkdownString,
} from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
	$getSelection,
	$isRangeSelection,
	FORMAT_TEXT_COMMAND,
	type LexicalEditor,
} from "lexical";
import { useEffect, useRef, useState } from "react";
import {
	eventEditorNodes,
	eventMarkdownTransformers,
	isSafeEditorLink,
} from "@/lib/content/editor-markdown";
import { messages } from "@/lib/i18n/messages.nl-BE";

export function EventStoryEditor({
	error,
	onChange,
	value,
}: {
	error?: string;
	onChange: (markdown: string) => void;
	value: string;
}) {
	return (
		<div>
			<LexicalComposer
				initialConfig={{
					namespace: "toen-event-story",
					nodes: eventEditorNodes,
					onError: (editorError) => {
						throw editorError;
					},
					theme: {
						heading: { h2: "editor-heading", h3: "editor-subheading" },
						list: {
							listitem: "editor-list-item",
							ol: "editor-list",
							ul: "editor-list",
						},
						quote: "editor-quote",
						text: { bold: "font-bold", italic: "italic" },
					},
				}}
			>
				<div
					className={`overflow-hidden rounded-md border bg-white ${error ? "border-accent" : "border-ink/55"}`}
				>
					<EditorToolbar />
					<div className="relative">
						<RichTextPlugin
							contentEditable={
								<ContentEditable
									aria-describedby={
										error ? "body-hint body-error" : "body-hint"
									}
									aria-invalid={error ? "true" : undefined}
									aria-required="true"
									aria-label={messages.admin.fields.story}
									id="body"
									className="editor-input min-h-72 px-5 py-5 text-base leading-7"
								/>
							}
							placeholder={
								<p className="pointer-events-none absolute top-5 left-5 text-ink/70">
									{messages.admin.editor.placeholder}
								</p>
							}
							ErrorBoundary={({ children }) => children}
						/>
					</div>
					<HistoryPlugin />
					<ListPlugin />
					<LinkPlugin />
					<MarkdownShortcutPlugin transformers={eventMarkdownTransformers} />
					<MarkdownValuePlugin onChange={onChange} value={value} />
				</div>
			</LexicalComposer>
			<p id="body-hint" className="mt-2 text-sm leading-6 text-ink/70">
				{messages.admin.editor.hint}
			</p>
			{error ? (
				<p id="body-error" className="mt-2 font-semibold text-accent text-sm">
					<span className="sr-only">{messages.admin.errorPrefix} </span>
					{error}
				</p>
			) : null}
		</div>
	);
}

function EditorToolbar() {
	const [editor] = useLexicalComposerContext();
	const [linkOpen, setLinkOpen] = useState(false);
	const [activeFormats, setActiveFormats] = useState({
		bold: false,
		italic: false,
	});
	const [linkUrl, setLinkUrl] = useState("");
	const [linkError, setLinkError] = useState<string | null>(null);
	const linkInput = useRef<HTMLInputElement>(null);
	const linkTrigger = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (linkOpen) linkInput.current?.focus();
	}, [linkOpen]);

	useEffect(
		() =>
			editor.registerUpdateListener(({ editorState }) => {
				editorState.read(() => {
					const selection = $getSelection();
					setActiveFormats({
						bold: $isRangeSelection(selection) && selection.hasFormat("bold"),
						italic:
							$isRangeSelection(selection) && selection.hasFormat("italic"),
					});
				});
			}),
		[editor],
	);

	function closeLink() {
		setLinkOpen(false);
		setLinkUrl("");
		setLinkError(null);
		requestAnimationFrame(() => linkTrigger.current?.focus());
	}

	function applyLink() {
		const url = linkUrl.trim();
		if (!isSafeEditorLink(url)) {
			setLinkError(messages.admin.editor.invalidLink);
			linkInput.current?.focus();
			return;
		}
		editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
		closeLink();
	}

	return (
		<div className="relative border-ink/20 border-b bg-paper/60">
			<fieldset className="flex flex-wrap gap-1 p-2">
				<legend className="sr-only">{messages.admin.editor.formatting}</legend>
				<ToolbarButton
					label={messages.admin.editor.bold}
					pressed={activeFormats.bold}
					onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
				>
					B
				</ToolbarButton>
				<ToolbarButton
					label={messages.admin.editor.italic}
					pressed={activeFormats.italic}
					onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
				>
					<em>I</em>
				</ToolbarButton>
				<ToolbarButton
					label={messages.admin.editor.heading}
					onClick={() => setBlock(editor, "heading")}
				>
					H2
				</ToolbarButton>
				<ToolbarButton
					label={messages.admin.editor.subheading}
					onClick={() => setBlock(editor, "subheading")}
				>
					H3
				</ToolbarButton>
				<ToolbarButton
					label={messages.admin.editor.unorderedList}
					onClick={() =>
						editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
					}
				>
					• {messages.admin.editor.unorderedList}
				</ToolbarButton>
				<ToolbarButton
					label={messages.admin.editor.orderedList}
					onClick={() =>
						editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
					}
				>
					1. {messages.admin.editor.orderedList}
				</ToolbarButton>
				<ToolbarButton
					label={messages.admin.editor.quote}
					onClick={() => setBlock(editor, "quote")}
				>
					{messages.admin.editor.quote}
				</ToolbarButton>
				<ToolbarButton
					buttonRef={linkTrigger}
					label={messages.admin.editor.link}
					onClick={() => setLinkOpen(true)}
				>
					{messages.admin.editor.link}
				</ToolbarButton>
			</fieldset>
			{linkOpen ? (
				<div
					role="dialog"
					aria-labelledby="link-dialog-title"
					aria-modal="false"
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							event.preventDefault();
							closeLink();
						}
					}}
					className="border-ink/20 border-t bg-white p-4"
				>
					<h3
						id="link-dialog-title"
						className="font-serif text-xl font-semibold"
					>
						{messages.admin.editor.linkDialog}
					</h3>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							applyLink();
						}}
						className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
					>
						<label
							htmlFor="story-link-url"
							className="min-w-0 flex-1 font-semibold text-sm"
						>
							{messages.admin.editor.url}
							<input
								ref={linkInput}
								id="story-link-url"
								type="url"
								value={linkUrl}
								onChange={(event) => {
									setLinkUrl(event.target.value);
									setLinkError(null);
								}}
								aria-invalid={linkError ? "true" : undefined}
								aria-describedby={linkError ? "story-link-error" : undefined}
								placeholder={messages.admin.fields.sourceUrlPlaceholder}
								className="mt-2 min-h-11 w-full rounded-sm border border-ink/55 px-3 text-base"
							/>
							{linkError ? (
								<span
									id="story-link-error"
									role="alert"
									className="mt-2 block font-semibold text-accent text-sm"
								>
									{linkError}
								</span>
							) : null}
						</label>
						<div className="flex gap-2">
							<button type="submit" className="primary-button">
								{messages.admin.editor.linkDialog}
							</button>
							<button
								type="button"
								onClick={closeLink}
								className="secondary-button"
							>
								{messages.admin.editor.cancel}
							</button>
						</div>
					</form>
				</div>
			) : null}
		</div>
	);
}

function ToolbarButton({
	buttonRef,
	children,
	label,
	onClick,
	pressed,
}: {
	buttonRef?: React.Ref<HTMLButtonElement>;
	children: React.ReactNode;
	label: string;
	onClick: () => void;
	pressed?: boolean;
}) {
	return (
		<button
			ref={buttonRef}
			type="button"
			aria-label={label}
			aria-pressed={pressed}
			onClick={onClick}
			className="min-h-10 rounded-sm px-3 font-semibold text-sm hover:bg-ink/10"
		>
			{children}
		</button>
	);
}

function setBlock(
	editor: LexicalEditor,
	type: "heading" | "subheading" | "quote",
) {
	editor.update(() => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) return;
		$setBlocksType(selection, () =>
			type === "quote"
				? $createQuoteNode()
				: $createHeadingNode(type === "heading" ? "h2" : "h3"),
		);
	});
}

function MarkdownValuePlugin({
	onChange,
	value,
}: {
	onChange: (markdown: string) => void;
	value: string;
}) {
	const [editor] = useLexicalComposerContext();
	const valueRef = useRef(value);
	valueRef.current = value;

	useEffect(() => {
		const current = editor
			.getEditorState()
			.read(() => $convertToMarkdownString(eventMarkdownTransformers));
		if (current === value) return;
		editor.update(
			() => $convertFromMarkdownString(value, eventMarkdownTransformers),
			{ discrete: true },
		);
	}, [editor, value]);

	return (
		<OnChangePlugin
			onChange={(editorState) => {
				const markdown = editorState.read(() =>
					$convertToMarkdownString(eventMarkdownTransformers),
				);
				if (markdown === valueRef.current) return;
				onChange(markdown);
			}}
		/>
	);
}
