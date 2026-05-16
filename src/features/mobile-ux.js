/**
 * Feature 7: Mobile UX Improvements
 *
 * Adds swipe gestures, haptic feedback, compact mode detection,
 * and floating bubble for quick access.
 */
const MobileUX = {
  _swipeStartX: 0,
  _swipeStartY: 0,
  _swipeThreshold: 80,
  _compact: false,
  _bubble: null,
  _handlers: [],

  isCompact() {
    return window.innerWidth < 380 || window.innerHeight < 640;
  },

  haptic(type) {
    try {
      if (navigator.vibrate) {
        if (type === "light") navigator.vibrate(10);
        else if (type === "medium") navigator.vibrate(25);
        else if (type === "heavy") navigator.vibrate([30, 10, 30]);
        else navigator.vibrate(15);
      }
    } catch (_) {}
  },

  installSwipe(root) {
    if (!root) return;
    const onTouchStart = (ev) => {
      const touch = ev.touches[0];
      if (!touch) return;
      this._swipeStartX = touch.clientX;
      this._swipeStartY = touch.clientY;
    };

    const onTouchEnd = (ev) => {
      const touch = ev.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - this._swipeStartX;
      const dy = touch.clientY - this._swipeStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Only handle horizontal swipes that are clearly horizontal
      if (absDx < this._swipeThreshold || absDy > absDx * 0.6) return;

      // Don't interfere with scroll areas
      const target = ev.target;
      if (target?.closest?.(".ace-ai-chatlog, .ace-ai-conversation, .ace-ai-tool-diff")) return;

      if (dx > 0) {
        // Swipe right — go back / close panel
        this.haptic("light");
        UI.handleBackAction();
      } else {
        // Swipe left — open review if tools are pending
        if (State.pendingTools.length) {
          this.haptic("light");
          State.activeTab = "changes";
          UI.render(root);
        }
      }
    };

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchend", onTouchEnd, { passive: true });
    this._handlers.push(
      [root, "touchstart", onTouchStart],
      [root, "touchend", onTouchEnd],
    );
  },

  installCompactMode(root) {
    if (!root) return;
    const check = () => {
      const compact = this.isCompact();
      root.classList.toggle("ace-ai-compact-device", compact);
      this._compact = compact;
    };
    check();
    const handler = Util.debounce(check, 300);
    window.addEventListener("resize", handler);
    this._handlers.push([window, "resize", handler]);
  },

  installBubble() {
    // Floating action bubble — alternative to side button
    if (this._bubble) return;
    const bubble = document.createElement("button");
    bubble.className = "ace-ai-bubble";
    bubble.textContent = "✦";
    bubble.setAttribute("aria-label", "Open Ace AI");
    bubble.style.cssText = `
      position:fixed;right:12px;bottom:90px;z-index:2147483000;
      width:44px;height:44px;border-radius:50%;border:1px solid rgba(77,163,255,.5);
      background:rgba(15,17,23,.95);color:#4da3ff;font-size:18px;font-weight:900;
      box-shadow:0 4px 20px rgba(0,0,0,.4);touch-action:manipulation;
      display:flex;align-items:center;justify-content:center;
      transition:transform .15s ease,box-shadow .15s ease;
    `;
    bubble.addEventListener("click", () => {
      this.haptic("medium");
      UI.openPanel("chat");
    });

    // Make it draggable
    let dragging = false;
    let offsetY = 0;
    bubble.addEventListener("touchstart", (ev) => {
      const touch = ev.touches[0];
      offsetY = touch.clientY - bubble.getBoundingClientRect().top;
      dragging = false;
    }, { passive: true });
    bubble.addEventListener("touchmove", (ev) => {
      dragging = true;
      const touch = ev.touches[0];
      const y = Math.max(20, Math.min(window.innerHeight - 60, touch.clientY - offsetY));
      bubble.style.bottom = "auto";
      bubble.style.top = y + "px";
      ev.preventDefault();
    }, { passive: false });
    bubble.addEventListener("touchend", () => {
      if (dragging) {
        dragging = false;
        return;
      }
    });

    document.body.appendChild(bubble);
    this._bubble = bubble;
  },

  removeBubble() {
    if (this._bubble) {
      try { this._bubble.remove(); } catch (_) {}
      this._bubble = null;
    }
  },

  css() {
    if (document.getElementById("ace-ai-style-mobile-ux")) return;
    const style = document.createElement("style");
    style.id = "ace-ai-style-mobile-ux";
    style.textContent = `
.ace-ai-compact-device .ace-ai-msg{padding:8px;font-size:12px}
.ace-ai-compact-device .ace-ai-card{padding:8px}
.ace-ai-compact-device .ace-ai-textarea{min-height:36px;max-height:68px;font-size:12px}
.ace-ai-compact-device .ace-ai-chip{padding:5px 8px;font-size:11px}
.ace-ai-compact-device .ace-ai-iconbtn{min-width:32px;min-height:32px}
.ace-ai-compact-device .ace-ai-brand{font-size:13px}
.ace-ai-compact-device .ace-ai-head{padding:7px 9px}
.ace-ai-voice-btn{display:inline-flex;align-items:center;gap:4px}
.ace-ai-voice-btn.active{border-color:rgba(220,38,38,.6);background:rgba(220,38,38,.12);animation:ace-ai-pulse 1.1s ease-in-out infinite}
.ace-ai-bubble{cursor:pointer}
.ace-ai-bubble:active{transform:scale(.9);box-shadow:0 2px 10px rgba(0,0,0,.3)}
`;
    document.head.appendChild(style);
  },

  cleanup() {
    this._handlers.forEach(([el, event, fn]) => {
      try { el.removeEventListener(event, fn); } catch (_) {}
    });
    this._handlers = [];
    this.removeBubble();
  },
};
