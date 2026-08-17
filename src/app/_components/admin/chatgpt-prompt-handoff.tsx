"use client";

import { useEffect, useRef, useState } from "react";
import {
	buildChatGptPrompt,
	CHATGPT_ACTIVE_REQUEST_STORAGE_KEY,
	CHATGPT_PROMPT_VERSION,
	type ChatGptPromptInput,
	createChatGptRequestId,
} from "@/lib/admin/chatgpt-prompt";
import {
	type ChatGptImportResult,
	parseActiveChatGptRequest,
	parseChatGptResponse,
} from "@/lib/admin/chatgpt-response";
import { beatResponseMethods } from "@/lib/content/event";
import { vakrichtingIds } from "@/lib/content/taxonomy";
import { formatVakrichting } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { useEventAuthoring } from "./event-authoring-context";
import { Field, inputClass } from "./form-controls";

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
type HandoffStep = 1 | 2 | 3;
type ImportState =
	| Exclude<ChatGptImportResult, { kind: "ready" }>
	| { kind: "applied" }
	| { kind: "blocked" };

export function ChatGptPromptHandoff() {
	const { actions } = useEventAuthoring();
	const [input, setInput] = useState<ChatGptPromptInput>(initialInput);
	const [generated, setGenerated] = useState<GeneratedInstructions | null>(
		null,
	);
	const [copyState, setCopyState] = useState<CopyState>("idle");
	const [topicError, setTopicError] = useState<string | null>(null);
	const [pastedResponse, setPastedResponse] = useState("");
	const [importState, setImportState] = useState<ImportState | null>(null);
	const [repairCopyState, setRepairCopyState] = useState<CopyState>("idle");
	const [currentStep, setCurrentStep] = useState<HandoffStep>(1);
	const topicInput = useRef<HTMLInputElement>(null);
	const copyButton = useRef<HTMLButtonElement>(null);
	const openChatGptLink = useRef<HTMLAnchorElement>(null);
	const manualInstructions = useRef<HTMLTextAreaElement>(null);
	const importFeedback = useRef<HTMLDivElement>(null);
	const manualRepair = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (readActiveRequest()) setCurrentStep(3);
	}, []);

	function showStep(step: HandoffStep) {
		setCurrentStep(step);
		requestAnimationFrame(() => {
			const target =
				step === 3
					? document.getElementById("chatgpt-response")
					: document.getElementById(`chatgpt-step-${step}-title`);
			target?.focus();
		});
	}

	function update<Key extends keyof ChatGptPromptInput>(
		field: Key,
		value: ChatGptPromptInput[Key],
	) {
		setInput((current) => ({ ...current, [field]: value }));
		if (field === "topic" && String(value).trim()) setTopicError(null);
		if (generated) setGenerated(null);
		setCopyState("idle");
		setImportState(null);
		setRepairCopyState("idle");
		setCurrentStep(1);
		forgetActiveRequest();
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
		setImportState(null);
		setRepairCopyState("idle");
		setCurrentStep(2);
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
			setCurrentStep(3);
			requestAnimationFrame(() => openChatGptLink.current?.focus());
		} catch {
			setCopyState("manual");
			setCurrentStep(3);
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

	function checkAndApplyResponse() {
		const activeRequest = generated
			? {
					formatVersion: CHATGPT_PROMPT_VERSION,
					requestId: generated.requestId,
				}
			: readActiveRequest();
		const result = parseChatGptResponse(pastedResponse, activeRequest);
		setRepairCopyState("idle");
		if (result.kind === "ready") {
			if (
				actions.applyImportedDraft({
					draft: result.draft,
					claims: result.claims,
					requestId: result.requestId,
				})
			) {
				setImportState({ kind: "applied" });
				setGenerated(null);
				setCopyState("idle");
				forgetActiveRequest();
				requestAnimationFrame(() => document.getElementById("title")?.focus());
				return;
			}
			setImportState({ kind: "blocked" });
		} else {
			setImportState(result);
		}
		requestAnimationFrame(() => importFeedback.current?.focus());
	}

	async function copyRepairInstructions() {
		const repairPrompt = currentRepairPrompt(importState);
		if (!repairPrompt) return;
		try {
			if (!navigator.clipboard?.writeText)
				throw new Error("clipboard unavailable");
			await navigator.clipboard.writeText(repairPrompt);
			setRepairCopyState("copied");
		} catch {
			setRepairCopyState("manual");
			requestAnimationFrame(() => {
				manualRepair.current?.focus();
				manualRepair.current?.select();
			});
		}
	}

	const repairPrompt = currentRepairPrompt(importState);

	return (
		<details
			data-passive-group="chatgpt"
			className="passive-group mb-10 sm:p-7"
		>
			<summary
				id="chatgpt-handoff-title"
				className="cursor-pointer font-serif text-2xl font-semibold"
			>
				{messages.admin.chatGpt.title}
			</summary>
			<div className="mt-4">
				<p className="max-w-2xl text-ink/75">{messages.admin.chatGpt.intro}</p>
				<ol
					aria-label={messages.admin.chatGpt.steps}
					className="mt-6 grid gap-2 sm:grid-cols-3"
				>
					{messages.admin.chatGpt.stepLabels.map((label, index) => {
						const step = (index + 1) as HandoffStep;
						return (
							<li key={label}>
								<h3
									id={`chatgpt-step-${step}-title`}
									tabIndex={-1}
									aria-current={currentStep === step ? "step" : undefined}
									className={`rounded-md px-3 py-3 text-sm ${
										currentStep === step
											? "bg-accent font-semibold text-white"
											: step < currentStep
												? "bg-paper text-ink"
												: "border border-ink/20 text-ink/60"
									}`}
								>
									{step}. {label}
								</h3>
							</li>
						);
					})}
				</ol>

				{currentStep === 1 ? (
					<form
						noValidate
						className="mt-6 space-y-5"
						onSubmit={(event) => {
							event.preventDefault();
							makeInstructions();
						}}
					>
						<Field
							label={messages.admin.chatGpt.topic}
							name="chatgpt-topic"
							error={topicError ?? undefined}
						>
							<input
								ref={topicInput}
								id="chatgpt-topic"
								required
								maxLength={160}
								autoComplete="off"
								value={input.topic}
								onChange={(event) => update("topic", event.target.value)}
								className={`${inputClass} font-normal`}
							/>
						</Field>

						<Field
							label={messages.admin.chatGpt.context}
							name="chatgpt-context"
						>
							<textarea
								id="chatgpt-context"
								rows={3}
								maxLength={300}
								value={input.lessonContext}
								onChange={(event) =>
									update("lessonContext", event.target.value)
								}
								className={`${inputClass} resize-y py-3 font-normal`}
							/>
						</Field>

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
										update(
											"profile",
											event.target.value as typeof input.profile,
										)
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

						<button type="submit" className="primary-button">
							{messages.admin.chatGpt.make}
						</button>
					</form>
				) : null}

				{currentStep === 2 && generated ? (
					<section
						aria-labelledby="chatgpt-step-2-title"
						className="mt-6 rounded-md bg-paper p-4 sm:p-5"
					>
						<p className="text-ink/75">{messages.admin.chatGpt.copyIntro}</p>
						<div className="mt-4 flex flex-wrap gap-3">
							<button
								ref={copyButton}
								type="button"
								onClick={copyInstructions}
								className="primary-button"
							>
								{messages.admin.chatGpt.copy}
							</button>
							<button
								type="button"
								onClick={() => showStep(1)}
								className="secondary-button"
							>
								{messages.admin.chatGpt.editPreferences}
							</button>
							<button
								type="button"
								onClick={() => showStep(3)}
								className="text-button"
							>
								{messages.admin.chatGpt.goToResponse}
							</button>
						</div>
					</section>
				) : null}

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

				{currentStep === 3 ? (
					<section
						aria-labelledby="chatgpt-response-title"
						className="mt-6 border-ink/20 border-t pt-6"
					>
						{copyState === "copied" || copyState === "manual" ? (
							<div className="mb-6 flex flex-wrap items-center gap-4 rounded-md bg-paper p-4">
								<a
									ref={openChatGptLink}
									href="https://chatgpt.com/"
									target="_blank"
									rel="noreferrer"
									className="primary-button inline-flex items-center"
								>
									{messages.admin.chatGpt.openChatGpt}
								</a>
								<button
									type="button"
									onClick={() => showStep(2)}
									className="text-button"
								>
									{messages.admin.chatGpt.copyAgain}
								</button>
							</div>
						) : null}
						{generated ? (
							<button
								type="button"
								onClick={makeInstructions}
								className="text-button mb-5"
							>
								{messages.admin.chatGpt.remake}
							</button>
						) : null}
						<h3
							id="chatgpt-response-title"
							className="font-serif text-xl font-semibold"
						>
							{messages.admin.chatGpt.responseTitle}
						</h3>
						<p className="mt-2 text-ink/75">
							{messages.admin.chatGpt.responseIntro}
						</p>
						<label
							className="mt-5 block font-semibold"
							htmlFor="chatgpt-response"
						>
							{messages.admin.chatGpt.responseLabel}
						</label>
						<textarea
							id="chatgpt-response"
							rows={10}
							value={pastedResponse}
							onChange={(event) => {
								setPastedResponse(event.target.value);
								setImportState(null);
								setRepairCopyState("idle");
							}}
							aria-invalid={importState?.kind === "error" ? "true" : undefined}
							aria-describedby={
								importState?.kind === "error"
									? "chatgpt-response-hint chatgpt-import-feedback"
									: "chatgpt-response-hint"
							}
							className={`${inputClass} mt-2 resize-y py-3 font-mono text-xs`}
						/>
						<p id="chatgpt-response-hint" className="mt-2 text-ink/70 text-sm">
							{messages.admin.chatGpt.responseHint}
						</p>
						<button
							type="button"
							disabled={!pastedResponse.trim()}
							onClick={checkAndApplyResponse}
							className="primary-button mt-4"
						>
							{messages.admin.chatGpt.applyResponse}
						</button>

						<p
							role="status"
							aria-live="polite"
							aria-atomic="true"
							className="mt-4 font-semibold text-ink/80"
						>
							{importState?.kind === "applied"
								? messages.admin.chatGpt.applied
								: ""}
						</p>
						{importState?.kind === "blocked" ? (
							<div
								ref={importFeedback}
								role="alert"
								tabIndex={-1}
								className="mt-4 rounded-md border border-red-800/30 bg-red-50 p-4 text-red-900"
							>
								{messages.admin.chatGpt.blocked}
							</div>
						) : null}
						{importState?.kind === "error" ? (
							<div
								ref={importFeedback}
								id="chatgpt-import-feedback"
								role="alert"
								tabIndex={-1}
								className="mt-4 rounded-md border border-red-800/30 bg-red-50 p-4 text-red-900"
							>
								{importState.message}
							</div>
						) : null}
						{importState?.kind === "cannot-complete" ? (
							<div
								ref={importFeedback}
								role="alert"
								tabIndex={-1}
								className="mt-4 break-words rounded-md border border-amber-800/30 bg-amber-50 p-4 text-amber-950"
							>
								<p className="font-semibold">
									{messages.admin.chatGpt.cannotComplete}
								</p>
								<ul className="mt-2 list-disc space-y-1 pl-5">
									{importState.reasons.map((reason) => (
										<li key={reason}>{reason}</li>
									))}
								</ul>
							</div>
						) : null}

						{repairPrompt ? (
							<button
								type="button"
								onClick={copyRepairInstructions}
								className="secondary-button mt-4"
							>
								{messages.admin.chatGpt.copyRepair}
							</button>
						) : null}
						<p
							role="status"
							aria-live="polite"
							className="mt-3 text-ink/75 text-sm"
						>
							{repairCopyState === "copied"
								? messages.admin.chatGpt.repairCopied
								: repairCopyState === "manual"
									? messages.admin.chatGpt.repairManual
									: ""}
						</p>
						{repairPrompt && repairCopyState === "manual" ? (
							<div className="mt-3">
								<label
									className="block font-semibold"
									htmlFor="chatgpt-repair-manual"
								>
									{messages.admin.chatGpt.repairLabel}
								</label>
								<textarea
									ref={manualRepair}
									id="chatgpt-repair-manual"
									readOnly
									rows={7}
									value={repairPrompt}
									className={`${inputClass} mt-2 resize-y py-3 font-mono text-xs`}
								/>
							</div>
						) : null}
					</section>
				) : null}
			</div>
		</details>
	);
}

function currentRepairPrompt(importState: ImportState | null): string | null {
	return importState?.kind === "error" ||
		importState?.kind === "cannot-complete"
		? importState.repairPrompt
		: null;
}

function readActiveRequest() {
	try {
		return parseActiveChatGptRequest(
			sessionStorage.getItem(CHATGPT_ACTIVE_REQUEST_STORAGE_KEY),
		);
	} catch {
		return null;
	}
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
