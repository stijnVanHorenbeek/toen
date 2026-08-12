import { describe, expect, it } from "vitest";
import {
	aiDraftReviewSchema,
	createAiDraftReview,
	getAiDraftReviewStatus,
	markAiDraftEdited,
	markAiSourceLinkChosen,
	removeAiReviewSource,
	resetAiSourceAttestation,
	setAiClaimStatus,
	setAiSourceConfirmed,
	toggleAiClaimSource,
} from "../src/lib/admin/ai-draft-review";
import { createInitialAuthoringDraft } from "../src/lib/admin/authoring-draft";
import type { ChatGptClaim } from "../src/lib/admin/chatgpt-response";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const claims: ChatGptClaim[] = [
	{
		text: "De stad werd na een beleg ingenomen.",
		sourceUrls: ["https://example.org/a"],
		uncertainty: null,
	},
];

function importedDraft() {
	const draft = createInitialAuthoringDraft();
	draft.title = "Ingevoerd verhaal";
	draft.sources = [
		{
			id: "source-a",
			title: "Bron A",
			publisher: "Archief A",
			url: "https://example.org/a",
		},
		{
			id: "source-b",
			title: "Bron B",
			publisher: "Archief B",
			url: "https://example.org/b",
		},
	];
	return draft;
}

describe("AI draft editorial review", () => {
	it("starts incomplete and retains original claim relationships", () => {
		const draft = importedDraft();
		const review = createAiDraftReview(draft, claims, requestId);

		expect(review).toMatchObject({
			version: 1,
			requestId,
			draftChangedSinceImport: false,
			claims: [
				{
					id: "claim-1",
					text: claims[0].text,
					originalSources: [{ title: "Bron A", url: "https://example.org/a" }],
					currentSourceIds: ["source-a"],
					status: "pending",
				},
			],
		});
		expect(getAiDraftReviewStatus(review, draft)).toMatchObject({
			complete: false,
			incompleteSourceIds: ["source-a", "source-b"],
			pendingClaimIds: ["claim-1"],
			missingEvidenceClaimIds: [],
		});
		expect(
			toggleAiClaimSource(review, draft, "claim-1", "source-b")
				.draftChangedSinceImport,
		).toBe(false);
	});

	it("requires explicit link choice, source confirmation, and claim review", () => {
		const draft = importedDraft();
		let review = createAiDraftReview(draft, claims, requestId);

		review = setAiSourceConfirmed(review, draft, "source-a", true);
		expect(review.sourceReviews[0]?.confirmedUrl).toBeNull();

		for (const source of draft.sources) {
			review = markAiSourceLinkChosen(review, draft, source.id ?? "");
		}
		expect(getAiDraftReviewStatus(review, draft).complete).toBe(false);

		for (const source of draft.sources) {
			review = setAiSourceConfirmed(review, draft, source.id ?? "", true);
		}
		expect(getAiDraftReviewStatus(review, draft).complete).toBe(false);

		review = setAiClaimStatus(review, draft, "claim-1", "confirmed");
		expect(getAiDraftReviewStatus(review, draft).complete).toBe(true);
	});

	it("fails closed when evidence disappears and permits a teacher correction", () => {
		const draft = importedDraft();
		let review = createAiDraftReview(draft, claims, requestId);
		review = removeAiReviewSource(review, "source-a");
		draft.sources = draft.sources.filter(({ id }) => id !== "source-a");

		expect(getAiDraftReviewStatus(review, draft)).toMatchObject({
			complete: false,
			missingEvidenceClaimIds: ["claim-1"],
		});

		review = toggleAiClaimSource(review, draft, "claim-1", "source-b");
		expect(review.claims[0]?.currentSourceIds).toEqual(["source-b"]);
		expect(review.draftChangedSinceImport).toBe(true);
	});

	it("does not resurrect a source attestation after a URL round trip", () => {
		const draft = importedDraft();
		let review = createAiDraftReview(draft, claims, requestId);
		review = markAiSourceLinkChosen(review, draft, "source-a");
		review = setAiSourceConfirmed(review, draft, "source-a", true);

		draft.sources[0].url = "https://example.org/changed";
		review = resetAiSourceAttestation(review, "source-a");
		draft.sources[0].url = "https://example.org/a";

		expect(review.sourceReviews[0]).toMatchObject({
			chosenUrl: null,
			confirmedUrl: null,
		});
		expect(getAiDraftReviewStatus(review, draft).incompleteSourceIds).toContain(
			"source-a",
		);
	});

	it("resets claim decisions after any draft edit while retaining URL-bound source checks", () => {
		const draft = importedDraft();
		let review = createAiDraftReview(draft, claims, requestId);
		for (const source of draft.sources) {
			review = markAiSourceLinkChosen(review, draft, source.id ?? "");
			review = setAiSourceConfirmed(review, draft, source.id ?? "", true);
		}
		review = setAiClaimStatus(review, draft, "claim-1", "confirmed");

		review = markAiDraftEdited(review);

		expect(review.draftChangedSinceImport).toBe(true);
		expect(review.claims[0]?.status).toBe("pending");
		expect(review.sourceReviews.every(({ confirmedUrl }) => confirmedUrl)).toBe(
			true,
		);
		expect(getAiDraftReviewStatus(review, draft).complete).toBe(false);
	});

	it("keeps editor-expanded source review state restorable beyond import limits", () => {
		const draft = importedDraft();
		draft.sources = Array.from({ length: 17 }, (_, index) => ({
			id: `source-${index + 1}`,
			title: `Bron ${index + 1}`,
			publisher: "Archief",
			url:
				index === 0
					? "https://example.org/a"
					: `https://example.org/${index + 1}`,
		}));
		const expanded = createAiDraftReview(draft, claims, requestId);
		expect(aiDraftReviewSchema.safeParse(expanded).success).toBe(true);

		const longUrl = `https://example.org/${"a".repeat(2_100)}`;
		draft.sources[0].url = longUrl;
		let changed = resetAiSourceAttestation(expanded, "source-1");
		changed = markAiSourceLinkChosen(changed, draft, "source-1");
		expect(changed.sourceReviews[0]?.chosenUrl).toBe(longUrl);
		expect(aiDraftReviewSchema.safeParse(changed).success).toBe(true);
	});

	it("allows an explicitly removed claim without pretending it has evidence", () => {
		const draft = importedDraft();
		let review = createAiDraftReview(draft, claims, requestId);
		for (const source of draft.sources) {
			review = markAiSourceLinkChosen(review, draft, source.id ?? "");
			review = setAiSourceConfirmed(review, draft, source.id ?? "", true);
		}
		review = setAiClaimStatus(review, draft, "claim-1", "removed");

		expect(getAiDraftReviewStatus(review, draft)).toMatchObject({
			complete: true,
			missingEvidenceClaimIds: [],
		});
	});
});
