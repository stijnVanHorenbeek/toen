export function getRecommendationPagination({
	eventCount,
	isInitialPage,
	offset,
	pageSize,
	totalCount,
}: {
	eventCount: number;
	isInitialPage: boolean;
	offset: number;
	pageSize: number;
	totalCount: number;
}) {
	const pageNumber = Math.floor(offset / pageSize) + 1;
	const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
	const hasPrevious = !isInitialPage && offset > 0;
	const hasNext = !isInitialPage && offset + eventCount < totalCount;
	return {
		pageNumber,
		pageCount,
		hasPrevious,
		hasNext,
		showNavigation: !isInitialPage && (hasPrevious || hasNext),
	};
}
