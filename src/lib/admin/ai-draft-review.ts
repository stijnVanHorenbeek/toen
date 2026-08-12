import { z } from "zod";
import { isSafeEditorLink } from "../content/editor-markdown";
import type { AuthoringDraft } from "./authoring-draft";
import type { ChatGptClaim } from "./chatgpt-response";

const originalSourceUrlSchema = z
	.string()
	.trim()
	.max(2_048)
	.refine(isSafeEditorLink);
const currentSourceUrlSchema = z.string().trim().refine(isSafeEditorLink);

const aiClaimReviewSchema = z.strictObject({
	id: z.string().min(1).max(64),
	text: z.string().trim().min(1).max(1_000),
	originalSources: z
		.array(
			z.strictObject({
				title: z.string().trim().min(1).max(240),
				url: originalSourceUrlSchema,
			}),
		)
		.min(1)
		.max(16),
	currentSourceIds: z.array(z.string().min(1).max(128)),
	uncertainty: z.string().trim().min(1).max(500).nullable(),
	status: z.enum(["pending", "confirmed", "removed"]),
});

const aiSourceReviewSchema = z.strictObject({
	sourceId: z.string().min(1).max(128),
	chosenUrl: currentSourceUrlSchema.nullable(),
	confirmedUrl: currentSourceUrlSchema.nullable(),
});

export const aiDraftReviewSchema = z
	.strictObject({
		version: z.literal(1),
		requestId: z.uuid(),
		draftChangedSinceImport: z.boolean(),
		claims: z.array(aiClaimReviewSchema).min(1).max(64),
		sourceReviews: z.array(aiSourceReviewSchema),
	})
	.superRefine((review, context) => {
		if (
			new Set(review.claims.map(({ id }) => id)).size !== review.claims.length
		) {
			context.addIssue({
				code: "custom",
				path: ["claims"],
				message: "Bewering-ID's moeten uniek zijn.",
			});
		}
		if (
			new Set(review.sourceReviews.map(({ sourceId }) => sourceId)).size !==
			review.sourceReviews.length
		) {
			context.addIssue({
				code: "custom",
				path: ["sourceReviews"],
				message: "Bron-ID's moeten uniek zijn.",
			});
		}
		for (const [index, claim] of review.claims.entries()) {
			if (
				new Set(claim.originalSources.map(({ url }) => url)).size !==
				claim.originalSources.length
			) {
				context.addIssue({
					code: "custom",
					path: ["claims", index, "originalSources"],
					message: "Oorspronkelijke bronadressen moeten uniek zijn.",
				});
			}
			if (
				new Set(claim.currentSourceIds).size !== claim.currentSourceIds.length
			) {
				context.addIssue({
					code: "custom",
					path: ["claims", index, "currentSourceIds"],
					message: "Gekoppelde bronnen moeten uniek zijn.",
				});
			}
		}
		for (const [index, source] of review.sourceReviews.entries()) {
			if (
				source.confirmedUrl !== null &&
				source.confirmedUrl !== source.chosenUrl
			) {
				context.addIssue({
					code: "custom",
					path: ["sourceReviews", index, "confirmedUrl"],
					message: "Een bevestigde bron moet eerst gekozen zijn.",
				});
			}
		}
	});

export type AiDraftReview = z.infer<typeof aiDraftReviewSchema>;
export type AiClaimStatus = AiDraftReview["claims"][number]["status"];

export type AiDraftReviewStatus = {
	complete: boolean;
	incompleteSourceIds: string[];
	pendingClaimIds: string[];
	missingEvidenceClaimIds: string[];
	unrelatedSourceIds: string[];
	duplicateSourceIds: string[];
};

export function createAiDraftReview(
	draft: AuthoringDraft,
	claims: ChatGptClaim[],
	requestId: string,
): AiDraftReview {
	const sourceIdByUrl = new Map(
		draft.sources.map((source, index) => [
			source.url.trim(),
			source.id ?? `source-${index + 1}`,
		]),
	);
	return {
		version: 1,
		requestId,
		draftChangedSinceImport: false,
		claims: claims.map((claim, index) => ({
			id: `claim-${index + 1}`,
			text: claim.text,
			originalSources: claim.sourceUrls.map((url) => ({
				title:
					draft.sources.find((source) => source.url.trim() === url)?.title ??
					url,
				url,
			})),
			currentSourceIds: claim.sourceUrls.flatMap((url) => {
				const sourceId = sourceIdByUrl.get(url);
				return sourceId ? [sourceId] : [];
			}),
			uncertainty: claim.uncertainty,
			status: "pending",
		})),
		sourceReviews: draft.sources.map((source, index) => ({
			sourceId: source.id ?? `source-${index + 1}`,
			chosenUrl: null,
			confirmedUrl: null,
		})),
	};
}

export function getAiDraftReviewStatus(
	review: AiDraftReview,
	draft: AuthoringDraft,
): AiDraftReviewStatus {
	const currentSourceIds = draft.sources.map(
		(source, index) => source.id ?? `source-${index + 1}`,
	);
	const duplicateSourceIds = duplicates(currentSourceIds);
	const sourceById = new Map(
		draft.sources.map((source, index) => [currentSourceIds[index], source]),
	);
	const reviewBySourceId = new Map(
		review.sourceReviews.map((sourceReview) => [
			sourceReview.sourceId,
			sourceReview,
		]),
	);
	const incompleteSourceIds = currentSourceIds.filter((sourceId) => {
		const source = sourceById.get(sourceId);
		const sourceReview = reviewBySourceId.get(sourceId);
		const url = source?.url.trim() ?? "";
		return (
			!isSafeEditorLink(url) ||
			sourceReview?.chosenUrl !== url ||
			sourceReview.confirmedUrl !== url
		);
	});
	const missingEvidenceClaimIds = review.claims.flatMap((claim) => {
		if (claim.status === "removed") return [];
		return claim.currentSourceIds.length === 0 ||
			claim.currentSourceIds.some((sourceId) => !sourceById.has(sourceId))
			? [claim.id]
			: [];
	});
	const pendingClaimIds = review.claims.flatMap((claim) =>
		claim.status === "pending" ? [claim.id] : [],
	);
	const activeClaimSourceIds = new Set(
		review.claims.flatMap((claim) =>
			claim.status === "removed" ? [] : claim.currentSourceIds,
		),
	);
	const unrelatedSourceIds = currentSourceIds.filter(
		(sourceId) => !activeClaimSourceIds.has(sourceId),
	);
	return {
		complete:
			duplicateSourceIds.length === 0 &&
			incompleteSourceIds.length === 0 &&
			pendingClaimIds.length === 0 &&
			missingEvidenceClaimIds.length === 0,
		incompleteSourceIds,
		pendingClaimIds,
		missingEvidenceClaimIds,
		unrelatedSourceIds,
		duplicateSourceIds,
	};
}

export function markAiDraftEdited(review: AiDraftReview): AiDraftReview {
	return {
		...review,
		draftChangedSinceImport: true,
		claims: review.claims.map((claim) => ({ ...claim, status: "pending" })),
	};
}

export function markAiSourceLinkChosen(
	review: AiDraftReview,
	draft: AuthoringDraft,
	sourceId: string,
): AiDraftReview {
	const source = sourceById(draft, sourceId);
	const url = source?.url.trim() ?? "";
	if (!source || !isSafeEditorLink(url)) return review;
	const previous = review.sourceReviews.find(
		(sourceReview) => sourceReview.sourceId === sourceId,
	);
	const sourceReviews = upsertSourceReview(review, {
		sourceId,
		chosenUrl: url,
		confirmedUrl: previous?.confirmedUrl === url ? url : null,
	});
	return {
		...review,
		sourceReviews,
		claims:
			previous?.chosenUrl && previous.chosenUrl !== url
				? resetLinkedClaims(review, sourceId)
				: review.claims,
	};
}

export function setAiSourceConfirmed(
	review: AiDraftReview,
	draft: AuthoringDraft,
	sourceId: string,
	confirmed: boolean,
): AiDraftReview {
	const source = sourceById(draft, sourceId);
	const url = source?.url.trim() ?? "";
	const previous = review.sourceReviews.find(
		(sourceReview) => sourceReview.sourceId === sourceId,
	);
	if (!source || !previous || previous.chosenUrl !== url) return review;
	return {
		...review,
		sourceReviews: upsertSourceReview(review, {
			...previous,
			confirmedUrl: confirmed ? url : null,
		}),
		claims: confirmed ? review.claims : resetLinkedClaims(review, sourceId),
	};
}

export function resetAiSourceAttestation(
	review: AiDraftReview,
	sourceId: string,
): AiDraftReview {
	const previous = review.sourceReviews.find(
		(sourceReview) => sourceReview.sourceId === sourceId,
	);
	if (!previous) return review;
	return {
		...review,
		sourceReviews: upsertSourceReview(review, {
			sourceId,
			chosenUrl: null,
			confirmedUrl: null,
		}),
		claims: resetLinkedClaims(review, sourceId),
	};
}

export function removeAiReviewSource(
	review: AiDraftReview,
	sourceId: string,
): AiDraftReview {
	return {
		...review,
		draftChangedSinceImport: true,
		sourceReviews: review.sourceReviews.filter(
			(sourceReview) => sourceReview.sourceId !== sourceId,
		),
		claims: review.claims.map((claim) => ({
			...claim,
			currentSourceIds: claim.currentSourceIds.filter((id) => id !== sourceId),
			status: "pending",
		})),
	};
}

export function toggleAiClaimSource(
	review: AiDraftReview,
	draft: AuthoringDraft,
	claimId: string,
	sourceId: string,
): AiDraftReview {
	if (!sourceById(draft, sourceId)) return review;
	return {
		...review,
		claims: review.claims.map((claim) => {
			if (claim.id !== claimId) return claim;
			const selected = claim.currentSourceIds.includes(sourceId);
			return {
				...claim,
				currentSourceIds: selected
					? claim.currentSourceIds.filter((id) => id !== sourceId)
					: [...claim.currentSourceIds, sourceId],
				status: "pending",
			};
		}),
	};
}

export function setAiClaimStatus(
	review: AiDraftReview,
	draft: AuthoringDraft,
	claimId: string,
	status: AiClaimStatus,
): AiDraftReview {
	if (status === "confirmed" && !canConfirmClaim(review, draft, claimId)) {
		return review;
	}
	return {
		...review,
		claims: review.claims.map((claim) =>
			claim.id === claimId ? { ...claim, status } : claim,
		),
	};
}

function canConfirmClaim(
	review: AiDraftReview,
	draft: AuthoringDraft,
	claimId: string,
): boolean {
	const claim = review.claims.find(({ id }) => id === claimId);
	if (!claim || claim.currentSourceIds.length === 0) return false;
	const sourceIds = new Set(
		draft.sources.map((source, index) => source.id ?? `source-${index + 1}`),
	);
	const sourceReviewById = new Map(
		review.sourceReviews.map((sourceReview) => [
			sourceReview.sourceId,
			sourceReview,
		]),
	);
	return claim.currentSourceIds.every((sourceId) => {
		if (!sourceIds.has(sourceId)) return false;
		const source = sourceById(draft, sourceId);
		const url = source?.url.trim() ?? "";
		const sourceReview = sourceReviewById.get(sourceId);
		return sourceReview?.chosenUrl === url && sourceReview.confirmedUrl === url;
	});
}

function sourceById(draft: AuthoringDraft, sourceId: string) {
	return draft.sources.find(
		(source, index) => (source.id ?? `source-${index + 1}`) === sourceId,
	);
}

function upsertSourceReview(
	review: AiDraftReview,
	next: AiDraftReview["sourceReviews"][number],
) {
	const exists = review.sourceReviews.some(
		(sourceReview) => sourceReview.sourceId === next.sourceId,
	);
	return exists
		? review.sourceReviews.map((sourceReview) =>
				sourceReview.sourceId === next.sourceId ? next : sourceReview,
			)
		: [...review.sourceReviews, next];
}

function resetLinkedClaims(review: AiDraftReview, sourceId: string) {
	return review.claims.map((claim) =>
		claim.currentSourceIds.includes(sourceId)
			? { ...claim, status: "pending" as const }
			: claim,
	);
}

function duplicates(values: string[]) {
	const seen = new Set<string>();
	const duplicate = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) duplicate.add(value);
		seen.add(value);
	}
	return [...duplicate];
}
