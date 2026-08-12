"use client";

import { getAiDraftReviewStatus } from "@/lib/admin/ai-draft-review";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { useEventAuthoring } from "./event-authoring-context";

export function AiDraftReviewPanel() {
	const { state, actions } = useEventAuthoring();
	const review = state.aiReview;
	if (!review) return null;
	const status = getAiDraftReviewStatus(review, state.draft);
	const sensitivityNotes = state.preview?.event.beat?.sensitivityNotes ?? [];

	return (
		<section
			aria-labelledby="ai-draft-review-title"
			className="mt-8 rounded-md border-2 border-amber-700 bg-amber-50/70 p-5 sm:p-7"
		>
			<h3
				id="ai-draft-review-title"
				className="font-serif text-2xl font-semibold"
			>
				{messages.admin.aiReview.title}
			</h3>
			<p className="mt-3 max-w-3xl leading-7">
				{messages.admin.aiReview.intro}
			</p>
			<div className="mt-5 rounded-md border border-amber-800/30 bg-white p-4">
				<p className="font-semibold">{messages.admin.aiReview.truthWarning}</p>
				<p className="mt-2 text-ink/75 text-sm leading-6">
					{messages.admin.aiReview.linkChoice}
				</p>
			</div>
			{review.draftChangedSinceImport ? (
				<p
					role="alert"
					className="mt-5 rounded-md border border-amber-800/40 bg-white p-4 font-semibold"
				>
					{messages.admin.aiReview.changed}
				</p>
			) : null}
			{sensitivityNotes.length > 0 ? (
				<section aria-labelledby="ai-sensitivity-title" className="mt-7">
					<h4
						id="ai-sensitivity-title"
						className="font-serif text-xl font-semibold"
					>
						{messages.admin.aiReview.sensitivity}
					</h4>
					<ul className="mt-3 list-disc space-y-2 pl-5">
						{sensitivityNotes.map((note) => (
							<li key={note} className="break-words">
								{note}
							</li>
						))}
					</ul>
				</section>
			) : null}

			<section aria-labelledby="ai-claims-title" className="mt-8">
				<h4 id="ai-claims-title" className="font-serif text-xl font-semibold">
					{messages.admin.aiReview.claims}
				</h4>
				<ol className="mt-4 space-y-5">
					{review.claims.map((claim, index) => {
						const number = index + 1;
						const missingEvidence = status.missingEvidenceClaimIds.includes(
							claim.id,
						);
						const canConfirm = claimCanBeConfirmed(
							claim.currentSourceIds,
							state.draft,
							review.sourceReviews,
						);
						return (
							<li
								key={claim.id}
								className="min-w-0 rounded-md border border-ink/20 bg-white p-4 sm:p-5"
							>
								<h5 className="font-semibold">
									{messages.admin.aiReview.claim} {number}
								</h5>
								<p className="mt-2 break-words text-lg leading-7">
									{claim.text}
								</p>
								{claim.uncertainty ? (
									<p className="mt-3 break-all rounded-sm bg-amber-100 p-3 text-sm leading-6">
										<strong>{messages.admin.aiReview.uncertainty}:</strong>{" "}
										{claim.uncertainty}
									</p>
								) : (
									<p className="mt-3 text-ink/75 text-sm leading-6">
										{messages.admin.aiReview.noUncertainty}
									</p>
								)}
								<p className="mt-4 font-semibold text-sm">
									{messages.admin.aiReview.originalSources}
								</p>
								<ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
									{claim.originalSources.map((source) => (
										<li key={source.url} className="min-w-0">
											<strong className="block break-all">
												{source.title}
											</strong>
											<span className="break-all">{source.url}</span>
										</li>
									))}
								</ul>
								<label className="mt-5 flex items-start gap-3 rounded-sm border border-ink/25 p-3">
									<input
										type="checkbox"
										checked={claim.status === "removed"}
										onChange={(event) =>
											actions.setAiClaimStatus(
												claim.id,
												event.target.checked ? "removed" : "pending",
											)
										}
										className="mt-0.5 size-5 shrink-0 accent-accent"
									/>
									<span className="min-w-0 break-words">
										{messages.admin.aiReview.claimRemoved}
									</span>
								</label>
								{claim.status === "removed" ? null : (
									<>
										<fieldset
											className="mt-5"
											aria-invalid={missingEvidence ? "true" : undefined}
											aria-describedby={
												missingEvidence
													? `${claim.id}-evidence-error`
													: undefined
											}
										>
											<legend className="font-semibold text-sm">
												{messages.admin.aiReview.currentSources} {number}
											</legend>
											<div className="mt-3 grid gap-2 sm:grid-cols-2">
												{state.draft.sources.map((source, sourceIndex) => {
													const sourceId =
														source.id ?? `source-${sourceIndex + 1}`;
													return (
														<label
															key={sourceId}
															className="flex min-h-11 min-w-0 items-center gap-3 rounded-sm border border-ink/25 px-3 py-2"
														>
															<input
																type="checkbox"
																checked={claim.currentSourceIds.includes(
																	sourceId,
																)}
																onChange={() =>
																	actions.toggleAiClaimSource(
																		claim.id,
																		sourceId,
																	)
																}
																className="size-5 shrink-0 accent-accent"
															/>
															<span className="min-w-0 break-words">
																{source.title || `Bron ${sourceIndex + 1}`}{" "}
																koppelen als huidige bron bij bewering {number}
															</span>
														</label>
													);
												})}
											</div>
										</fieldset>
										{missingEvidence ? (
											<p
												id={`${claim.id}-evidence-error`}
												role="alert"
												className="mt-3 font-semibold text-accent text-sm"
											>
												{messages.admin.aiReview.missingEvidence}
											</p>
										) : null}
										<label className="mt-5 flex items-start gap-3 rounded-sm border border-ink/25 p-3">
											<input
												type="checkbox"
												checked={claim.status === "confirmed"}
												disabled={!canConfirm}
												aria-describedby={
													!canConfirm
														? [
																`${claim.id}-confirm-hint`,
																...(missingEvidence
																	? [`${claim.id}-evidence-error`]
																	: []),
															].join(" ")
														: undefined
												}
												onChange={(event) =>
													actions.setAiClaimStatus(
														claim.id,
														event.target.checked ? "confirmed" : "pending",
													)
												}
												className="mt-0.5 size-5 shrink-0 accent-accent"
											/>
											<span className="min-w-0 break-words">
												Ik heb bewering {number}{" "}
												{messages.admin.aiReview.confirmClaim}
											</span>
										</label>
										{!canConfirm ? (
											<p
												id={`${claim.id}-confirm-hint`}
												className="mt-2 text-ink/70 text-sm"
											>
												{messages.admin.aiReview.confirmClaimHint}
											</p>
										) : null}
									</>
								)}
							</li>
						);
					})}
				</ol>
			</section>

			<section aria-labelledby="ai-sources-title" className="mt-8">
				<h4 id="ai-sources-title" className="font-serif text-xl font-semibold">
					{messages.admin.aiReview.sources}
				</h4>
				<p className="mt-2 max-w-3xl text-ink/75 text-sm leading-6">
					{messages.admin.aiReview.sourcesIntro}
				</p>
				<ul className="mt-4 grid gap-4 sm:grid-cols-2">
					{state.draft.sources.map((source, index) => {
						const sourceId = source.id ?? `source-${index + 1}`;
						const sourceReview = review.sourceReviews.find(
							(item) => item.sourceId === sourceId,
						);
						const currentUrl = source.url.trim();
						const chosen = sourceReview?.chosenUrl === currentUrl;
						const confirmed = sourceReview?.confirmedUrl === currentUrl;
						return (
							<li
								key={sourceId}
								className="min-w-0 rounded-md border border-ink/20 bg-white p-4"
							>
								<h5 className="break-all font-semibold">
									{source.title || `Bron ${index + 1}`}
								</h5>
								<p className="mt-1 break-all text-ink/70 text-sm">
									{source.publisher}
								</p>
								<p className="mt-2 break-all text-ink/65 text-xs">
									{source.url}
								</p>
								<a
									href={source.url}
									target="_blank"
									rel="noreferrer"
									onClick={() => actions.markAiSourceChosen(sourceId)}
									className="mt-3 inline-block max-w-full break-all font-semibold text-accent underline underline-offset-4"
								>
									{source.title || `Bron ${index + 1}`}{" "}
									{messages.admin.aiReview.openSource}
								</a>
								{chosen ? (
									<p className="mt-2 text-ink/75 text-sm">
										{messages.admin.aiReview.linkChosen}
									</p>
								) : null}
								<label className="mt-4 flex items-start gap-3">
									<input
										type="checkbox"
										checked={confirmed}
										disabled={!chosen}
										aria-describedby={
											!chosen ? `${sourceId}-confirm-hint` : undefined
										}
										onChange={(event) =>
											actions.setAiSourceConfirmed(
												sourceId,
												event.target.checked,
											)
										}
										className="mt-0.5 size-5 shrink-0 accent-accent"
									/>
									<span className="min-w-0 break-all">
										Ik heb {source.title || `bron ${index + 1}`}{" "}
										{messages.admin.aiReview.confirmSource}
									</span>
								</label>
								{!chosen ? (
									<p
										id={`${sourceId}-confirm-hint`}
										className="mt-2 text-ink/70 text-sm"
									>
										{messages.admin.aiReview.confirmSourceHint}
									</p>
								) : null}
								{status.unrelatedSourceIds.includes(sourceId) ? (
									<p className="mt-3 text-amber-900 text-sm">
										{messages.admin.aiReview.unrelatedSource}
									</p>
								) : null}
							</li>
						);
					})}
				</ul>
			</section>

			<p
				id="ai-review-status"
				tabIndex={-1}
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className={`mt-7 rounded-md border bg-white p-4 font-semibold ${
					status.complete
						? "border-green-800 text-green-950"
						: "border-amber-800 text-amber-950"
				}`}
			>
				{status.complete
					? messages.admin.aiReview.complete
					: messages.admin.aiReview.incomplete}
			</p>
		</section>
	);
}

function claimCanBeConfirmed(
	sourceIds: string[],
	draft: ReturnType<typeof useEventAuthoring>["state"]["draft"],
	sourceReviews: NonNullable<
		ReturnType<typeof useEventAuthoring>["state"]["aiReview"]
	>["sourceReviews"],
) {
	if (sourceIds.length === 0) return false;
	return sourceIds.every((sourceId) => {
		const source = draft.sources.find(
			(item, index) => (item.id ?? `source-${index + 1}`) === sourceId,
		);
		if (!source) return false;
		const url = source.url.trim();
		const sourceReview = sourceReviews.find(
			(item) => item.sourceId === sourceId,
		);
		return sourceReview?.chosenUrl === url && sourceReview.confirmedUrl === url;
	});
}
