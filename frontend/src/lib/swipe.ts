/**
 * Svelte action for swipe gestures
 * Usage: <div use:swipe={{ onSwipeLeft, onSwipeRight }}>
 */

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;  // minimum px to trigger (default 60)
  maxVertical?: number; // max vertical drift (default 80)
}

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  isDragging: boolean;
  el: HTMLElement;
}

export function swipe(node: HTMLElement, options: SwipeOptions) {
  const threshold = options.threshold ?? 60;
  const maxVertical = options.maxVertical ?? 80;

  let state: SwipeState = {
    startX: 0,
    startY: 0,
    currentX: 0,
    isDragging: false,
    el: node
  };

  function handleStart(e: TouchEvent | MouseEvent) {
    const point = 'touches' in e ? e.touches[0] : e;
    state.startX = point.clientX;
    state.startY = point.clientY;
    state.currentX = 0;
    state.isDragging = true;
    node.style.transition = 'none';
  }

  function handleMove(e: TouchEvent | MouseEvent) {
    if (!state.isDragging) return;
    
    const point = 'touches' in e ? e.touches[0] : e;
    const deltaX = point.clientX - state.startX;
    const deltaY = Math.abs(point.clientY - state.startY);
    
    // Cancel if too much vertical movement
    if (deltaY > maxVertical) {
      handleEnd();
      return;
    }

    state.currentX = deltaX;
    
    // Visual feedback - limit to ±100px
    const clampedX = Math.max(-100, Math.min(100, deltaX));
    node.style.transform = `translateX(${clampedX}px)`;
    
    // Color hint
    if (deltaX < -threshold * 0.5) {
      node.style.background = 'rgba(244,63,94,0.08)';
    } else if (deltaX > threshold * 0.5) {
      node.style.background = 'rgba(34,197,94,0.08)';
    } else {
      node.style.background = '';
    }
  }

  function handleEnd() {
    if (!state.isDragging) return;
    state.isDragging = false;
    
    node.style.transition = 'transform 0.3s ease, background 0.3s ease';
    node.style.transform = 'translateX(0)';
    node.style.background = '';

    if (state.currentX < -threshold) {
      // Swipe left → delete hint
      options.onSwipeLeft?.();
    } else if (state.currentX > threshold) {
      // Swipe right → edit hint
      options.onSwipeRight?.();
    }
  }

  node.addEventListener('touchstart', handleStart, { passive: true });
  node.addEventListener('touchmove', handleMove, { passive: true });
  node.addEventListener('touchend', handleEnd);

  return {
    update(newOptions: SwipeOptions) {
      options = newOptions;
    },
    destroy() {
      node.removeEventListener('touchstart', handleStart);
      node.removeEventListener('touchmove', handleMove);
      node.removeEventListener('touchend', handleEnd);
    }
  };
}
