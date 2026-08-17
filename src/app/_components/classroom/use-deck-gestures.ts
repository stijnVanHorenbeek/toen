import {
	type Dispatch,
	type RefObject,
	type TouchEvent,
	useCallback,
	useEffect,
	useRef,
} from "react";
import { getBeatGestureAction } from "@/lib/beats/keyboard";
import type { BeatRuntimeAction } from "@/lib/beats/runtime";

const GESTURE_IDLE_MS = 300;
const SCROLL_BOUNDARY_EPSILON = 1;
const WHEEL_LINE_PIXELS = 16;
const WHEEL_PAGE_PIXELS = 800;

type UseDeckGesturesInput = {
	canFinish: boolean;
	canGoBack: boolean;
	dispatch: Dispatch<BeatRuntimeAction>;
	enabled: boolean;
	stageRegion: RefObject<HTMLDivElement | null>;
};

type TouchGesture = {
	startX: number;
	startY: number;
	scrolledContent: boolean;
};

function normalizeWheelDelta(event: WheelEvent) {
	const unit =
		event.deltaMode === WheelEvent.DOM_DELTA_LINE
			? WHEEL_LINE_PIXELS
			: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
				? Math.max(
						event.currentTarget instanceof HTMLElement
							? event.currentTarget.clientHeight
							: 0,
						WHEEL_PAGE_PIXELS,
					)
				: 1;
	return { deltaX: event.deltaX * unit, deltaY: event.deltaY * unit };
}

function canScrollVertically(element: HTMLElement, deltaY: number) {
	if (element.scrollHeight <= element.clientHeight + SCROLL_BOUNDARY_EPSILON) {
		return false;
	}
	if (deltaY > 0) {
		return (
			element.scrollTop + element.clientHeight <
			element.scrollHeight - SCROLL_BOUNDARY_EPSILON
		);
	}
	if (deltaY < 0) return element.scrollTop > SCROLL_BOUNDARY_EPSILON;
	return false;
}

export function useDeckGestures({
	canFinish,
	canGoBack,
	dispatch,
	enabled,
	stageRegion,
}: UseDeckGesturesInput) {
	const wheelGesture = useRef<{
		deltaX: number;
		deltaY: number;
		locked: boolean;
		scrolledContent: boolean;
		timer: number | null;
	}>({
		deltaX: 0,
		deltaY: 0,
		locked: false,
		scrolledContent: false,
		timer: null,
	});
	const touchGesture = useRef<TouchGesture | null>(null);

	const dispatchGesture = useCallback(
		(deltaX: number, deltaY: number) => {
			const action = getBeatGestureAction({
				deltaX,
				deltaY,
				canGoBack,
				canFinish,
			});
			if (!action) return false;
			dispatch(action);
			return true;
		},
		[canFinish, canGoBack, dispatch],
	);

	const finishWheelBurstLater = useCallback(() => {
		const gesture = wheelGesture.current;
		if (gesture.timer !== null) window.clearTimeout(gesture.timer);
		gesture.timer = window.setTimeout(() => {
			gesture.deltaX = 0;
			gesture.deltaY = 0;
			gesture.locked = false;
			gesture.scrolledContent = false;
			gesture.timer = null;
		}, GESTURE_IDLE_MS);
	}, []);

	useEffect(() => {
		if (!enabled) return;
		const element = stageRegion.current;
		if (!element) return;
		const handleWheel = (event: WheelEvent) => {
			const gesture = wheelGesture.current;
			const delta = normalizeWheelDelta(event);
			if (gesture.locked) {
				event.preventDefault();
				finishWheelBurstLater();
				return;
			}
			if (canScrollVertically(element, delta.deltaY)) {
				gesture.deltaX = 0;
				gesture.deltaY = 0;
				gesture.scrolledContent = true;
				finishWheelBurstLater();
				return;
			}
			if (gesture.scrolledContent) {
				event.preventDefault();
				finishWheelBurstLater();
				return;
			}
			event.preventDefault();
			gesture.deltaX += delta.deltaX;
			gesture.deltaY += delta.deltaY;
			if (dispatchGesture(gesture.deltaX, gesture.deltaY)) {
				gesture.locked = true;
			}
			finishWheelBurstLater();
		};
		element.addEventListener("wheel", handleWheel, { passive: false });
		return () => element.removeEventListener("wheel", handleWheel);
	}, [dispatchGesture, enabled, finishWheelBurstLater, stageRegion]);

	useEffect(
		() => () => {
			const timer = wheelGesture.current.timer;
			if (timer !== null) window.clearTimeout(timer);
		},
		[],
	);

	return {
		onTouchStart(event: TouchEvent<HTMLDivElement>) {
			if (event.touches.length !== 1) {
				touchGesture.current = null;
				return;
			}
			touchGesture.current = {
				startX: event.touches[0].clientX,
				startY: event.touches[0].clientY,
				scrolledContent: false,
			};
		},
		onTouchMove(event: TouchEvent<HTMLDivElement>) {
			const gesture = touchGesture.current;
			const element = stageRegion.current;
			if (!gesture || !element || event.touches.length !== 1) return;
			const deltaY = gesture.startY - event.touches[0].clientY;
			if (canScrollVertically(element, deltaY)) {
				gesture.scrolledContent = true;
			}
		},
		onTouchEnd(event: TouchEvent<HTMLDivElement>) {
			const gesture = touchGesture.current;
			touchGesture.current = null;
			if (!gesture || event.changedTouches.length !== 1) return;
			const deltaX = gesture.startX - event.changedTouches[0].clientX;
			const deltaY = gesture.startY - event.changedTouches[0].clientY;
			if (gesture.scrolledContent) return;
			const element = stageRegion.current;
			if (element && canScrollVertically(element, deltaY)) return;
			dispatchGesture(deltaX, deltaY);
		},
	};
}
