export function createSearchRequestSequence() {
	let current = 0;
	return {
		next: () => {
			current += 1;
			return current;
		},
		invalidate: () => {
			current += 1;
			return current;
		},
		isCurrent: (requestId: number) => requestId === current,
	};
}
