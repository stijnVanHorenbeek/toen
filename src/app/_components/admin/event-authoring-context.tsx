"use client";

import {
	createContext,
	type ReactNode,
	use,
	useEffect,
	useRef,
	useState,
} from "react";
import { clearAuthoringBeatSourceReferences } from "@/lib/admin/authoring-beat";
import type {
	AuthoringDraft,
	AuthoringSource,
	AuthoringStep,
	EventDraftInput,
} from "@/lib/admin/authoring-draft";
import {
	addExistingTopicToAuthoringDraft,
	addTopicToAuthoringDraft,
	createInitialAuthoringBeatDraft,
	createInitialAuthoringDraft,
	isInitialAuthoringDraft,
	selectStoredAuthoringDraft,
	toEventDraftInput,
	validateAuthoringStory,
} from "@/lib/admin/authoring-draft";
import type { EventDraftPreview } from "@/lib/content/event-draft";
import type { VakrichtingId } from "@/lib/content/taxonomy";
import { messages } from "@/lib/i18n/messages.nl-BE";

const storageKey = "toen:event-draft:v2";
const legacyStorageKey = "toen:event-draft:v1";

type Step = AuthoringStep;
type SaveStatus = "idle" | "saving" | "saved" | "failed";
type FieldErrors = Record<string, string>;

type CommitPublishResult = EventDraftPreview & {
	change: "created" | "unchanged";
	commitSha: string;
	commitUrl: string;
};

export type EventPublishResult =
	| (EventDraftPreview & { status: "dry-run" })
	| (CommitPublishResult & { status: "committed-and-triggered" })
	| (CommitPublishResult & { status: "committed-trigger-failed" });

type AuthoringContextValue = {
	state: {
		draft: AuthoringDraft;
		step: Step;
		errors: FieldErrors;
		preview: EventDraftPreview | null;
		publishResult: EventPublishResult | null;
		previewError: string | null;
		publishError: string | null;
		isPreviewing: boolean;
		isPublishing: boolean;
		confirmationOpen: boolean;
		restoredDraft: { draft: AuthoringDraft; step: Step } | null;
		saveStatus: SaveStatus;
	};
	actions: {
		update: <Key extends keyof AuthoringDraft>(
			field: Key,
			value: AuthoringDraft[Key],
		) => void;
		continueStory: () => void;
		requestPreview: () => Promise<void>;
		goToStep: (step: Step) => void;
		toggleProfile: (profile: VakrichtingId) => void;
		addTopic: (label: string) => void;
		selectTopic: (topic: string, label: string) => void;
		removeTopic: (topic: string) => void;
		addSource: () => void;
		updateSource: (
			index: number,
			field: keyof AuthoringSource,
			value: string,
		) => void;
		removeSource: (index: number) => void;
		moveSource: (index: number, direction: -1 | 1) => void;
		enableBeat: () => void;
		disableBeat: () => void;
		updateBeat: (beat: NonNullable<AuthoringDraft["beat"]>) => void;
		openConfirmation: () => void;
		closeConfirmation: () => void;
		publish: () => Promise<void>;
		restoreDraft: () => void;
		discardStoredDraft: () => void;
	};
	meta: { topicLabels: Record<string, string>; topicOptions: string[] };
};

const EventAuthoringContext = createContext<AuthoringContextValue | null>(null);

export function EventAuthoringProvider({
	children,
	topicLabels,
	topicOptions,
}: {
	children: ReactNode;
	topicLabels: Record<string, string>;
	topicOptions: string[];
}) {
	const [draft, setDraft] = useState(createInitialAuthoringDraft);
	const [step, setStep] = useState<Step>(1);
	const [errors, setErrors] = useState<FieldErrors>({});
	const [preview, setPreview] = useState<EventDraftPreview | null>(null);
	const [validatedInput, setValidatedInput] = useState<EventDraftInput | null>(
		null,
	);
	const [publishResult, setPublishResult] = useState<EventPublishResult | null>(
		null,
	);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [publishError, setPublishError] = useState<string | null>(null);
	const [isPreviewing, setIsPreviewing] = useState(false);
	const [isPublishing, setIsPublishing] = useState(false);
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const [restoredDraft, setRestoredDraft] = useState<{
		draft: AuthoringDraft;
		step: Step;
	} | null>(null);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [storageReady, setStorageReady] = useState(false);
	const previewGeneration = useRef(0);
	const publishInFlight = useRef(false);
	const saveTimeout = useRef<number | null>(null);

	useEffect(() => {
		try {
			const currentValue = localStorage.getItem(storageKey);
			const legacyValue = localStorage.getItem(legacyStorageKey);
			const parsed = selectStoredAuthoringDraft(currentValue, legacyValue);
			if (parsed) {
				setRestoredDraft(parsed);
			} else {
				if (currentValue !== null) localStorage.removeItem(storageKey);
				if (legacyValue !== null) localStorage.removeItem(legacyStorageKey);
			}
		} catch {
			// Browser storage can be unavailable. Authoring still works for this session.
		}
		setStorageReady(true);
	}, []);

	useEffect(() => {
		if (!storageReady || restoredDraft) return;
		if (isInitialAuthoringDraft(draft)) {
			clearStoredDraft();
			setSaveStatus("idle");
			return;
		}
		setSaveStatus("saving");
		saveTimeout.current = window.setTimeout(() => {
			saveTimeout.current = null;
			try {
				localStorage.setItem(
					storageKey,
					JSON.stringify({ version: 2, draft, step }),
				);
				try {
					localStorage.removeItem(legacyStorageKey);
				} catch {
					// Current version is saved; stale legacy cleanup can fail independently.
				}
				setSaveStatus("saved");
			} catch {
				setSaveStatus("failed");
			}
		}, 300);
		return () => {
			if (saveTimeout.current !== null) {
				window.clearTimeout(saveTimeout.current);
				saveTimeout.current = null;
			}
		};
	}, [draft, restoredDraft, step, storageReady]);

	useEffect(() => {
		if (saveStatus !== "saving" && saveStatus !== "failed") return;
		const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", warnBeforeLeaving);
		return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
	}, [saveStatus]);

	function invalidate() {
		previewGeneration.current += 1;
		setIsPreviewing(false);
		setPreview(null);
		setValidatedInput(null);
		setPublishResult(null);
		setPreviewError(null);
		setPublishError(null);
		setErrors({});
	}

	function update<Key extends keyof AuthoringDraft>(
		field: Key,
		value: AuthoringDraft[Key],
	) {
		invalidate();
		setDraft((current) => ({ ...current, [field]: value }));
	}

	function continueStory() {
		const nextErrors = validateAuthoringStory(draft);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;
		setStep(2);
	}

	async function requestPreview() {
		const generation = ++previewGeneration.current;
		const input = toEventDraftInput(draft);
		setIsPreviewing(true);
		setErrors({});
		setPreviewError(null);
		try {
			const response = await postEvent("/api/admin/events/preview", input);
			if (generation !== previewGeneration.current) return;
			if (!response.ok || !isEventDraftPreview(response.body)) {
				const issues = apiIssues(response.body);
				setErrors(issues);
				const issueStep = validationIssueStep(Object.keys(issues));
				if (issueStep) setStep(issueStep);
				if (Object.keys(issues).length === 0) {
					setPreviewError(messages.errors.previewFailed);
				}
				return;
			}
			setValidatedInput(input);
			setPreview(response.body);
			setStep(4);
		} catch {
			if (generation === previewGeneration.current) {
				setPreviewError(messages.errors.previewFailed);
			}
		} finally {
			if (generation === previewGeneration.current) setIsPreviewing(false);
		}
	}

	function toggleProfile(profile: VakrichtingId) {
		update(
			"profiles",
			draft.profiles.includes(profile)
				? draft.profiles.filter((value) => value !== profile)
				: [...draft.profiles, profile],
		);
	}

	function addTopic(label: string) {
		const nextDraft = addTopicToAuthoringDraft(draft, label);
		if (nextDraft === draft) return;
		invalidate();
		setDraft(nextDraft);
	}

	function selectTopic(topic: string, label: string) {
		const nextDraft = addExistingTopicToAuthoringDraft(draft, topic, label);
		if (nextDraft === draft) return;
		invalidate();
		setDraft(nextDraft);
	}

	function removeTopic(topic: string) {
		invalidate();
		setDraft((current) => {
			const { [topic]: _removed, ...topicLabels } = current.topicLabels;
			return {
				...current,
				topics: current.topics.filter((value) => value !== topic),
				topicLabels,
			};
		});
	}

	function addSource() {
		update("sources", [
			...draft.sources,
			{ id: crypto.randomUUID(), title: "", publisher: "", url: "" },
		]);
	}

	function updateSource(
		index: number,
		field: keyof AuthoringSource,
		value: string,
	) {
		update(
			"sources",
			draft.sources.map((source, sourceIndex) =>
				sourceIndex === index ? { ...source, [field]: value } : source,
			),
		);
	}

	function removeSource(index: number) {
		if (draft.sources.length === 1) return;
		const sourceId = draft.sources[index]?.id ?? `source-${index + 1}`;
		invalidate();
		setDraft((current) => ({
			...current,
			sources: current.sources.filter(
				(_, sourceIndex) => sourceIndex !== index,
			),
			beat: current.beat
				? clearAuthoringBeatSourceReferences(current.beat, sourceId)
				: null,
		}));
	}

	function moveSource(index: number, direction: -1 | 1) {
		const destination = index + direction;
		if (destination < 0 || destination >= draft.sources.length) return;
		const sources = [...draft.sources];
		[sources[index], sources[destination]] = [
			sources[destination],
			sources[index],
		];
		update("sources", sources);
	}

	function enableBeat() {
		if (draft.beat) return;
		update("beat", createInitialAuthoringBeatDraft(draft.sources));
	}

	function disableBeat() {
		if (!draft.beat) return;
		update("beat", null);
	}

	function updateBeat(beat: NonNullable<AuthoringDraft["beat"]>) {
		update("beat", beat);
	}

	async function publish() {
		if (!validatedInput || publishInFlight.current) return;
		publishInFlight.current = true;
		const generation = previewGeneration.current;
		setConfirmationOpen(false);
		setIsPublishing(true);
		setPublishError(null);
		try {
			const response = await postEvent(
				"/api/admin/events/publish",
				validatedInput,
			);
			if (!response.ok || !isEventPublishResult(response.body)) {
				throw new Error(apiMessage(response.body));
			}
			if (generation !== previewGeneration.current) return;
			setPublishResult(response.body);
			if (response.body.status === "committed-and-triggered") {
				if (saveTimeout.current !== null) {
					window.clearTimeout(saveTimeout.current);
					saveTimeout.current = null;
				}
				clearStoredDraft();
				setValidatedInput(null);
				setSaveStatus("idle");
			}
		} catch (error) {
			if (generation !== previewGeneration.current) return;
			setPublishError(
				error instanceof Error ? error.message : messages.errors.publishFailed,
			);
		} finally {
			publishInFlight.current = false;
			setIsPublishing(false);
		}
	}

	function restoreDraft() {
		if (!restoredDraft) return;
		setDraft(withSourceIds(restoredDraft.draft));
		setStep(restoredDraft.step);
		setRestoredDraft(null);
		setSaveStatus("saved");
	}

	function discardStoredDraft() {
		clearStoredDraft();
		setRestoredDraft(null);
		setSaveStatus("idle");
	}

	const value: AuthoringContextValue = {
		state: {
			draft,
			step,
			errors,
			preview,
			publishResult,
			previewError,
			publishError,
			isPreviewing,
			isPublishing,
			confirmationOpen,
			restoredDraft,
			saveStatus,
		},
		actions: {
			update,
			continueStory,
			requestPreview,
			goToStep: (nextStep) => setStep(nextStep),
			toggleProfile,
			addTopic,
			selectTopic,
			removeTopic,
			addSource,
			updateSource,
			removeSource,
			moveSource,
			enableBeat,
			disableBeat,
			updateBeat,
			openConfirmation: () => setConfirmationOpen(true),
			closeConfirmation: () => setConfirmationOpen(false),
			publish,
			restoreDraft,
			discardStoredDraft,
		},
		meta: { topicLabels, topicOptions },
	};

	return (
		<EventAuthoringContext value={value}>{children}</EventAuthoringContext>
	);
}

export function useEventAuthoring(): AuthoringContextValue {
	const value = use(EventAuthoringContext);
	if (!value) throw new Error("Event authoring context is missing");
	return value;
}

async function postEvent(url: string, body: unknown) {
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	let responseBody: unknown = null;
	try {
		responseBody = await response.json();
	} catch {
		responseBody = null;
	}
	return { ok: response.ok, body: responseBody };
}

function apiIssues(value: unknown): FieldErrors {
	if (!isRecord(value) || !Array.isArray(value.issues)) return {};
	return Object.fromEntries(
		value.issues.flatMap((issue) =>
			isRecord(issue) &&
			typeof issue.field === "string" &&
			typeof issue.message === "string"
				? [[mapIssueField(issue.field), issue.message]]
				: [],
		),
	);
}

function mapIssueField(field: string): string {
	if (field.startsWith("date.")) return field.slice("date.".length);
	if (field.startsWith("beat.routes")) return "beat.routes";
	if (/^beat\.stages\.\d+\.sourceUrl$/.test(field)) {
		return field.replace(/sourceUrl$/, "sourceId");
	}
	if (/^beat\.stages\.\d+\.sourceUrls/.test(field)) {
		return field.replace(/sourceUrls(?:\.\d+)?$/, "sourceIds");
	}
	if (/^beat\.sourceCards\.\d+\.sourceUrl$/.test(field)) {
		return field.replace(/sourceUrl$/, "sourceId");
	}
	return field;
}

function validationIssueStep(fields: string[]): Step | null {
	if (fields.some(isStoryField)) return 1;
	if (
		fields.some(
			(field) =>
				field === "profiles" ||
				field === "topics" ||
				field.startsWith("sources"),
		)
	) {
		return 2;
	}
	if (fields.some((field) => field.startsWith("beat"))) return 3;
	return null;
}

function isStoryField(field: string): boolean {
	return [
		"title",
		"summary",
		"body",
		"year",
		"month",
		"day",
		"exactDate",
	].includes(field);
}

function apiMessage(value: unknown): string {
	return isRecord(value) && typeof value.error === "string"
		? value.error
		: messages.errors.publishFailed;
}

function isEventDraftPreview(value: unknown): value is EventDraftPreview {
	return (
		isRecord(value) &&
		isRecord(value.event) &&
		typeof value.path === "string" &&
		typeof value.markdown === "string"
	);
}

function isEventPublishResult(value: unknown): value is EventPublishResult {
	if (!isRecord(value) || !isEventDraftPreview(value)) return false;
	const record = value as unknown as Record<string, unknown>;
	if (record.status === "dry-run") return true;
	return (
		(record.status === "committed-and-triggered" ||
			record.status === "committed-trigger-failed") &&
		(record.change === "created" || record.change === "unchanged") &&
		typeof record.commitSha === "string" &&
		typeof record.commitUrl === "string"
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function clearStoredDraft(): void {
	try {
		localStorage.removeItem(storageKey);
		localStorage.removeItem(legacyStorageKey);
	} catch {
		try {
			localStorage.setItem(storageKey, "discarded");
			localStorage.setItem(legacyStorageKey, "discarded");
		} catch {
			// Browser storage can reject both cleanup operations.
		}
	}
}

function withSourceIds(draft: AuthoringDraft): AuthoringDraft {
	return {
		...createInitialAuthoringDraft(),
		...draft,
		sources: draft.sources.map((source, index) => ({
			...source,
			id: source.id ?? `source-${index + 1}`,
		})),
	};
}
