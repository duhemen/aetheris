/* ============================================================
   Aetheris v10.1 — Buttons Fix
   Fix pointer-events inheritance di topRightStack
   ============================================================ */

(function() {
  'use strict';

  // 1. Fix parent — hapus pointer-events:none
  function fixStack() {
    const stack = document.getElementById('topRightStack');
    if (!stack) return false;

    // Hapus pointer-events: none dari parent
    stack.style.pointerEvents = 'auto';

    // Force setiap child clickable
    Array.from(stack.children).forEach(child => {
      child.style.pointerEvents = 'auto';
      child.style.cursor = child.style.cursor || 'pointer';
      // Pastikan z-index di atas
      child.style.zIndex = '41';
    });

    // Fix FAB stack juga
    const fab = document.getElementById('fabStack');
    if (fab) {
      fab.style.pointerEvents = 'auto';
      Array.from(fab.children).forEach(child => {
        child.style.pointerEvents = 'auto';
      });
    }
    return true;
  }

  // 2. Jalankan saat DOM ready + retry
  let attempts = 0;
  const maxAttempts = 50;
  function tryFix() {
    attempts++;
    const ok = fixStack();
    if (!ok && attempts < maxAttempts) {
      setTimeout(tryFix, 100);
      return;
    }
    if (ok) console.log('[Buttons-Fix] ✅ Applied');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryFix);
  } else {
    tryFix();
  }

  // 3. Watch untuk tombol baru yang di-inject nanti
  const observer = new MutationObserver(() => {
    fixStack();
  });

  setTimeout(() => {
    const stack = document.getElementById('topRightStack');
    if (stack) {
      observer.observe(stack, { childList: true, subtree: false });
      console.log('[Buttons-Fix] 👁️ Watching for new buttons');
    }
  }, 1500);

  // 4. Emergency debug helper
  window.AETHERIS_BUTTONS_DEBUG = function() {
    const stack = document.getElementById('topRightStack');
    if (!stack) return 'No stack';
    const info = {
      stackPE: getComputedStyle(stack).pointerEvents,
      stackZ: getComputedStyle(stack).zIndex,
      children: Array.from(stack.children).map(c => ({
        id: c.id,
        tag: c.tagName,
        text: c.textContent?.trim().slice(0, 20),
        pe: getComputedStyle(c).pointerEvents,
        display: getComputedStyle(c).display,
        rect: c.getBoundingClientRect().toJSON(),
      })),
    };
    console.table(info.children);
    return info;
  };
})();