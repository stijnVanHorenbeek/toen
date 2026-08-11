"use client";

import { useRef, useState } from "react";
import {
	buildChatGptPrompt,
	CHATGPT_ACTIVE_REQUEST_STORAGE_KEY,
	CHATGPT_PROMPT_VERSION,
	type ChatGptPromptInput,
	createChatGptRequestId,
} from "@/lib/admin/chatgpt-prompt";
import { beatResponseMethods } from "@/lib/content/event";
import { vakrichtingIds } from "@/lib/content/taxonomy";
import { formatVakrichting } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";

const inputClass =
	"min-h-12 w-full rounded-md border border-ink/55 bg-white px-4 text-base text-ink focus:border-accent";
const initialInput: ChatGptPromptInput = {
	topic: "",
	lessonContext: "",
	durationMinutes: 8,
	mechanic: "choose",
	responseMethod: "choose",
	profile: "algemeen",
};

type GeneratedInstructions = { requestId: string; text: string };
type CopyState = "idle" | "copied" | "manual";

export function ChatGptPromptHandoff() {
	const [input, setInput] = useState<ChatGptPromptInput>(initialInput);
	const [generated, setGenerated] = useState<GeneratedInstructions | null>(
		null,
	);
	const [copyState, setCopyState] = useState<CopyState>("idle");
	const [topicError, setTopicError] = useState<string | null>(null);
	const topicInput = useRef<HTMLInputElement>(null);
	const copyButton = useRef<HTMLButtonElement>(null);
	const manualInstructions = useRef<HTMLTextAreaElement>(null);

	function update<Key extends keyof ChatGptPromptInput>(
		field: Key,
		value: ChatGptPromptInput[Key],
	) {
		setInput((current) => ({ ...current, [field]: value }));
		if (field === "topic" && String(value).trim()) setTopicError(null);
		if (generated) {
			setGenerated(null);
			setCopyState("idle");
			forgetActiveRequest();
		}
	}

	function makeInstructions() {
		if (!input.topic.trim()) {
			setTopicError(messages.admin.chatGpt.topicError);
			requestAnimationFrame(() => topicInput.current?.focus());
			return;
		}
		const requestId = createChatGptRequestId();
		const text = buildChatGptPrompt(input, requestId);
		setTopicError(null);
		setGenerated({ requestId, text });
		setCopyState("idle");
		rememberActiveRequest(requestId);
		requestAnimationFrame(() => copyButton.current?.focus());
	}

	async function copyInstructions() {
		if (!generated) return;
		try {
			if (!navigator.clipboard?.writeText)
				throw new Error("clipboard unavailable");
			await navigator.clipboard.writeText(generated.text);
			setCopyState("copied");
		} catch {
			setCopyState("manual");
			requestAnimationFrame(() => {
				manualInstructions.current?.focus();
				manualInstructions.current?.select();
			});
		}
	}

	function selectManualInstructions() {
		manualInstructions.current?.focus();
		manualInstructions.current?.select();
	}

	return (
		<details className="mb-10 rounded-md border border-ink/25 bg-white p-5 sm:p-7">
			<summary
				id="chatgpt-handoff-title"
				className="cursor-pointer font-serif text-2xl font-semibold"
			>
				{messages.admin.chatGpt.title}
			</summary>
			<div className="mt-4">
				<p className="max-w-2xl text-ink/75">{messages.admin.chatGpt.intro}</p>

				<form
					noValidate
					className="mt-6 space-y-5"
					onSubmit={(event) => {
						event.preventDefault();
						makeInstructions();
					}}
				>
					<label className="block font-semibold" htmlFor="chatgpt-topic">
						{messages.admin.chatGpt.topic}
						<input
							ref={topicInput}
							id="chatgpt-topic"
							required
							maxLength={160}
							autoComplete="off"
							value={input.topic}
							onChange={(event) => update("topic", event.target.value)}
							aria-invalid={topicError ? "true" : undefined}
							aria-describedby={topicError ? "chatgpt-topic-error" : undefined}
							className={`${inputClass} mt-2 font-normal`}
						/>
					</label>
					{topicError ? (
						<p id="chatgpt-topic-error" className="mt-2 text-red-800 text-sm">
							{topicError}
						</p>
					) : null}

					<label className="block font-semibold" htmlFor="chatgpt-context">
						{messages.admin.chatGpt.context}
						<textarea
							id="chatgpt-context"
							rows={3}
							maxLength={300}
							value={input.lessonContext}
							onChange={(event) => update("lessonContext", event.target.value)}
							className={`${inputClass} mt-2 resize-y py-3 font-normal`}
						/>
					</label>

					<div className="grid gap-5 sm:grid-cols-2">
						<label className="block font-semibold" htmlFor="chatgpt-duration">
							{messages.admin.chatGpt.duration}
							<select
								id="chatgpt-duration"
								value={input.durationMinutes}
								onChange={(event) =>
									update(
										"durationMinutes",
										Number(event.target.value) as 5 | 8 | 12,
									)
								}
								className={`${inputClass} mt-2 font-normal`}
							>
								{([5, 8, 12] as const).map((duration) => (
									<option key={duration} value={duration}>
										{duration} minuten
									</option>
								))}
							</select>
						</label>

						<label className="block font-semibold" htmlFor="chatgpt-profile">
							{messages.admin.chatGpt.profile}
							<select
								id="chatgpt-profile"
								value={input.profile}
								onChange={(event) =>
									update("profile", event.target.value as typeof input.profile)
								}
								className={`${inputClass} mt-2 font-normal`}
							>
								{vakrichtingIds.map((profile) => (
									<option key={profile} value={profile}>
										{formatVakrichting(profile)}
									</option>
								))}
							</select>
						</label>

						<label className="block font-semibold" htmlFor="chatgpt-mechanic">
							{messages.admin.chatGpt.mechanic}
							<select
								id="chatgpt-mechanic"
								value={input.mechanic}
								onChange={(event) =>
									update(
										"mechanic",
										event.target.value as typeof input.mechanic,
									)
								}
								className={`${inputClass} mt-2 font-normal`}
							>
								<option value="choose">
									{messages.admin.chatGpt.chooseMechanic}
								</option>
								{(
									["vote-revote", "source-duel", "context-decision"] as const
								).map((mechanic) => (
									<option key={mechanic} value={mechanic}>
										{messages.admin.fields.mechanicOptions[mechanic]}
									</option>
								))}
							</select>
						</label>

						<label
							className="block font-semibold"
							htmlFor="chatgpt-response-method"
						>
							{messages.admin.chatGpt.responseMethod}
							<select
								id="chatgpt-response-method"
								value={input.responseMethod}
								onChange={(event) =>
									update(
										"responseMethod",
										event.target.value as typeof input.responseMethod,
									)
								}
								className={`${inputClass} mt-2 font-normal`}
							>
								<option value="choose">
									{messages.admin.chatGpt.chooseResponseMethod}
								</option>
								{beatResponseMethods.map((method) => (
									<option key={method} value={method}>
										{messages.admin.fields.responseMethods[method]}
									</option>
								))}
							</select>
						</label>
					</div>

					<div className="rounded-md bg-paper p-4 text-sm leading-6 text-ink/80">
						<p>{messages.admin.chatGpt.privacy}</p>
						<a
							href="https://openai.com/policies/privacy-policy/"
							target="_blank"
							rel="noreferrer"
							className="mt-2 inline-block font-semibold text-accent underline underline-offset-4"
						>
							{messages.admin.chatGpt.privacyLink}
						</a>
					</div>

					{generated ? (
						<div className="flex flex-wrap gap-3">
							<button
								ref={copyButton}
								type="button"
								onClick={copyInstructions}
								className="primary-button"
							>
								{messages.admin.chatGpt.copy}
							</button>
							<button type="submit" className="secondary-button">
								{messages.admin.chatGpt.remake}
							</button>
						</div>
					) : (
						<button type="submit" className="secondary-button">
							{messages.admin.chatGpt.make}
						</button>
					)}
				</form>

				<p
					role="status"
					aria-live="polite"
					className="mt-4 text-sm text-ink/75"
				>
					{generated && copyState === "idle"
						? messages.admin.chatGpt.ready
						: copyState === "copied"
							? messages.admin.chatGpt.copied
							: copyState === "manual"
								? messages.admin.chatGpt.manual
								: ""}
				</p>

				{generated && copyState === "manual" ? (
					<div className="mt-4">
						<label
							className="block font-semibold"
							htmlFor="chatgpt-manual-instructions"
						>
							{messages.admin.chatGpt.manualLabel}
						</label>
						<textarea
							ref={manualInstructions}
							id="chatgpt-manual-instructions"
							readOnly
							rows={10}
							value={generated.text}
							className={`${inputClass} mt-2 resize-y py-3 font-mono text-xs`}
						/>
						<button
							type="button"
							onClick={selectManualInstructions}
							className="secondary-button mt-3"
						>
							{messages.admin.chatGpt.selectAll}
						</button>
					</div>
				) : null}

				{copyState === "copied" || copyState === "manual" ? (
					<a
						href="https://chatgpt.com/"
						target="_blank"
						rel="noreferrer"
						className="primary-button mt-4 inline-flex items-center"
					>
						{messages.admin.chatGpt.openChatGpt}
					</a>
				) : null}
			</div>
		</details>
	);
}

function rememberActiveRequest(requestId: string) {
	try {
		sessionStorage.setItem(
			CHATGPT_ACTIVE_REQUEST_STORAGE_KEY,
			JSON.stringify({ formatVersion: CHATGPT_PROMPT_VERSION, requestId }),
		);
	} catch {
		// Same-tab copy and paste still works when browser storage is unavailable.
	}
}

function forgetActiveRequest() {
	try {
		sessionStorage.removeItem(CHATGPT_ACTIVE_REQUEST_STORAGE_KEY);
	} catch {
		// Editing still invalidates the visible instructions for this session.
	}
}
