import { useRef, useCallback } from "react";

interface Options {
  threshold?: number;
  onLongPress: () => void;
  onClick?: () => void;
}

/**
 * Returns handlers that detect both tap (click) and long-press (~500ms).
 * Works on touch and mouse. Cancels long-press on movement.
 */
export function useLongPress({ threshold = 500, onLongPress, onClick }: Options) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggered = useRef(false);

  const start = useCallback(() => {
    triggered.current = false;
    timer.current = setTimeout(() => {
      triggered.current = true;
      onLongPress();
    }, threshold);
  }, [threshold, onLongPress]);

  const clear = useCallback((fireClick: boolean) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (fireClick && !triggered.current && onClick) onClick();
  }, [onClick]);

  return {
    onMouseDown: start,
    onMouseUp: () => clear(true),
    onMouseLeave: () => clear(false),
    onTouchStart: start,
    onTouchEnd: () => clear(true),
    onTouchMove: () => clear(false),
  };
}
