"use client";

import { useRef, useState } from "react";
import type { EventDraftPreview } from "@/lib/content/event-draft";

type CommitPublishResult = EventDraftPreview & {
	change: "created" | "unchanged";
	commitSha: string;
	commitUrl: string;
};

export type EventPublishResult =
	| (EventDraftPreview & { status: "dry-run" })
	| (CommitPublishResult & { status: "committed-and-triggered" })
	| (CommitPublishResult & { status: "committed-trigger-failed" });

export function useEventDraft() {
	const [draft, setDraft] = useState<unknown>(null);
	const [preview, setPreview] = useState<EventDraftPreview | null>(null);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [publishResult, setPublishResult] = useState<EventPublishResult | null>(
		null,
	);
	const [publishError, setPublishError] = useState<string | null>(null);
	const [isPreviewing, setIsPreviewing] = useState(false);
	const [isPublishing, setIsPublishing] = useState(false);
	const previewGeneration = useRef(0);
	const publishInFlight = useRef(false);

	async function requestPreview(formData: FormData) {
		const generation = ++previewGeneration.current;
		const nextDraft = eventDraftFromForm(formData);
		setIsPreviewing(true);
		setPreviewError(null);
		setPublishResult(null);
		setPublishError(null);

		try {
			const response = await postEvent("/api/admin/events/preview", nextDraft);
			if (generation !== previewGeneration.current) return;
			if (!response.ok || !isEventDraftPreview(response.body)) {
				throw new Error(apiError(response.body, "Preview genereren mislukt."));
			}
			setDraft(nextDraft);
			setPreview(response.body);
		} catch (error) {
			if (generation !== previewGeneration.current) return;
			setDraft(null);
			setPreview(null);
			setPreviewError(errorMessage(error, "Preview genereren mislukt."));
		} finally {
			if (generation === previewGeneration.current) setIsPreviewing(false);
		}
	}

	async function requestPublish() {
		if (!draft || publishInFlight.current) return;
		publishInFlight.current = true;
		setIsPublishing(true);
		setPublishError(null);

		try {
			const response = await postEvent("/api/admin/events/publish", draft);
			if (!response.ok || !isEventPublishResult(response.body)) {
				throw new Error(apiError(response.body, "Publiceren mislukt."));
			}
			setPublishResult(response.body);
			if (response.body.status === "committed-and-triggered") setDraft(null);
		} catch (error) {
			setPublishResult(null);
			setPublishError(errorMessage(error, "Publiceren mislukt."));
		} finally {
			publishInFlight.current = false;
			setIsPublishing(false);
		}
	}

	function invalidatePreview() {
		previewGeneration.current += 1;
		setIsPreviewing(false);
		setDraft(null);
		setPreview(null);
		setPreviewError(null);
		setPublishResult(null);
		setPublishError(null);
	}

	return {
		canPublish: draft !== null && preview !== null,
		invalidatePreview,
		isPreviewing,
		isPublishing,
		preview,
		previewError,
		publishError,
		publishResult,
		requestPreview,
		requestPublish,
	};
}

async function postEvent(url: string, body: unknown) {
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return { ok: response.ok, body: (await response.json()) as unknown };
}

function isEventDraftPreview(value: unknown): value is EventDraftPreview {
	return (
		isRecord(value) &&
		typeof value.path === "string" &&
		typeof value.markdown === "string"
	);
}

function isEventPublishResult(value: unknown): value is EventPublishResult {
	if (!isRecord(value)) return false;
	const { status, change, commitSha, commitUrl } = value;
	if (!isEventDraftPreview(value)) return false;
	if (status === "dry-run") return true;
	return (
		(status === "committed-and-triggered" ||
			status === "committed-trigger-failed") &&
		(change === "created" || change === "unchanged") &&
		typeof commitSha === "string" &&
		typeof commitUrl === "string"
	);
}

function apiError(value: unknown, fallback: string): string {
	return isRecord(value) && typeof value.error === "string"
		? value.error
		: fallback;
}

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function eventDraftFromForm(formData: FormData) {
	return {
		slug: textValue(formData, "slug"),
		title: textValue(formData, "title"),
		date: {
			year: numberValue(formData, "year"),
			era: textValue(formData, "era"),
			precision: "day",
			month: numberValue(formData, "month"),
			day: numberValue(formData, "day"),
		},
		summary: textValue(formData, "summary"),
		topics: tagValues(formData, "topics"),
		profiles: tagValues(formData, "profiles"),
		sources: [
			{
				title: textValue(formData, "sourceTitle"),
				publisher: textValue(formData, "sourcePublisher"),
				url: textValue(formData, "sourceUrl"),
			},
		],
		body: textValue(formData, "body"),
	};
}

function textValue(formData: FormData, name: string): string {
	return String(formData.get(name) ?? "").trim();
}

function numberValue(formData: FormData, name: string): number {
	return Number(textValue(formData, name));
}

function tagValues(formData: FormData, name: string): string[] {
	return textValue(formData, name)
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
}
