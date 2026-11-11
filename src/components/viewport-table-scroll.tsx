'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ScrollbarBounds = { left: number; width: number; contentWidth: number };

export function ViewportTableScroll({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const scrollbar = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<ScrollbarBounds | null>(null);

  useEffect(() => {
    const target = viewport.current;
    if (!target) return;

    let frame = 0;
    function measure() {
      frame = 0;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const visual = window.visualViewport;
      const bottom = visual ? visual.offsetTop + visual.height : window.innerHeight;
      const left = Math.max(0, rect.left);
      const width = Math.min(document.documentElement.clientWidth, rect.right) - left;
      const visible = target.scrollWidth > target.clientWidth + 1 &&
        rect.top < bottom - 20 && rect.bottom > bottom && width > 0;
      const next = visible ? { left, width, contentWidth: target.scrollWidth } : null;
      setBounds(previous => previous?.left === next?.left && previous?.width === next?.width &&
        previous?.contentWidth === next?.contentWidth ? previous : next);
      if (scrollbar.current && Math.abs(scrollbar.current.scrollLeft - target.scrollLeft) > 1) {
        scrollbar.current.scrollLeft = target.scrollLeft;
      }
    }

    function scheduleMeasure() {
      if (!frame) frame = requestAnimationFrame(measure);
    }

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(target);
    if (target.firstElementChild) observer.observe(target.firstElementChild);
    window.addEventListener('scroll', scheduleMeasure, true);
    window.addEventListener('resize', scheduleMeasure);
    window.visualViewport?.addEventListener('resize', scheduleMeasure);
    window.visualViewport?.addEventListener('scroll', scheduleMeasure);
    scheduleMeasure();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', scheduleMeasure, true);
      window.removeEventListener('resize', scheduleMeasure);
      window.visualViewport?.removeEventListener('resize', scheduleMeasure);
      window.visualViewport?.removeEventListener('scroll', scheduleMeasure);
    };
  }, []);

  return (
    <>
      <div ref={viewport} className="overflow-x-auto">
        {children}
      </div>
      {bounds && createPortal(
        <div
          ref={element => {
            scrollbar.current = element;
            if (element && viewport.current) element.scrollLeft = viewport.current.scrollLeft;
          }}
          role="region"
          aria-label="Cuộn ngang bảng đơn hàng"
          tabIndex={0}
          className="fixed bottom-0 z-30 overflow-x-scroll overflow-y-hidden border-t border-[var(--border)] bg-[var(--card)]"
          style={{ left: bounds.left, width: bounds.width, height: 20 }}
          onScroll={event => {
            if (viewport.current) viewport.current.scrollLeft = event.currentTarget.scrollLeft;
          }}
        >
          <div style={{ width: bounds.contentWidth, height: 1 }} />
        </div>,
        document.body,
      )}
    </>
  );
}
