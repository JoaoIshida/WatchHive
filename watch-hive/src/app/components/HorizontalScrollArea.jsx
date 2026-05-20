"use client";

import { useCallback, useRef } from "react";

const DRAG_THRESHOLD_PX = 6;

/**
 * Horizontal strip with visible x-scrollbar on small screens and drag-to-scroll
 * so touch users can pan without triggering nested links.
 */
export default function HorizontalScrollArea({
    children,
    className = "",
    contentClassName = "",
    ariaLabel,
}) {
    const scrollRef = useRef(null);
    const dragRef = useRef({
        pending: false,
        active: false,
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        moved: false,
        pointerId: null,
    });

    const onPointerDown = useCallback((e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const el = scrollRef.current;
        if (!el) return;

        dragRef.current = {
            pending: true,
            active: false,
            startX: e.clientX,
            startY: e.clientY,
            scrollLeft: el.scrollLeft,
            moved: false,
            pointerId: e.pointerId,
        };
    }, []);

    const onPointerMove = useCallback((e) => {
        const drag = dragRef.current;
        if (!drag.pending && !drag.active) return;

        const el = scrollRef.current;
        if (!el) return;

        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;

        if (drag.pending && !drag.active) {
            if (
                Math.abs(dx) < DRAG_THRESHOLD_PX &&
                Math.abs(dy) < DRAG_THRESHOLD_PX
            ) {
                return;
            }
            if (Math.abs(dy) > Math.abs(dx)) {
                drag.pending = false;
                return;
            }
            drag.pending = false;
            drag.active = true;
            el.setPointerCapture(e.pointerId);
        }

        if (!drag.active) return;

        if (Math.abs(dx) > DRAG_THRESHOLD_PX) {
            drag.moved = true;
        }
        el.scrollLeft = drag.scrollLeft - dx;
    }, []);

    const endDrag = useCallback(() => {
        const drag = dragRef.current;
        if (!drag.pending && !drag.active) return;

        const el = scrollRef.current;
        if (el && drag.active && drag.pointerId != null) {
            try {
                el.releasePointerCapture(drag.pointerId);
            } catch {
                /* capture already released */
            }
        }

        drag.pending = false;
        drag.active = false;
        drag.pointerId = null;
    }, []);

    const onClickCapture = useCallback((e) => {
        if (dragRef.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            dragRef.current.moved = false;
        }
    }, []);

    return (
        <div
            ref={scrollRef}
            role="region"
            className={`horizontal-scroll-touch ${className}`.trim()}
            aria-label={ariaLabel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={onClickCapture}
        >
            <div
                className={`horizontal-scroll-content ${contentClassName}`.trim()}
            >
                {children}
            </div>
        </div>
    );
}
