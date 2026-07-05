/**
 * Svelte action for swipe gestures (touch + mouse)
 * Usage: <div use:swipe={{ onSwipeLeft, onSwipeRight }}>
 */

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  maxVertical?: number;
}

export function swipe(node: HTMLElement, options: SwipeOptions) {
  let threshold = options.threshold ?? 60;
  let maxVertical = options.maxVertical ?? 80;

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isDragging = false;

  function getPoint(e: TouchEvent | MouseEvent) {
    return 'touches' in e ? e.touches[0] : e;
  }

  function updateActions(deltaX: number) {
    const parent = node.parentElement;
    if (!parent) return;
    const editEl = parent.querySelector<HTMLElement>('.tx-action--edit');
    const deleteEl = parent.querySelector<HTMLElement>('.tx-action--delete');
    const progress = Math.min(Math.abs(deltaX) / threshold, 1);

    if (deltaX > 0 && editEl) {
      editEl.style.opacity = String(progress);
      if (deleteEl) deleteEl.style.opacity = '0';
    } else if (deltaX < 0 && deleteEl) {
      deleteEl.style.opacity = String(progress);
      if (editEl) editEl.style.opacity = '0';
    } else {
      if (editEl) editEl.style.opacity = '0';
      if (deleteEl) deleteEl.style.opacity = '0';
    }
  }

  function resetActions() {
    const parent = node.parentElement;
    if (!parent) return;
    const editEl = parent.querySelector<HTMLElement>('.tx-action--edit');
    const deleteEl = parent.querySelector<HTMLElement>('.tx-action--delete');
    if (editEl) editEl.style.opacity = '0';
    if (deleteEl) deleteEl.style.opacity = '0';
  }

  function onStart(e: TouchEvent | MouseEvent) {
    const p = getPoint(e);
    startX = p.clientX;
    startY = p.clientY;
    currentX = 0;
    isDragging = true;
    node.style.transition = 'none';
    node.style.cursor = 'grabbing';
  }

  function onMove(e: TouchEvent | MouseEvent) {
    if (!isDragging) return;
    const p = getPoint(e);
    const dX = p.clientX - startX;
    const dY = Math.abs(p.clientY - startY);

    if (dY > maxVertical) { onEnd(); return; }

    currentX = dX;
    const clamped = Math.max(-110, Math.min(110, dX));
    node.style.transform = `translateX(${clamped}px)`;
    updateActions(dX);
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;

    node.style.transition = 'transform 0.3s cubic-bezier(.25,.8,.25,1)';
    node.style.transform = 'translateX(0)';
    node.style.cursor = 'grab';
    resetActions();

    if (currentX < -threshold) options.onSwipeLeft?.();
    else if (currentX > threshold) options.onSwipeRight?.();
  }

  // Touch events
  node.addEventListener('touchstart', onStart, { passive: true });
  node.addEventListener('touchmove', onMove, { passive: true });
  node.addEventListener('touchend', onEnd);

  // Mouse events — listen on document for move/up so drag works outside element
  node.addEventListener('mousedown', onStart);
  const onMouseMove = (e: MouseEvent) => onMove(e);
  const onMouseUp = () => onEnd();
  node.addEventListener('mousedown', () => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp, { once: true });
    document.addEventListener('mouseup', () => {
      document.removeEventListener('mousemove', onMouseMove);
    }, { once: true });
  });

  // Prevent text selection while dragging
  node.style.userSelect = 'none';
  node.style.cursor = 'grab';

  return {
    update(newOptions: SwipeOptions) {
      options = newOptions;
      threshold = newOptions.threshold ?? 60;
      maxVertical = newOptions.maxVertical ?? 80;
    },
    destroy() {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('mousedown', onStart);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  };
}
