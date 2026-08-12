/* Veylin — progressive enhancement only.
   Every section renders and functions with JavaScript disabled; this file adds
   the behaviour the markup hints at. No dependencies.

   The nav's bag and search are real links to /cart and /search, and the search
   overlay wraps a real GET form. Nothing below is load-bearing for a visitor
   without scripting — it only upgrades those destinations into overlays. */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function root() {
    var r = window.Shopify && window.Shopify.routes && window.Shopify.routes.root;
    return r || '/';
  }

  function safeStore(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  /* ---- Scroll lock -------------------------------------------------
     Reference-counted, because the menu, the drawer, search and the
     newsletter can each want it and the last one to close must be the
     one that releases it. */

  var locks = Object.create(null);

  function setLock(key, on) {
    var had = Object.keys(locks).length > 0;
    if (on) locks[key] = true; else delete locks[key];
    var has = Object.keys(locks).length > 0;
    if (has === had) return;

    var html = document.documentElement;
    if (has) {
      var barWidth = window.innerWidth - html.clientWidth;
      html.style.overflow = 'hidden';
      if (barWidth > 0) document.body.style.paddingRight = barWidth + 'px';
    } else {
      html.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }

  /* ---- Focus trap --------------------------------------------------- */

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function focusables(container) {
    return Array.prototype.filter.call(
      container.querySelectorAll(FOCUSABLE),
      function (el) { return el.offsetParent !== null || el === document.activeElement; }
    );
  }

  function trapFocus(container, event) {
    var items = focusables(container);
    if (!items.length) return;

    var first = items[0];
    var last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---- Waiting for an exit animation --------------------------------
     Overlays close over wildly different durations — the menu empties row
     by row, the drawer slides, the banner just fades — and several of them
     animate a child rather than the root. Rather than keep a table of
     magic numbers in step with the stylesheet, ask the element what is
     actually running and wait for it. The timeout is a backstop for a
     cancelled or stalled animation, never the normal path. */

  function afterAnimations(el, fallbackMs, done) {
    if (reduceMotion.matches) { done(); return; }

    var running = [];
    try {
      if (el.getAnimations) {
        running = el.getAnimations({ subtree: true }).filter(function (a) {
          return a.playState === 'running' || a.playState === 'paused';
        });
      }
    } catch (e) { running = []; }

    if (!running.length || !window.Promise) {
      window.setTimeout(done, fallbackMs);
      return;
    }

    var settled = false;
    function finish() {
      if (settled) return;
      settled = true;
      done();
    }

    Promise.all(running.map(function (a) {
      return a.finished.catch(function () {});
    })).then(finish);

    window.setTimeout(finish, fallbackMs);
  }

  /* Handing one state over to another behind a fade: what is on screen leaves,
     the change happens while nothing is showing, and what arrives plays its own
     entrance. The bag drawer does this when its contents are replaced wholesale
     — the count, the lines and the footer all change at once — and the row
     carousel does it when one page of cards gives way to the next.

     Both callers do the same two things first: set the attribute that plays the
     leaving animation, then call this with the duration the stylesheet gives
     that animation, so the fallback and the CSS land together.

     The reflow is the part that is easy to lose. `afterAnimations()` asks the
     element for its running animations the moment it is called, and one matched
     by an attribute set in the same tick does not exist until the style has been
     recalculated — so without reading a layout property first there is nothing
     to wait for and the change lands in the very frame the fade was supposed to
     cover. Reduced motion needs no branch here: `afterAnimations` calls back
     immediately, so the state simply changes. */
  function afterFade(el, fallbackMs, done) {
    void el.offsetWidth;
    afterAnimations(el, fallbackMs, done);
  }

  /* ---- Overlays ------------------------------------------------------
     One controller for every layer that opens over the page: the menu,
     search, the bag drawer, the newsletter modal and the cookie notice.

     Markup contract
       [data-overlay="name"]        the root. Carries `hidden` when closed,
                                    which is what keeps its contents out of
                                    the tab order and the accessibility tree.
       [data-overlay-modal]         locks scrolling, traps focus, closes on
                                    Escape. Without it the layer is a notice
                                    that sits alongside the page (the cookie
                                    banner), not a dialog that owns it.
       [data-overlay-close="name"]  any control that dismisses it.
       [data-overlay-open="name"]   any control that opens it.
       data-storage-key             opt in to showing itself once per visitor.
       data-delay                   milliseconds before it does.

     A layer that paints the whole viewport must not carry a colour scheme
     class on its root — that would fill the screen with an opaque colour and
     the veil would have nothing to veil. The scheme belongs to the panel. */

  var overlays = Object.create(null);

  function openerButtons(name) {
    return document.querySelectorAll('[data-overlay-open="' + name + '"]');
  }

  function registerOverlay(el) {
    var name = el.dataset.overlay;
    if (!name) return;

    /* The theme editor replaces section markup wholesale. A registration
       pointing at a detached element would silently stop working, so it is
       replaced rather than kept. */
    if (overlays[name]) {
      if (overlays[name].el === el || document.contains(overlays[name].el)) return;
      delete overlays[name];
    }

    var isModal = el.hasAttribute('data-overlay-modal');
    var storageKey = el.dataset.storageKey || '';
    var closing = false;
    var lastFocus = null;

    function syncOpeners(expanded) {
      Array.prototype.forEach.call(openerButtons(name), function (btn) {
        if (btn.hasAttribute('aria-expanded')) {
          btn.setAttribute('aria-expanded', String(expanded));
        }
      });
    }

    function open() {
      if (!el.hidden && !closing) return;

      /* Only one dialog at a time. A notice may sit under one. */
      if (isModal) {
        Object.keys(overlays).forEach(function (other) {
          if (other !== name && overlays[other].isModal) overlays[other].close(false);
        });
      }

      lastFocus = document.activeElement;
      closing = false;
      el.hidden = false;
      el.classList.remove('is-closing');
      syncOpeners(true);

      if (isModal) setLock(name, true);
      el.dispatchEvent(new CustomEvent('overlay:open', { bubbles: true }));

      if (!isModal) return;

      /* setTimeout rather than rAF: animation frames are paused while the
         tab is not compositing, which would leave focus stranded on the
         page behind the overlay. */
      window.setTimeout(function () {
        var target = el.querySelector('[data-overlay-autofocus]') ||
                     el.querySelector('[data-overlay-close]') ||
                     el;
        if (target.focus) {
          /* Focus belongs in every modal immediately, but it is not a visitor
             asking to see that control's tooltip. The marker exists only for
             this synchronous focus event; tabbing back later remains genuine
             keyboard focus and raises the tip normally. */
          target.setAttribute('data-tip-silent-focus', '');
          target.focus();
          target.removeAttribute('data-tip-silent-focus');
        }
      }, 0);
    }

    function finishClose() {
      closing = false;
      el.hidden = true;
      el.classList.remove('is-closing');
      if (isModal) setLock(name, false);
      el.dispatchEvent(new CustomEvent('overlay:close', { bubbles: true }));
      if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
      lastFocus = null;
    }

    function close(remember) {
      if (el.hidden || closing) return;
      if (remember && storageKey) {
        safeStore(function () { sessionStorage.setItem(storageKey, 'dismissed'); });
      }
      closing = true;
      syncOpeners(false);

      /* Move focus out before the element goes away, so it never lands on
         document.body by default. */
      if (isModal && el.contains(document.activeElement) && document.activeElement.blur) {
        document.activeElement.blur();
      }

      if (reduceMotion.matches) { finishClose(); return; }

      el.classList.add('is-closing');
      afterAnimations(el, 1400, function () {
        if (closing) finishClose();
      });
    }

    overlays[name] = {
      open: open,
      close: close,
      el: el,
      isModal: isModal,
      isOpen: function () { return !el.hidden && !closing; }
    };

    if (isModal) {
      document.addEventListener('keydown', function (event) {
        if (el.hidden || closing) return;
        if (event.key === 'Escape') { event.preventDefault(); close(true); }
        else if (event.key === 'Tab') trapFocus(el, event);
      });
    }

    /* Show itself once per visitor, if it asked to. */
    if (storageKey) {
      var seen = safeStore(function () {
        return localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
      }, null);
      var delay = parseInt(el.dataset.delay, 10) || 0;
      if (!seen) window.setTimeout(open, delay);
    }
  }

  function bindOnce(el, key) {
    if (el.dataset[key] === 'true') return false;
    el.dataset[key] = 'true';
    return true;
  }

  function initOverlays(scope) {
    scope.querySelectorAll('[data-overlay]').forEach(registerOverlay);
  }

  /* The controls are delegated from the document and bound once, never bound
     to the elements themselves.

     An overlay's own markup does not stay put: theme.js re-renders the bag
     drawer's contents after every cart change and swaps them in, and the
     theme editor replaces a whole section on reload. A listener bound to a
     close button therefore dies with the markup it was bound to — the drawer's
     close button was live at boot and dead from the first add to bag onwards,
     leaving only the veil to dismiss it. Delegation is what the cart handlers
     already do, and for the same reason.

     Following a link out of an overlay is handled here too, so a link that
     arrives in re-rendered markup closes the overlay behind it like any
     other. The two bag triggers are the exception: they open an overlay
     rather than leaving for a page. */
  function initOverlayTriggers() {
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var close = target.closest('[data-overlay-close]');
      if (close) {
        var closing = overlays[close.dataset.overlayClose];
        if (closing) closing.close(true);
        return;
      }

      var open = target.closest('[data-overlay-open]');
      if (open) {
        var opening = overlays[open.dataset.overlayOpen];
        if (opening) {
          event.preventDefault();
          opening.open();
        }
        return;
      }

      var link = target.closest('[data-overlay] a[href]');
      if (!link) return;
      if (link.hasAttribute('data-drawer-open') || link.hasAttribute('data-search-open')) return;

      var host = link.closest('[data-overlay]');
      var leaving = host && overlays[host.dataset.overlay];
      if (leaving) leaving.close(false);
    });
  }

  /* ---- Navigation: pill / bar ---------------------------------------
     Pill and bar are two states of one element, not two elements:
     .nav--pill transitions width, height, offset, radius and padding, so
     the morph runs rather than swapping nodes.

     The morph goes pill first, bar second — the floating pill sits over the
     hero and expands into the full bar once the hero has been scrolled past.
     Liquid emits the resting state, so the first paint is already correct
     and a nav that never changes needs nothing from this file.

     Where the page offers an anchor — the hero wordmark — the threshold is
     the bottom of it rather than an arbitrary distance, so the nav expands
     exactly as the title leaves. The setting is the fallback. */

  function initNav() {
    var nav = document.querySelector('[data-nav]');
    if (!nav || (nav.dataset.navMode || 'bar') !== 'morph') return;
    if (!bindOnce(nav, 'boundScroll')) return;

    var fallback = parseInt(nav.dataset.navThreshold, 10);
    if (isNaN(fallback)) fallback = 60;

    var ticking = false;

    function threshold() {
      var anchor = document.querySelector('[data-nav-anchor]');
      if (!anchor) return fallback;
      var box = anchor.getBoundingClientRect();
      return Math.max(0, box.bottom + window.scrollY - 80);
    }

    function apply() {
      ticking = false;
      var past = window.scrollY > threshold();
      nav.classList.toggle('nav--pill', !past);
      nav.classList.toggle('is-solid', past);
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }, { passive: true });

    window.addEventListener('resize', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }, { passive: true });

    apply();
  }

  /* ---- Search overlay ------------------------------------------------
     Typing asks Shopify to render sections/predictive-search.liquid and
     swaps the rows in. No client-side index, and money, translation and
     image sizing stay in Liquid where they belong.

     The resting state — the design's Browse and Featured pieces — is
     already in the document, so opening shows something immediately. */

  function initSearch() {
    var overlay = document.querySelector('[data-overlay="search"]');
    if (!overlay || !bindOnce(overlay, 'boundSearch')) return;

    var input = overlay.querySelector('[data-search-input]');
    var form = overlay.querySelector('[data-search-form]');
    var resting = overlay.querySelector('[data-search-resting]');
    var live = overlay.querySelector('[data-search-live]');
    var count = overlay.querySelector('[data-search-count]');
    var popular = overlay.querySelector('[data-search-popular]');
    var scroller = overlay.querySelector('[data-search-scroller]');
    /* The one loading mark, sitting in the field. Rendered by Liquid and
       hidden until a query is actually in flight. */
    var waiting = overlay.querySelector('[data-search-loading]');
    if (!input || !live) return;

    input.setAttribute('data-overlay-autofocus', '');

    var selected = -1;
    var timer = null;
    var controller = null;
    var lastQuery = null;

    function rows() {
      var host = live.hidden ? resting : live;
      return host ? Array.prototype.slice.call(host.querySelectorAll('[data-search-row]')) : [];
    }

    function paintSelection() {
      var list = rows();
      list.forEach(function (row, i) {
        var on = i === selected;
        row.classList.toggle('is-selected', on);
        if (on) row.setAttribute('aria-current', 'true');
        else row.removeAttribute('aria-current');
      });

      if (selected < 0 || !list[selected] || !scroller) return;

      var row = list[selected];
      var box = scroller.getBoundingClientRect();
      var rect = row.getBoundingClientRect();
      if (rect.top < box.top + 6) scroller.scrollTop += rect.top - box.top - 10;
      else if (rect.bottom > box.bottom - 6) scroller.scrollTop += rect.bottom - box.bottom + 10;
    }

    function move(step) {
      var list = rows();
      if (!list.length) return;
      selected = (selected + step + list.length) % list.length;
      paintSelection();
    }

    function wait(on) {
      if (waiting) waiting.hidden = !on;
    }

    function showResting() {
      wait(false);
      live.hidden = true;
      live.innerHTML = '';
      if (resting) resting.hidden = false;
      if (popular) popular.hidden = false;
      if (count) { count.hidden = true; count.textContent = ''; }
      selected = -1;
      paintSelection();
    }

    function render(html) {
      live.innerHTML = html;
      live.hidden = false;
      blurUp(live, true);
      if (resting) resting.hidden = true;
      if (popular) popular.hidden = true;

      var inner = live.querySelector('[data-search-live-inner]');
      var total = inner ? parseInt(inner.dataset.searchTotal, 10) : 0;
      if (count) {
        count.hidden = !(total > 0);
        count.textContent = total > 0 ? inner.dataset.searchCountLabel : '';
      }

      selected = rows().length ? 0 : -1;
      if (scroller) scroller.scrollTop = 0;
      paintSelection();
    }

    function search(query) {
      if (query === lastQuery) return;
      lastQuery = query;

      if (!query) { showResting(); return; }

      if (controller && controller.abort) controller.abort();
      controller = window.AbortController ? new AbortController() : null;
      wait(true);

      var url = root() + 'search/suggest' +
        '?q=' + encodeURIComponent(query) +
        '&section_id=predictive-search' +
        '&resources[type]=product,collection,page,article' +
        '&resources[limit]=10' +
        '&resources[options][unavailable_products]=last';

      fetch(url, controller ? { signal: controller.signal } : undefined)
        .then(function (res) { return res.ok ? res.text() : Promise.reject(res.status); })
        .then(function (text) {
          wait(false);
          var doc = new DOMParser().parseFromString(text, 'text/html');
          var inner = doc.querySelector('[data-search-live-inner]');
          render(inner ? inner.outerHTML : '');
        })
        .catch(function (err) {
          /* An abort means a newer query has already taken the mark on: it is
             still waiting, just for something else. */
          if (err && err.name === 'AbortError') return;
          wait(false);
          /* The form is still a real search form — let it do the work. */
          showResting();
        });
    }

    input.addEventListener('input', function () {
      window.clearTimeout(timer);
      var query = input.value.trim();
      timer = window.setTimeout(function () { search(query); }, 200);
    });

    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
      else if (event.key === 'Enter') {
        var list = rows();
        var row = list[selected];
        if (row) { event.preventDefault(); row.click(); }
        /* Otherwise the form submits and lands on the search page. */
      }
    });

    if (form) {
      form.addEventListener('submit', function () {
        /* Leaving for the search page — do not leave the overlay mounted. */
        var target = overlays.search;
        if (target) target.close(false);
      });
    }

    if (popular) {
      popular.querySelectorAll('[data-search-term]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          input.value = btn.dataset.searchTerm;
          input.focus();
          window.clearTimeout(timer);
          search(input.value.trim());
        });
      });
    }

    overlay.addEventListener('overlay:open', function () {
      input.value = '';
      lastQuery = null;
      showResting();
    });

  }

  /* Document-level wiring, bound once for the life of the page. Kept apart
     from the per-element setup above because the theme editor re-runs that
     on every section reload, and a listener added there would stack up. */

  function initSearchTriggers() {
    /* Any link that would go to the search page opens the overlay instead. */
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest && event.target.closest('[data-search-open]');
      if (!trigger || !overlays.search) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

      event.preventDefault();
      if (trigger.hasAttribute('data-from-menu') && overlays.menu) overlays.menu.close(false);
      overlays.search.open();
    });

    /* The design's shortcuts: ⌘K or Ctrl-K anywhere, / when not typing. */
    document.addEventListener('keydown', function (event) {
      var target = overlays.search;
      if (!target) return;

      if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault();
        if (target.isOpen()) target.close(false); else target.open();
        return;
      }

      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target.isOpen()) return;

      var el = event.target;
      var tag = el && el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;

      event.preventDefault();
      target.open();
    });
  }

  /* ---- Bag drawer -----------------------------------------------------
     Quantities are never recomputed here. Every change posts to the cart
     and asks Shopify to re-render the drawer section, so line prices, the
     subtotal and any discount are Liquid's numbers.

     Removal collapses the row first and drops the line after, which is why
     the row is a grid with an animatable 1fr → 0fr track. */

  var cartBusy = false;

  function cartDrawer() {
    return document.querySelector('[data-cart-drawer]');
  }

  function cartCounts(value, announcement) {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = value;
      el.hidden = value === 0;
    });

    /* Say it as well as show it. The sentence is rendered by Liquid and
       carried on the re-rendered markup, so the pluralisation and the
       translation never happen here — the same reason the product card's
       Add to Bag labels ride on data attributes.

       Skipped on first paint: the region is empty until a change actually
       happens, or every page load would announce the bag to nobody who
       asked. */
    if (announcement == null) return;
    document.querySelectorAll('[data-cart-status]').forEach(function (el) {
      /* Re-announce even when the sentence is unchanged — two of the same
         piece added in a row is still two events, and a live region only
         speaks when its content differs. */
      if (el.textContent === announcement) el.textContent = '';
      el.textContent = announcement;
    });
  }

  /* Swap in the freshly rendered section, and take the item count from it.
     The markup Shopify has just rendered is the only account of the cart
     worth trusting. */
  function applyCartSection(payload) {
    var drawer = cartDrawer();
    if (!drawer) return;

    var html = payload && payload.sections && payload.sections[drawer.dataset.sectionId];
    if (!html) return;

    var doc = new DOMParser().parseFromString(html, 'text/html');
    var next = doc.querySelector('[data-drawer-contents]');
    var current = drawer.querySelector('[data-drawer-contents]');
    if (!next || !current) return;

    function swap() {
      /* The whole subtree is replaced, so the scrolled list would otherwise
         jump back to the top on every step. */
      var scroller = drawer.querySelector('[data-drawer-scroller]');
      var scrolled = scroller ? scroller.scrollTop : 0;

      var figure = current.querySelector('[data-drawer-subtotal]');
      var was = figure ? figure.textContent : null;

      current.innerHTML = next.innerHTML;
      blurUp(current, true);

      if (scroller) scroller.scrollTop = scrolled;

      /* A step that moves the money gets a beat on the figure. Guarded on the
         text actually differing, so nothing twitches when it has not. */
      var now = current.querySelector('[data-drawer-subtotal]');
      if (now && was !== null && now.textContent !== was && !reduceMotion.matches) {
        now.setAttribute('data-cart-changed', '');
        void now.offsetWidth;
        afterAnimations(now, 320, function () {
          now.removeAttribute('data-cart-changed');
        });
      }

      var source = current.querySelector('[data-cart-count-value]');
      if (source) {
        cartCounts(
          parseInt(source.dataset.cartCountValue, 10) || 0,
          source.dataset.cartAnnounce
        );
      }
    }

    /* Emptying the bag — or filling it from empty — changes the whole panel at
       once: the count leaves the header, the list becomes a message, and the
       whole footer goes. Swapping that in one frame reads as a jolt, and no
       amount of animation on the arriving empty state fixes it, because the
       outgoing markup never animates at all: it is simply replaced.

       So the panel hands over instead. The contents fade out, the swap happens
       while nothing is on screen, and the empty state's own staggered entrance
       carries it back in. A step between two non-zero quantities is untouched
       and stays instant — a number changing is not a state change, and fading
       the panel on every press would be worse than the jolt. */
    /* Removing the last line starts the hand-over at the press — see remove()
       — so by the time the response lands the fade is already running. */
    var handingOver = current.hasAttribute('data-cart-swapping');

    if (!handingOver) {
      var wasEmpty = !current.querySelector('[data-cart-line]');
      var willBeEmpty = !next.querySelector('[data-cart-line]');
      if (wasEmpty === willBeEmpty || reduceMotion.matches) { swap(); return; }

      current.setAttribute('data-cart-swapping', '');
    }

    /* The fallback is the stylesheet's own 180ms, so both paths land together
       whether or not getAnimations() reports the fade. `afterFade` is what
       forces the style recalculation that makes the fade findable — see it for
       why that matters. */
    afterFade(current, 180, function () {
      swap();
      current.removeAttribute('data-cart-swapping');

      /* And the arriving markup fades in rather than appearing. Dropping this
         attribute afterwards is a no-op — the entrance ends at opacity 1 —
         which is what keeps the hand-over from flashing in either direction. */
      current.setAttribute('data-cart-arriving', '');

      afterFade(current, 300, function () {
        current.removeAttribute('data-cart-arriving');
      });
    });
  }

  /* ---- Changing a quantity ---------------------------------------------
     Every change still posts and every figure still comes back from Liquid —
     nothing here does arithmetic on a price. What this adds is that a second
     press while the first is in flight is no longer *dropped*: it is held and
     sent when the line is free, and presses inside the same beat coalesce into
     one request. Pressing + three times quickly used to move the bag by one.

     The number under the pointer is updated on the press, so the control
     answers immediately; the re-render that follows is still the authority and
     overwrites it. */

  var cartPending = null;
  var cartTimer = null;
  var CART_COALESCE = 220;

  function flushCartChange() {
    cartTimer = null;
    if (cartBusy || !cartPending) return;

    var job = cartPending;
    cartPending = null;
    changeLine(job.line, job.quantity);
  }

  function queueLine(line, quantity, immediate) {
    cartPending = { line: line, quantity: quantity };

    if (cartTimer) { window.clearTimeout(cartTimer); cartTimer = null; }
    if (immediate) { flushCartChange(); return; }

    cartTimer = window.setTimeout(flushCartChange, CART_COALESCE);
  }

  function changeLine(line, quantity) {
    var drawer = cartDrawer();
    if (!drawer) return;

    /* Held rather than dropped — the lock used to lose the press entirely. */
    if (cartBusy) { cartPending = { line: line, quantity: quantity }; return; }
    cartBusy = true;

    fetch(root() + 'cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        line: line,
        quantity: quantity,
        sections: drawer.dataset.sectionId
      })
    })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(applyCartSection)
      .catch(function () {
        /* Rather than guess at what the cart now holds, go to the page that
           can always tell the truth. */
        cartPending = null;
        window.location.href = root() + 'cart';
      })
      .then(function () {
        cartBusy = false;
        if (cartPending) flushCartChange();
      });
  }

  /* Every handler below is delegated from the document, so a section reload
     in the theme editor cannot leave a listener pointing at detached markup
     or stack a second copy on top. */

  /* ---- Claiming a click before an app can steal it --------------------
     The ring-builder app extension turns every internal link into its own
     "page transition": `key-common-global.js` registers

         document.addEventListener("click", handlePageTransitionClick, true)

     — in the **capture** phase — and on any `a[href]` it calls preventDefault
     and then `setTimeout(() => window.location.href = …)`.

     Every trigger in this theme is deliberately a real link, so all of them
     match. Capture runs before the delegated handlers below, so the sequence
     was: the app schedules a navigation, this theme opens the overlay, the
     timer fires. That is the drawer flashing open and the page going to /cart
     anyway — and the same for search, quick view and the metal swatches.

     The app does check `if (event.defaultPrevented) return`, so claiming the
     click first is enough; we do not have to fight it. Hence a capture listener
     of our own, registered **here at module scope rather than inside init()**:
     both scripts are `defer`, deferred scripts run in document order, and
     theme.js is script #2 against the app's #44 — so this registers first and,
     being on the same node in the same phase, runs first.

     It only claims a click the theme is actually going to handle, tested with
     the same conditions as the handlers themselves. A trigger whose overlay is
     absent stays an ordinary link and still navigates. */

  document.addEventListener('click', function (event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof event.button === 'number' && event.button !== 0) return;

    var el = event.target.closest && event.target.closest(
      '[data-drawer-open],[data-search-open],[data-quick-view],[data-card-metal],[data-overlay-open]'
    );
    if (!el) return;

    var ours =
      (el.hasAttribute('data-drawer-open') && cartDrawer() && overlays.cart) ||
      (el.hasAttribute('data-search-open') && overlays.search) ||
      (el.hasAttribute('data-quick-view') && quickOverlay()) ||
      el.hasAttribute('data-card-metal') ||
      (el.hasAttribute('data-overlay-open') && overlays[el.dataset.overlayOpen]);

    if (ours) event.preventDefault();
  }, true);

  function initCartTriggers() {
    /* The bag link opens the drawer when there is one; otherwise it stays a
       link to the cart page. The two are exclusive by the theme setting. */
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest && event.target.closest('[data-drawer-open]');
      if (!trigger || !cartDrawer() || !overlays.cart) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

      event.preventDefault();

      function openDrawer() { overlays.cart.open(); }

      if (trigger.hasAttribute('data-from-menu') && overlays.menu && overlays.menu.isOpen()) {
        overlays.menu.close(false);
        /* Let the menu empty itself before the drawer slides in over it. */
        window.setTimeout(openDrawer, 520);
        return;
      }

      if (overlays.search && overlays.search.isOpen()) {
        overlays.search.close(false);
        window.setTimeout(openDrawer, 240);
        return;
      }

      openDrawer();
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest) return;

      var row = event.target.closest('[data-cart-line]');
      if (!row) return;
      var index = parseInt(row.dataset.cartLine, 10);

      function remove() {
        /* The last line takes the whole panel with it — the footer, the count,
           the list. Collapsing it first would leave an empty list sitting
           under a stale subtotal for as long as the request takes, and then
           jolt. So the last one skips the collapse entirely and hands the
           panel over instead: the contents fade while the request flies, and
           the empty state rises in behind it.

           Any other line still collapses on its own, which is what the design
           does, and the rest of the panel never moves. */
        var inner = cartDrawer() && cartDrawer().querySelector('[data-drawer-contents]');
        var lines = document.querySelectorAll('[data-cart-line]').length;

        if (lines === 1 && inner && !reduceMotion.matches) {
          inner.setAttribute('data-cart-swapping', '');
          void inner.offsetWidth;
          queueLine(index, 0, true);
          return;
        }

        row.setAttribute('data-leaving', '');
        /* Sent the moment the row has finished collapsing, not coalesced — a
           removal is the last thing this line will say. */
        afterAnimations(row, 700, function () { queueLine(index, 0, true); });
      }

      var step = event.target.closest('[data-cart-step]');
      if (step) {
        var value = row.querySelector('[data-cart-qty]');
        var current = value ? parseInt(value.textContent, 10) : 1;
        var next = current + parseInt(step.dataset.cartStep, 10);

        /* Stepping below one is a removal, and gets the removal's motion. */
        if (next <= 0) { remove(); return; }

        /* Answer the press now. This is the count, not a price — every figure
           still comes back from Liquid, and the re-render overwrites this. */
        if (value) value.textContent = next;

        queueLine(index, next);
        return;
      }

      if (event.target.closest('[data-cart-remove]')) remove();
    });

    /* Adding from a product card posts in the background and slides the
       drawer out, instead of navigating away from the grid. */
    if (!window.FormData) return;

    document.addEventListener('submit', function (event) {
      var form = event.target;
      if (!form.matches || !form.matches('[data-cart-add]')) return;

      var drawer = cartDrawer();
      if (!drawer) return;

      event.preventDefault();
      var data = new FormData(form);
      data.append('sections', drawer.dataset.sectionId);

      fetch(root() + 'cart/add.js', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data
      })
        .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
        .then(function (payload) {
          applyCartSection(payload);
          if (drawer.dataset.openOnAdd === 'true' && overlays.cart) overlays.cart.open();
        })
        .catch(function () { form.submit(); });
    });
  }

  /* ---- Same-media low-quality previews -------------------------------
     Every raster image carries a tiny rendition of that same image in
     `data-image-lqip`. A precisely aligned facade keeps that rendition above
     the untouched full source until decode completes, then fades away; the
     browser never has to replace preview pixels in the visible image layer.
     Every video carries a tiny rendition of its own Shopify preview frame in
     `data-video-lqip`; that frame sits over the untouched full poster/video
     until playback has presented an advancing frame. YouTube and Vimeo embeds
     use their player APIs as playback authority. Full sources always load in
     parallel.

     Loading state remains progressive enhancement: classes and backgrounds
     are added only here. Cached images never flash a preview, lazy images are
     activated near the viewport, and source-less card slides wait until their
     deferred source is promoted. */

  var imageLqipStates = new WeakMap();
  var imageLqipBound = new WeakSet();
  var imageLqipViewport = null;
  var imageLqipActive = [];
  var imageLqipSyncFrame = 0;
  var videoLqipStates = new WeakMap();
  var videoLqipViewport = null;
  var videoAutoplayBound = new WeakSet();
  var videoAutoplayViewport = null;
  var youtubeApiPromise = null;
  var vimeoApiPromise = null;
  var mediaLqipHosts = new WeakMap();
  var mediaLqipMutations = null;

  function mediaWithin(scope, selector) {
    var media = [];
    if (scope.matches && scope.matches(selector)) media.push(scope);
    if (scope.querySelectorAll) {
      media = media.concat(Array.prototype.slice.call(scope.querySelectorAll(selector)));
    }
    return media;
  }

  function derivedMediaLqip(raw) {
    if (!raw || /^(?:data|blob):/i.test(raw)) return '';

    try {
      var url = new window.URL(raw, document.baseURI);
      var shopifyHost = /(^|\.)cdn\.shopify\.com$/i.test(url.hostname);
      var shopifyPath = url.origin === window.location.origin && url.pathname.indexOf('/cdn/shop/') === 0;
      if ((!shopifyHost && !shopifyPath) || /\.svg$/i.test(url.pathname)) return '';

      var width = parseInt(url.searchParams.get('width'), 10) || 0;
      var height = parseInt(url.searchParams.get('height'), 10) || 0;
      if (width > 0 && height > 0) {
        var scale = 40 / Math.max(width, height);
        url.searchParams.set('width', Math.max(1, Math.round(width * scale)));
        url.searchParams.set('height', Math.max(1, Math.round(height * scale)));
      } else if (height > 0) {
        url.searchParams.set('height', '40');
      } else {
        url.searchParams.set('width', '40');
      }
      return url.href;
    } catch (error) {
      return '';
    }
  }

  function derivedImageLqip(image) {
    var raw = image.currentSrc || image.getAttribute('src') || image.dataset.src || '';
    return derivedMediaLqip(raw);
  }

  function imageLqipUrl(image) {
    var supplied = image.getAttribute('data-image-lqip');
    if (supplied === 'off') return '';
    if (supplied) {
      try {
        return new window.URL(supplied, document.baseURI).href;
      } catch (error) {
        return supplied;
      }
    }

    var source = image.currentSrc || image.getAttribute('src') || image.dataset.src || '';
    if (/\.svg(?:[?#]|$)/i.test(source) || /^data:image\/svg\+xml/i.test(source)) {
      image.setAttribute('data-image-lqip', 'off');
      return '';
    }

    var derived = derivedImageLqip(image);
    if (derived) image.setAttribute('data-image-lqip', derived);
    return derived;
  }

  function imageLqipKey(image, lqip) {
    return [
      image.getAttribute('src') || '',
      image.getAttribute('srcset') || '',
      image.dataset.src || '',
      image.dataset.srcset || '',
      lqip
    ].join('|');
  }

  function unobserveImageLqip(image) {
    if (imageLqipViewport) imageLqipViewport.unobserve(image);
  }

  function measureImageLqipFrame(image) {
    var style = window.getComputedStyle(image);
    var width = parseFloat(style.width);
    var height = parseFloat(style.height);
    var fit = style.objectFit || 'fill';
    var backgroundFit = 'auto';
    if (fit === 'cover' || fit === 'contain') backgroundFit = fit;
    else if (fit === 'fill') backgroundFit = '100% 100%';
    else if (fit === 'scale-down') backgroundFit = 'contain';
    if (style.boxSizing !== 'border-box') {
      width += parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) +
        parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
      height += parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) +
        parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    }

    var left = image.offsetLeft;
    var top = image.offsetTop;
    var boxWidth = isFinite(width) ? width : image.offsetWidth;
    var boxHeight = isFinite(height) ? height : image.offsetHeight;
    var radius = style.borderRadius || '';
    var clipPath = !style.clipPath || style.clipPath === 'none' ? '' : style.clipPath;
    var zIndex = style.zIndex || '';
    var transform = style.transform === 'none' ? '' : style.transform;
    var transformOrigin = style.transformOrigin || '';
    var objectPosition = style.objectPosition || '50% 50%';
    var backgroundColor = style.backgroundColor && style.backgroundColor !== 'transparent' &&
      style.backgroundColor !== 'rgba(0, 0, 0, 0)' ? style.backgroundColor : '';
    return {
      backgroundColor: backgroundColor,
      backgroundFit: backgroundFit,
      boxHeight: boxHeight,
      boxWidth: boxWidth,
      clipPath: clipPath,
      key: [
        left, top, boxWidth, boxHeight, radius, clipPath, zIndex, transform,
        transformOrigin, backgroundFit, objectPosition, backgroundColor
      ].join('|'),
      left: left,
      objectPosition: objectPosition,
      radius: radius,
      top: top,
      transform: transform,
      transformOrigin: transformOrigin,
      zIndex: zIndex
    };
  }

  function applyImageLqipFrame(state, geometry) {
    if (!state || !state.overlay || state.geometryKey === geometry.key) return;
    state.geometryKey = geometry.key;

    state.overlay.style.left = geometry.left + 'px';
    state.overlay.style.top = geometry.top + 'px';
    state.overlay.style.width = geometry.boxWidth + 'px';
    state.overlay.style.height = geometry.boxHeight + 'px';
    state.overlay.style.borderRadius = geometry.radius;
    state.overlay.style.clipPath = geometry.clipPath;
    state.overlay.style.zIndex = geometry.zIndex;
    state.overlay.style.transform = geometry.transform;
    state.overlay.style.transformOrigin = geometry.transformOrigin;
    state.overlay.style.setProperty('--image-lqip-fit', geometry.backgroundFit);
    state.overlay.style.setProperty('--image-lqip-position', geometry.objectPosition);

    if (geometry.backgroundColor) {
      state.overlay.style.setProperty('--image-lqip-color', geometry.backgroundColor);
    } else {
      state.overlay.style.removeProperty('--image-lqip-color');
    }
  }

  function syncImageLqipFrame(image, state) {
    if (!state || !state.overlay || !state.host || !state.overlay.isConnected) return;
    applyImageLqipFrame(state, measureImageLqipFrame(image));
  }

  function syncActiveImageLqipFrames() {
    imageLqipSyncFrame = 0;
    var active = imageLqipActive.slice();
    imageLqipActive = [];
    var connected = [];
    var detached = [];

    active.forEach(function (image) {
      var state = imageLqipStates.get(image);
      if (!state || !state.active || !state.overlay) return;
      if (!image.isConnected || !state.overlay.isConnected) {
        detached.push({ image: image, state: state });
        return;
      }
      connected.push({ image: image, state: state });
    });

    detached.forEach(function (entry) {
      clearImageLqipVisual(entry.image, entry.state);
    });

    /* Read every live box before writing any facade styles. This keeps a grid
       of slow-loading images to one layout pass per frame instead of one pass
       per image. */
    connected.forEach(function (entry) {
      entry.geometry = measureImageLqipFrame(entry.image);
    });
    connected.forEach(function (entry) {
      applyImageLqipFrame(entry.state, entry.geometry);
      imageLqipActive.push(entry.image);
    });

    if (imageLqipActive.length) {
      imageLqipSyncFrame = window.requestAnimationFrame(syncActiveImageLqipFrames);
    }
  }

  function trackImageLqipFrame(image) {
    if (imageLqipActive.indexOf(image) === -1) imageLqipActive.push(image);
    if (!imageLqipSyncFrame) {
      imageLqipSyncFrame = window.requestAnimationFrame(syncActiveImageLqipFrames);
    }
  }

  function untrackImageLqipFrame(image) {
    imageLqipActive = imageLqipActive.filter(function (active) { return active !== image; });
    if (!imageLqipActive.length && imageLqipSyncFrame) {
      window.cancelAnimationFrame(imageLqipSyncFrame);
      imageLqipSyncFrame = 0;
    }
  }

  function clearImageLqipVisual(image, state) {
    if (state && state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
    if (state && state.overlay && state.animationEnd) {
      state.overlay.removeEventListener('animationend', state.animationEnd);
      state.animationEnd = null;
    }

    unobserveImageLqip(image);
    untrackImageLqipFrame(image);
    if (state && state.overlay && state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
    if (state) {
      state.active = false;
      state.overlay = null;
    }
    image.classList.remove('image-lqip', 'is-lqip-loading', 'is-lqip-revealing');
    releaseMediaLqipHost(state);
  }

  function activateImageLqip(image, state) {
    if (imageLqipStates.get(image) !== state || state.active || state.done) return;

    var hasSource = Boolean(image.getAttribute('src') || image.getAttribute('srcset'));
    if (!hasSource) return;

    if (image.complete) {
      state.done = true;
      unobserveImageLqip(image);
      return;
    }

    var host = image.parentElement;
    /* An img inside video is fallback content, not a rendered image surface.
       Its parent video owns the preview-frame lifecycle instead. */
    if (!host || host.tagName === 'VIDEO') {
      state.done = true;
      unobserveImageLqip(image);
      return;
    }

    acquireMediaLqipHost(host, state);

    var overlay = document.createElement('span');
    overlay.className = 'image-lqip-frame is-lqip-loading';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.setProperty('--image-lqip-source', 'url(' + JSON.stringify(state.lqip) + ')');
    host.insertBefore(overlay, image.nextSibling);

    state.overlay = overlay;
    state.active = true;
    syncImageLqipFrame(image, state);
    trackImageLqipFrame(image);
    image.classList.add('image-lqip', 'is-lqip-loading');
  }

  function queueImageLqip(image, state, immediate) {
    if (immediate || image.getAttribute('loading') !== 'lazy' || !('IntersectionObserver' in window)) {
      activateImageLqip(image, state);
      return;
    }

    if (!imageLqipViewport) {
      imageLqipViewport = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          imageLqipViewport.unobserve(entry.target);
          var current = imageLqipStates.get(entry.target);
          if (current) activateImageLqip(entry.target, current);
        });
      }, { rootMargin: '1200px 0px', threshold: 0.01 });
    }

    imageLqipViewport.observe(image);
  }

  function finishImageLqip(image, state) {
    if (imageLqipStates.get(image) !== state) return;
    clearImageLqipVisual(image, state);
  }

  function revealImageLqip(image, state) {
    if (imageLqipStates.get(image) !== state || state.done) return;
    state.done = true;
    unobserveImageLqip(image);

    if (!state.active || !state.overlay) return;
    if (reduceMotion.matches) {
      finishImageLqip(image, state);
      return;
    }

    image.classList.add('is-lqip-revealing');
    image.classList.remove('is-lqip-loading');
    state.overlay.classList.add('is-lqip-revealing');
    state.overlay.classList.remove('is-lqip-loading');

    state.animationEnd = function (event) {
      if (event.animationName !== 'gj-image-lqip-fade') return;
      finishImageLqip(image, state);
    };
    state.overlay.addEventListener('animationend', state.animationEnd);
    state.timer = window.setTimeout(function () {
      finishImageLqip(image, state);
    }, 900);
  }

  function imageLqipLoaded(image) {
    var state = imageLqipStates.get(image);
    if (!state || state.done) return;

    var decoded = typeof image.decode === 'function'
      ? image.decode().catch(function () {})
      : Promise.resolve();

    decoded.then(function () {
      if (imageLqipStates.get(image) !== state) return;
      if (image.naturalWidth > 0) revealImageLqip(image, state);
      else finishImageLqip(image, state);
    });
  }

  function imageLqipFailed(image) {
    var state = imageLqipStates.get(image);
    if (!state) return;
    state.done = true;
    finishImageLqip(image, state);
  }

  function watchImageLqip(image, immediate) {
    if (!imageLqipBound.has(image)) {
      imageLqipBound.add(image);
      image.addEventListener('load', function () { imageLqipLoaded(image); });
      image.addEventListener('error', function () { imageLqipFailed(image); });
    }

    var lqip = imageLqipUrl(image);
    var previous = imageLqipStates.get(image);
    var key = imageLqipKey(image, lqip);

    if (previous && previous.active &&
        (previous.host !== image.parentElement || image.nextSibling !== previous.overlay)) {
      clearImageLqipVisual(image, previous);
      imageLqipStates.delete(image);
      previous = null;
    }

    if (previous && previous.key === key) {
      if (immediate && !previous.active && !previous.done) activateImageLqip(image, previous);
      return;
    }

    if (previous) {
      clearImageLqipVisual(image, previous);
    }

    var state = {
      active: false,
      done: false,
      geometryKey: '',
      key: key,
      lqip: lqip,
      host: null,
      hostLease: null,
      overlay: null,
      timer: null,
      animationEnd: null
    };
    imageLqipStates.set(image, state);

    if (!lqip) {
      state.done = true;
      return;
    }

    var hasSource = Boolean(image.getAttribute('src') || image.getAttribute('srcset'));
    if (!hasSource) return;

    if (image.complete) {
      state.done = true;
      return;
    }

    queueImageLqip(image, state, immediate);
  }

  function videoLqipUrl(media) {
    var supplied = media.getAttribute('data-video-lqip');
    if (supplied === 'off') return '';
    if (supplied) {
      try {
        return new window.URL(supplied, document.baseURI).href;
      } catch (error) {
        return supplied;
      }
    }

    if (media.tagName !== 'VIDEO') return '';
    return derivedMediaLqip(media.getAttribute('poster') || '');
  }

  function videoSourceKey(media) {
    var sources = media.tagName === 'VIDEO'
      ? Array.prototype.map.call(media.querySelectorAll('source'), function (source) {
        return source.getAttribute('src') || source.dataset.src || '';
      }).join(',')
      : '';

    return [
      media.tagName,
      media.getAttribute('src') || '',
      media.dataset.src || '',
      sources
    ].join('|');
  }

  function videoLqipKey(media, lqip) {
    return [videoSourceKey(media), media.getAttribute('poster') || '', lqip].join('|');
  }

  function videoHasSource(media) {
    if (media.getAttribute('src')) return true;
    return media.tagName === 'VIDEO' && Boolean(media.querySelector('source[src]'));
  }

  function unobserveVideoLqip(media) {
    if (videoLqipViewport) videoLqipViewport.unobserve(media);
  }

  function adjacentVideoLqipFrame(media) {
    var sibling = media.nextElementSibling;
    return sibling && sibling.matches('.video-lqip-frame[data-video-lqip-frame]') ? sibling : null;
  }

  function acquireMediaLqipHost(host, state) {
    var lease = mediaLqipHosts.get(host);
    if (!lease) {
      var hostStyle = window.getComputedStyle(host);
      lease = {
        count: 0,
        ownsPosition: hostStyle.position === 'static',
        positionPriority: host.style.getPropertyPriority('position'),
        positionValue: host.style.getPropertyValue('position')
      };
      if (lease.ownsPosition) host.style.setProperty('position', 'relative');
      mediaLqipHosts.set(host, lease);
    }

    lease.count += 1;
    state.host = host;
    state.hostLease = lease;
  }

  function releaseMediaLqipHost(state) {
    var host = state && state.host;
    var lease = state && state.hostLease;
    if (!host || !lease || mediaLqipHosts.get(host) !== lease) return;

    lease.count = Math.max(0, lease.count - 1);
    if (lease.count === 0) {
      if (lease.ownsPosition && host.style.getPropertyValue('position') === 'relative') {
        if (lease.positionValue) {
          host.style.setProperty('position', lease.positionValue, lease.positionPriority);
        } else {
          host.style.removeProperty('position');
        }
      }
      mediaLqipHosts.delete(host);
    }

    state.host = null;
    state.hostLease = null;
  }

  function cancelVideoFrameWait(media, state) {
    if (!state) return;
    if (state.videoFrameId && typeof media.cancelVideoFrameCallback === 'function') {
      media.cancelVideoFrameCallback(state.videoFrameId);
    }
    if (state.paintFrame) window.cancelAnimationFrame(state.paintFrame);
    state.videoFrameId = 0;
    state.paintFrame = 0;
  }

  function unbindVideoLqip(media, state) {
    if (!state) return;
    if (state.readyEvent && state.readyListener) {
      media.removeEventListener(state.readyEvent, state.readyListener);
    }
    if (state.pauseListener) media.removeEventListener('pause', state.pauseListener);
    if (state.errorListener) media.removeEventListener('error', state.errorListener);
    if (state.actionButton && state.actionListener) {
      state.actionButton.removeEventListener('click', state.actionListener);
    }
    if (state.externalOff) state.externalOff();
    cancelVideoFrameWait(media, state);
    state.readyEvent = '';
    state.readyListener = null;
    state.pauseListener = null;
    state.errorListener = null;
    state.actionButton = null;
    state.actionListener = null;
    state.externalOff = null;
  }

  function clearVideoLqipVisual(media, state) {
    if (state && state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
    if (state && state.overlay && state.animationEnd) {
      state.overlay.removeEventListener('animationend', state.animationEnd);
      state.animationEnd = null;
    }

    unobserveVideoLqip(media);
    unbindVideoLqip(media, state);
    if (state && state.overlay && state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
    if (state) {
      state.active = false;
      state.overlay = null;
    }
    media.classList.remove('video-lqip', 'is-lqip-loading', 'is-lqip-revealing');
    releaseMediaLqipHost(state);
  }

  function finishVideoLqip(media, state) {
    if (videoLqipStates.get(media) !== state) return;
    clearVideoLqipVisual(media, state);
  }

  function setVideoLqipAction(media, state, mode) {
    if (!state || !state.overlay) return;
    var button = state.overlay.querySelector('[data-video-lqip-play]');
    if (!button && !mode) return;
    if (!button) {
      button = document.createElement('button');
      button.className = 'video-lqip-frame__play';
      button.type = 'button';
      button.setAttribute('data-video-lqip-play', '');
      var glyph = document.createElement('span');
      glyph.setAttribute('aria-hidden', 'true');
      button.appendChild(glyph);
      state.overlay.appendChild(button);
    }

    if (state.actionButton !== button) {
      if (state.actionButton && state.actionListener) {
        state.actionButton.removeEventListener('click', state.actionListener);
      }
      state.actionButton = button;
      state.actionListener = function () { requestVideoLqipPlayback(media, true); };
      button.addEventListener('click', state.actionListener);
    }

    if (!mode) {
      button.hidden = true;
      state.overlay.classList.remove('has-video-action');
      state.overlay.setAttribute('aria-hidden', 'true');
      return;
    }

    var retry = mode === 'retry';
    button.hidden = false;
    button.setAttribute('aria-label', retry ? 'Retry video' : 'Play video');
    button.firstElementChild.textContent = retry ? '\u21bb' : '\u25b6';
    state.overlay.classList.add('has-video-action');
    state.overlay.removeAttribute('aria-hidden');
  }

  function revealVideoLqip(media, state) {
    if (videoLqipStates.get(media) !== state || state.done) return;
    state.done = true;
    unobserveVideoLqip(media);

    if (!state.active || !state.overlay) {
      finishVideoLqip(media, state);
      return;
    }

    setVideoLqipAction(media, state, '');
    if (reduceMotion.matches) {
      finishVideoLqip(media, state);
      return;
    }

    media.classList.add('is-lqip-revealing');
    media.classList.remove('is-lqip-loading');
    state.overlay.classList.add('is-lqip-revealing');

    state.animationEnd = function (event) {
      if (event.animationName !== 'gj-video-lqip-fade') return;
      finishVideoLqip(media, state);
    };
    state.overlay.addEventListener('animationend', state.animationEnd);
    state.timer = window.setTimeout(function () {
      finishVideoLqip(media, state);
    }, 700);
  }

  function videoLqipFailed(media, state) {
    if (videoLqipStates.get(media) !== state || state.done) return;
    state.mediaFailed = true;
    cancelVideoFrameWait(media, state);
    setVideoLqipAction(media, state, 'retry');
  }

  function revealVideoAfterFallbackPaint(media, state, startTime) {
    function checkFrame() {
      state.paintFrame = 0;
      if (videoLqipStates.get(media) !== state || state.done || media.paused) return;
      if (Math.abs(media.currentTime - startTime) < 0.001) {
        state.paintFrame = window.requestAnimationFrame(checkFrame);
        return;
      }
      state.paintFrame = window.requestAnimationFrame(function () {
        state.paintFrame = window.requestAnimationFrame(function () {
          state.paintFrame = 0;
          if (videoLqipStates.get(media) === state && !state.done && !media.paused) {
            revealVideoLqip(media, state);
          }
        });
      });
    }
    state.paintFrame = window.requestAnimationFrame(checkFrame);
  }

  function waitForPresentedVideoFrame(media, state) {
    cancelVideoFrameWait(media, state);
    var startTime = media.currentTime;

    if (typeof media.requestVideoFrameCallback !== 'function') {
      revealVideoAfterFallbackPaint(media, state, startTime);
      return;
    }

    function checkFrame(now, metadata) {
      state.videoFrameId = 0;
      if (videoLqipStates.get(media) !== state || state.done || media.paused) return;
      var mediaTime = metadata && typeof metadata.mediaTime === 'number'
        ? metadata.mediaTime
        : media.currentTime;
      if (Math.abs(mediaTime - startTime) >= 0.001) {
        revealVideoLqip(media, state);
        return;
      }
      state.videoFrameId = media.requestVideoFrameCallback(checkFrame);
    }

    state.videoFrameId = media.requestVideoFrameCallback(checkFrame);
  }

  function videoLqipPlaying(media, state) {
    if (videoLqipStates.get(media) !== state || state.done) return;
    state.mediaReady = true;
    state.mediaFailed = false;
    setVideoLqipAction(media, state, '');
    waitForPresentedVideoFrame(media, state);
  }

  function videoLqipPaused(media, state) {
    if (videoLqipStates.get(media) !== state || state.done || !state.active) return;
    cancelVideoFrameWait(media, state);
    setVideoLqipAction(media, state, 'play');
  }

  function activateVideoLqip(media, state) {
    if (videoLqipStates.get(media) !== state || state.active || state.done) return;

    var host = media.parentElement;
    if (!host) {
      state.done = true;
      return;
    }

    acquireMediaLqipHost(host, state);

    var style = window.getComputedStyle(media);
    var fit = style.objectFit || 'cover';
    var backgroundFit = 'auto';
    if (fit === 'cover' || fit === 'contain') backgroundFit = fit;
    else if (fit === 'fill') backgroundFit = '100% 100%';
    else if (fit === 'scale-down') backgroundFit = 'contain';

    var overlay = adjacentVideoLqipFrame(media);
    if (!overlay) {
      overlay = document.createElement('span');
      overlay.setAttribute('data-video-lqip-frame', '');
      host.insertBefore(overlay, media.nextSibling);
    }
    overlay.classList.add('video-lqip-frame', 'is-lqip-loading');
    overlay.classList.remove('is-lqip-revealing');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.setProperty('--video-lqip-source', 'url(' + JSON.stringify(state.lqip) + ')');
    overlay.style.setProperty('--video-lqip-fit', backgroundFit);
    overlay.style.setProperty('--video-lqip-position', style.objectPosition || '50% 50%');
    overlay.style.borderRadius = style.borderRadius;
    if (style.transform && style.transform !== 'none') overlay.style.transform = style.transform;
    if (style.transformOrigin) overlay.style.transformOrigin = style.transformOrigin;

    state.overlay = overlay;
    state.active = true;
    media.classList.add('video-lqip', 'is-lqip-loading');

    if (media.tagName === 'IFRAME') {
      initExternalVideoLqip(media, state);
    } else {
      if (media.controls || reduceMotion.matches) setVideoLqipAction(media, state, 'play');
      if (!media.paused && media.readyState >= 2) videoLqipPlaying(media, state);
    }
  }

  function queueVideoLqip(media, state, immediate) {
    if (immediate || media.getAttribute('loading') !== 'lazy' || !('IntersectionObserver' in window)) {
      activateVideoLqip(media, state);
      return;
    }

    if (!videoLqipViewport) {
      videoLqipViewport = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          videoLqipViewport.unobserve(entry.target);
          var current = videoLqipStates.get(entry.target);
          if (current) activateVideoLqip(entry.target, current);
        });
      }, { rootMargin: '1200px 0px', threshold: 0.01 });
    }

    videoLqipViewport.observe(media);
  }

  function prepareExternalVideo(media) {
    if (media.tagName !== 'IFRAME') return '';
    var raw = media.getAttribute('src') || '';
    if (!raw) return '';

    try {
      var url = new window.URL(raw, document.baseURI);
      var host = url.hostname.toLowerCase();
      var provider = '';

      if (host === 'youtube.com' || host === 'www.youtube.com' ||
          host === 'youtube-nocookie.com' || host === 'www.youtube-nocookie.com') {
        provider = 'youtube';
        url.searchParams.set('enablejsapi', '1');
        url.searchParams.set('playsinline', '1');
        if (window.location.origin && window.location.origin !== 'null') {
          url.searchParams.set('origin', window.location.origin);
        }
      } else if (host === 'player.vimeo.com' || host === 'vimeo.com' || host === 'www.vimeo.com') {
        provider = 'vimeo';
        url.searchParams.set('api', '1');
      }

      if (provider) {
        media.dataset.videoProvider = provider;
        if (url.href !== media.src) media.src = url.href;
      }
      return provider;
    } catch (error) {
      return '';
    }
  }

  function loadYouTubeApi() {
    if (window.YT && typeof window.YT.Player === 'function') return Promise.resolve(window.YT);
    if (youtubeApiPromise) return youtubeApiPromise;

    youtubeApiPromise = new Promise(function (resolve, reject) {
      var settled = false;
      var timeout = 0;
      var script = null;

      function succeed() {
        if (settled || !window.YT || typeof window.YT.Player !== 'function') return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(window.YT);
      }

      function fail(reason) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (script) {
          script.dataset.gjPlayerApiFailed = 'true';
          if (script.dataset.gjPlayerApi === 'youtube' && script.parentNode) script.remove();
        }
        reject(reason instanceof Error ? reason : new Error('YouTube player API unavailable'));
      }

      var previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof previousReady === 'function') {
          try { previousReady(); } catch (error) {}
        }
        succeed();
      };

      script = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]:not([data-gj-player-api-failed])'
      );
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.gjPlayerApi = 'youtube';
        document.head.appendChild(script);
      }
      script.addEventListener('load', function () {
        if (window.YT && typeof window.YT.Player === 'function') succeed();
        else fail(new Error('YouTube player API unavailable'));
      }, { once: true });
      script.addEventListener('error', fail, { once: true });
      timeout = window.setTimeout(function () {
        fail(new Error('YouTube player API timed out'));
      }, 12000);
    });

    youtubeApiPromise.catch(function () { youtubeApiPromise = null; });
    return youtubeApiPromise;
  }

  function loadVimeoApi() {
    if (window.Vimeo && typeof window.Vimeo.Player === 'function') return Promise.resolve(window.Vimeo);
    if (vimeoApiPromise) return vimeoApiPromise;

    vimeoApiPromise = new Promise(function (resolve, reject) {
      var settled = false;
      var timeout = 0;
      var script = document.querySelector(
        'script[src="https://player.vimeo.com/api/player.js"]:not([data-gj-player-api-failed])'
      );

      function succeed() {
        if (settled || !window.Vimeo || typeof window.Vimeo.Player !== 'function') return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(window.Vimeo);
      }

      function fail(reason) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (script) {
          script.dataset.gjPlayerApiFailed = 'true';
          if (script.dataset.gjPlayerApi === 'vimeo' && script.parentNode) script.remove();
        }
        reject(reason instanceof Error ? reason : new Error('Vimeo player API unavailable'));
      }

      if (!script) {
        script = document.createElement('script');
        script.src = 'https://player.vimeo.com/api/player.js';
        script.async = true;
        script.dataset.gjPlayerApi = 'vimeo';
        document.head.appendChild(script);
      }
      script.addEventListener('load', function () {
        if (window.Vimeo && typeof window.Vimeo.Player === 'function') succeed();
        else fail(new Error('Vimeo player API unavailable'));
      }, { once: true });
      script.addEventListener('error', fail, { once: true });
      timeout = window.setTimeout(function () {
        fail(new Error('Vimeo player API timed out'));
      }, 12000);
    });

    vimeoApiPromise.catch(function () { vimeoApiPromise = null; });
    return vimeoApiPromise;
  }

  function externalAttemptCurrent(media, state, attempt) {
    return videoLqipStates.get(media) === state && !state.done && state.externalAttempt === attempt;
  }

  function externalVideoFailed(media, state, attempt) {
    if (videoLqipStates.get(media) !== state || state.done) return;
    if (typeof attempt === 'number' && state.externalAttempt !== attempt) return;
    state.externalWantsPlay = false;
    videoLqipFailed(media, state);
  }

  function youtubeVideoPlaying(media, state, attempt) {
    if (!externalAttemptCurrent(media, state, attempt) || !state.externalPlayer) return;
    if (state.externalFrame) window.cancelAnimationFrame(state.externalFrame);
    var startTime = Number(state.externalPlayer.getCurrentTime()) || 0;

    function checkTime() {
      state.externalFrame = 0;
      if (!externalAttemptCurrent(media, state, attempt) || !state.externalPlayer) return;
      var time = Number(state.externalPlayer.getCurrentTime()) || 0;
      if (Math.abs(time - startTime) >= 0.001) {
        state.externalFrame = window.requestAnimationFrame(function () {
          state.externalFrame = window.requestAnimationFrame(function () {
            state.externalFrame = 0;
            if (externalAttemptCurrent(media, state, attempt)) revealVideoLqip(media, state);
          });
        });
        return;
      }
      state.externalFrame = window.requestAnimationFrame(checkTime);
    }
    state.externalFrame = window.requestAnimationFrame(checkTime);
  }

  function initYouTubeVideoLqip(media, state, attempt) {
    loadYouTubeApi().then(function (YT) {
      if (!externalAttemptCurrent(media, state, attempt)) return;

      var onReady = function () {
        if (!externalAttemptCurrent(media, state, attempt)) return;
        state.externalReady = true;
        if (state.externalWantsPlay) requestExternalVideoPlayback(media, state);
      };
      var onStateChange = function (event) {
        if (!externalAttemptCurrent(media, state, attempt)) return;
        if (event.data === YT.PlayerState.PLAYING) {
          youtubeVideoPlaying(media, state, attempt);
          return;
        }
        if (state.externalFrame) window.cancelAnimationFrame(state.externalFrame);
        state.externalFrame = 0;
        if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
          setVideoLqipAction(media, state, 'play');
        }
      };
      var onError = function () { externalVideoFailed(media, state, attempt); };
      var onAutoplayBlocked = function () {
        if (!externalAttemptCurrent(media, state, attempt)) return;
        state.externalWantsPlay = false;
        setVideoLqipAction(media, state, 'play');
      };

      state.externalPlayer = new YT.Player(media, {
        events: {
          onReady: onReady,
          onStateChange: onStateChange,
          onError: onError,
          onAutoplayBlocked: onAutoplayBlocked
        }
      });
      state.externalOff = function () {
        if (state.externalFrame) window.cancelAnimationFrame(state.externalFrame);
        state.externalFrame = 0;
      };
    }).catch(function () { externalVideoFailed(media, state, attempt); });
  }

  function initVimeoVideoLqip(media, state, attempt) {
    loadVimeoApi().then(function (Vimeo) {
      if (!externalAttemptCurrent(media, state, attempt)) return;

      var player = new Vimeo.Player(media);
      var onPlaying = function () {
        if (!externalAttemptCurrent(media, state, attempt)) return;
        state.externalIsPlaying = true;
        state.externalMediaTime = null;
      };
      var onTime = function (data) {
        if (!externalAttemptCurrent(media, state, attempt) || !state.externalIsPlaying || !data) return;
        var time = Number(data.seconds) || 0;
        if (state.externalMediaTime === null) {
          state.externalMediaTime = time;
          return;
        }
        if (Math.abs(time - state.externalMediaTime) >= 0.001) revealVideoLqip(media, state);
      };
      var onPause = function () {
        if (!externalAttemptCurrent(media, state, attempt)) return;
        state.externalIsPlaying = false;
        state.externalMediaTime = null;
        setVideoLqipAction(media, state, 'play');
      };
      var onSeeking = function () {
        if (!externalAttemptCurrent(media, state, attempt)) return;
        state.externalIsPlaying = false;
        state.externalMediaTime = null;
      };
      var onError = function () { externalVideoFailed(media, state, attempt); };

      state.externalPlayer = player;
      player.on('playing', onPlaying);
      player.on('timeupdate', onTime);
      player.on('pause', onPause);
      player.on('ended', onPause);
      player.on('seeking', onSeeking);
      player.on('error', onError);
      state.externalOff = function () {
        player.off('playing', onPlaying);
        player.off('timeupdate', onTime);
        player.off('pause', onPause);
        player.off('ended', onPause);
        player.off('seeking', onSeeking);
        player.off('error', onError);
      };

      return player.ready();
    }).then(function () {
      if (!externalAttemptCurrent(media, state, attempt)) return;
      state.externalReady = true;
      if (state.externalWantsPlay) requestExternalVideoPlayback(media, state);
    }).catch(function () { externalVideoFailed(media, state, attempt); });
  }

  function initExternalVideoLqip(media, state) {
    state.externalAttempt += 1;
    var attempt = state.externalAttempt;
    state.externalProvider = media.dataset.videoProvider || prepareExternalVideo(media);
    setVideoLqipAction(media, state, 'play');
    if (state.externalProvider === 'youtube') initYouTubeVideoLqip(media, state, attempt);
    else if (state.externalProvider === 'vimeo') initVimeoVideoLqip(media, state, attempt);
    else externalVideoFailed(media, state, attempt);
  }

  function requestExternalVideoPlayback(media, state) {
    if (videoLqipStates.get(media) !== state || state.done) return;
    state.externalWantsPlay = true;
    state.mediaFailed = false;
    setVideoLqipAction(media, state, '');
    if (!state.externalReady || !state.externalPlayer) return;

    state.externalWantsPlay = false;
    try {
      if (state.externalProvider === 'youtube') {
        state.externalPlayer.playVideo();
      } else if (state.externalProvider === 'vimeo') {
        var playing = state.externalPlayer.play();
        if (playing && playing.catch) playing.catch(function () {
          if (videoLqipStates.get(media) === state && !state.done) {
            setVideoLqipAction(media, state, 'play');
          }
        });
      } else {
        setVideoLqipAction(media, state, 'play');
      }
    } catch (error) {
      setVideoLqipAction(media, state, state.mediaFailed ? 'retry' : 'play');
    }
  }

  function requestVideoLqipPlayback(media, retry) {
    if (media.tagName === 'VIDEO' && !videoHasSource(media) && media.dataset.src) {
      media.src = media.dataset.src;
      watchVideoLqip(media, true);
    }
    var state = videoLqipStates.get(media);
    if (!state || state.done) {
      watchVideoLqip(media, true);
      state = videoLqipStates.get(media);
    }
    if (!state || state.done) {
      if (media.tagName === 'VIDEO') {
        var directPlay = media.play();
        if (directPlay && directPlay.catch) directPlay.catch(function () {});
      }
      return;
    }

    if (!state.active) activateVideoLqip(media, state);
    if (media.tagName === 'IFRAME') {
      if (retry && state.mediaFailed) {
        if (!state.externalPlayer || !state.externalReady) {
          if (state.externalOff) state.externalOff();
          state.externalOff = null;
          state.externalPlayer = null;
          state.externalReady = false;
          state.externalWantsPlay = false;
          initExternalVideoLqip(media, state);
        }
        state.mediaFailed = false;
      }
      requestExternalVideoPlayback(media, state);
      return;
    }

    state.mediaFailed = false;
    setVideoLqipAction(media, state, '');
    if (retry && media.error) media.load();
    var playing;
    try {
      playing = media.play();
    } catch (error) {
      setVideoLqipAction(media, state, retry && media.error ? 'retry' : 'play');
      return;
    }
    if (playing && playing.catch) {
      playing.catch(function () {
        if (videoLqipStates.get(media) === state && !state.done) {
          setVideoLqipAction(media, state, media.error ? 'retry' : 'play');
        }
      });
    }
  }

  function watchVideoAutoplay(media) {
    if (media.tagName !== 'VIDEO' || videoAutoplayBound.has(media)) return;
    videoAutoplayBound.add(media);

    if (!('IntersectionObserver' in window)) {
      if (!reduceMotion.matches) requestVideoLqipPlayback(media, false);
      return;
    }

    if (!videoAutoplayViewport) {
      videoAutoplayViewport = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var video = entry.target;
          if (!video.hasAttribute('data-video-autoplay')) {
            if (videoAutoplayViewport) videoAutoplayViewport.unobserve(video);
            videoAutoplayBound.delete(video);
            if (!video.paused) video.pause();
            return;
          }
          if (entry.isIntersecting) {
            if (!reduceMotion.matches) requestVideoLqipPlayback(video, false);
          } else if (!video.paused) {
            video.pause();
          }
        });
      }, { rootMargin: '300px 0px', threshold: 0.25 });
    }

    videoAutoplayViewport.observe(media);
  }

  function unwatchVideoAutoplay(media, pause) {
    var wasBound = videoAutoplayBound.has(media);
    if (videoAutoplayViewport) videoAutoplayViewport.unobserve(media);
    videoAutoplayBound.delete(media);
    if (pause && wasBound && media.tagName === 'VIDEO' && !media.paused) media.pause();
  }

  function watchVideoLqip(media, immediate) {
    if (media.tagName === 'IFRAME') prepareExternalVideo(media);
    var lqip = videoLqipUrl(media);
    var previous = videoLqipStates.get(media);
    var key = videoLqipKey(media, lqip);

    if (previous && previous.active &&
        (previous.host !== media.parentElement || media.nextElementSibling !== previous.overlay)) {
      clearVideoLqipVisual(media, previous);
      videoLqipStates.delete(media);
      previous = null;
    }

    if (previous && previous.key === key) {
      if (immediate && !previous.active && !previous.done) activateVideoLqip(media, previous);
      if (media.hasAttribute('data-video-autoplay')) watchVideoAutoplay(media);
      else unwatchVideoAutoplay(media, true);
      return;
    }

    if (previous) clearVideoLqipVisual(media, previous);

    var state = {
      active: false,
      actionButton: null,
      actionListener: null,
      animationEnd: null,
      done: false,
      errorListener: null,
      externalAttempt: 0,
      externalFrame: 0,
      externalIsPlaying: false,
      externalMediaTime: null,
      externalOff: null,
      externalPlayer: null,
      externalProvider: '',
      externalReady: false,
      externalWantsPlay: false,
      host: null,
      hostLease: null,
      key: key,
      lqip: lqip,
      mediaFailed: false,
      mediaReady: false,
      overlay: null,
      paintFrame: 0,
      pauseListener: null,
      readyEvent: '',
      readyListener: null,
      resourceChanged: Boolean(previous && previous.key !== key),
      timer: null,
      videoFrameId: 0
    };
    videoLqipStates.set(media, state);

    if (!lqip) {
      state.done = true;
      var unusedFacade = adjacentVideoLqipFrame(media);
      if (unusedFacade) unusedFacade.remove();
      return;
    }

    if (media.tagName === 'VIDEO') {
      state.readyEvent = 'playing';
      state.readyListener = function () { videoLqipPlaying(media, state); };
      state.pauseListener = function () { videoLqipPaused(media, state); };
      state.errorListener = function () { videoLqipFailed(media, state); };
      media.addEventListener(state.readyEvent, state.readyListener);
      media.addEventListener('pause', state.pauseListener);
      media.addEventListener('error', state.errorListener);
    } else {
      state.errorListener = function () { videoLqipFailed(media, state); };
      media.addEventListener('error', state.errorListener);
    }

    if (videoHasSource(media) || immediate) queueVideoLqip(media, state, immediate);
    if (media.hasAttribute('data-video-autoplay')) watchVideoAutoplay(media);
    else unwatchVideoAutoplay(media, true);
  }

  function blurUp(scope, immediate) {
    mediaWithin(scope, 'img').forEach(function (image) {
      watchImageLqip(image, Boolean(immediate));
    });
    mediaWithin(scope, 'video, iframe[data-video-lqip]').forEach(function (media) {
      watchVideoLqip(media, Boolean(immediate));
    });
  }

  function clearRemovedMediaLqip(scope) {
    mediaWithin(scope, 'img').forEach(function (image) {
      var state = imageLqipStates.get(image);
      if (!state) return;
      clearImageLqipVisual(image, state);
      imageLqipStates.delete(image);
    });
    mediaWithin(scope, 'video, iframe[data-video-lqip]').forEach(function (media) {
      var state = videoLqipStates.get(media);
      if (state) {
        clearVideoLqipVisual(media, state);
        videoLqipStates.delete(media);
      }
      unwatchVideoAutoplay(media, true);
    });
  }

  function initMediaLqipObserver() {
    if (mediaLqipMutations || !('MutationObserver' in window) || !document.body) return;

    mediaLqipMutations = new MutationObserver(function (records) {
      var changedImages = [];
      var changedVideos = [];

      records.forEach(function (record) {
        if (record.type === 'childList') {
          Array.prototype.forEach.call(record.addedNodes, function (node) {
            if (node.nodeType === 1) blurUp(node, false);
          });
          Array.prototype.forEach.call(record.removedNodes, function (node) {
            if (node.nodeType === 1 && !node.isConnected) clearRemovedMediaLqip(node);
          });
          if ((record.target.tagName === 'VIDEO' || record.target.tagName === 'IFRAME') &&
              changedVideos.indexOf(record.target) === -1) {
            changedVideos.push(record.target);
          }
          return;
        }

        if (record.target.tagName === 'IMG' && changedImages.indexOf(record.target) === -1) {
          changedImages.push(record.target);
        }
        if ((record.target.tagName === 'VIDEO' || record.target.tagName === 'IFRAME') &&
            changedVideos.indexOf(record.target) === -1) {
          changedVideos.push(record.target);
        }
        if (record.target.tagName === 'SOURCE' && record.target.parentElement &&
            record.target.parentElement.tagName === 'VIDEO' &&
            changedVideos.indexOf(record.target.parentElement) === -1) {
          changedVideos.push(record.target.parentElement);
        }
      });

      changedImages.forEach(function (image) { watchImageLqip(image, true); });
      changedVideos.forEach(function (media) { watchVideoLqip(media, true); });
    });

    mediaLqipMutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'src',
        'srcset',
        'data-src',
        'data-srcset',
        'poster',
        'data-image-lqip',
        'data-video-lqip',
        'data-video-autoplay'
      ]
    });
  }

  /* ---- Product card ----------------------------------------------------
     Every slide is already in the document — Liquid rendered every photograph
     the piece has and the spin. Nothing here builds markup; it only decides
     which one is on show, and fetches the ones that arrived without a source.

     Hovering previews the next photograph, which is the design's rule and not
     simply "swap to the second image": once the arrows have been used the card
     is off automatic until the pointer leaves and comes back.

     Marking the card live is what takes the CSS fallback out of the way. Until
     then the stylesheet is running the two-photograph hover on its own, so a
     card whose script never arrives still behaves. */

  /* ---- Card metal swatches ---------------------------------------------
     Design revision 13's metal control. Picking a metal moves the caption, the
     price and what goes in the bag — and deliberately not the photograph, which
     is the design's own rule: "we shoot one metal".

     Every swatch is a real link to the piece at that metal, so without this the
     pick still works; it simply navigates. Liquid has already rendered each
     metal's caption and price markup onto the link, so a pick costs no request
     and no arithmetic in the browser.

     How many swatches fit is a question about the card's own width, not the
     viewport's — in a two-column phone grid the card is around 159px and only a
     couple will sit — so it is measured. One observer serves every row on the
     page rather than one apiece. */

  var swatchFit = null;

  function fitSwatches(row) {
    var swatches = Array.prototype.slice.call(row.querySelectorAll('[data-card-metal]'));
    var more = row.querySelector('[data-card-swatch-more]');
    if (!swatches.length) return;

    row.hidden = false;
    swatches.forEach(function (swatch) { swatch.hidden = false; });
    if (more) more.hidden = true;

    var avail = row.clientWidth;
    if (!avail) return;

    var hit = swatches[0].getBoundingClientRect().width || 44;
    var moreWidth = more ? 28 : 0;

    var fits = swatches.length;
    if (swatches.length * hit > avail) {
      fits = Math.max(1, Math.floor((avail - moreWidth) / hit));
    }

    /* The design drops the row when fewer than two metals show. This theme
       keeps it — a lone swatch still states the metal, which is worth the row.
       So the only floor is the one above: at least one always shows. */
    if (fits >= swatches.length) return;

    swatches.forEach(function (swatch, i) { swatch.hidden = i >= fits; });

    if (more) {
      more.textContent = '+' + (swatches.length - fits);
      more.hidden = false;
    }
  }

  function initCardMetals(scope) {
    scope.querySelectorAll('[data-card-swatches]').forEach(function (row) {
      if (!bindOnce(row, 'boundSwatches')) return;

      if (!swatchFit && typeof ResizeObserver !== 'undefined') {
        swatchFit = new ResizeObserver(function (entries) {
          entries.forEach(function (entry) { fitSwatches(entry.target); });
        });
      }

      if (swatchFit) swatchFit.observe(row);
      fitSwatches(row);
    });
  }

  document.addEventListener('click', function (event) {
    var swatch = event.target.closest && event.target.closest('[data-card-metal]');
    if (!swatch) return;

    var card = swatch.closest('[data-card]');
    if (!card) return;

    /* A swatch is a real link to the piece at that metal, so the browser's own
       gestures have to keep working: ctrl/cmd-click opens it in a tab, shift a
       window, alt downloads, and a middle click is a tab too. Calling
       preventDefault on those swallowed a navigation the visitor asked for. */
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof event.button === 'number' && event.button !== 0) return;

    event.preventDefault();

    card.querySelectorAll('[data-card-metal]').forEach(function (other) {
      var on = other === swatch;
      other.classList.toggle('is-selected', on);
      other.setAttribute('aria-current', on ? 'true' : 'false');
    });

    var meta = card.querySelector('[data-card-meta]');
    if (meta && !meta.hasAttribute('data-card-meta-fixed')) {
      meta.textContent = swatch.dataset.metalMeta || '';
    }

    var price = card.querySelector('[data-card-price]');
    if (price) price.innerHTML = swatch.dataset.metalPrice || '';

    /* The piece the caption now describes is the piece the button must add. */
    var addId = card.querySelector('[data-card-add-id]');
    if (addId) addId.value = swatch.dataset.metalId || addId.value;

    /* A metal can be sold out while the one Liquid rendered was not, and the
       button is only a button — nothing else would stop it posting a variant
       that cannot be bought. Liquid hands over both labels so the swap needs no
       string here.

       The button's own labels win over the card's. On a card built from blocks
       the words are the button block's setting, and a block cannot hand a
       setting to its parent — so the attributes live where the setting does.
       The snippet card states them on the root and carries none on the button,
       which is what this falls back to. */
    var add = card.querySelector('.card__add');
    if (add && add.tagName === 'BUTTON') {
      var sold = swatch.dataset.metalAvailable === 'false';
      add.disabled = sold;
      add.setAttribute('aria-disabled', sold ? 'true' : 'false');

      var label = sold
        ? (add.dataset.soldOutLabel || card.dataset.soldOutLabel)
        : (add.dataset.addLabel || card.dataset.addLabel);
      if (label) add.textContent = label;
    }

    /* The quick view opens whatever its href points at, so it follows too. */
    var quick = card.querySelector('[data-quick-view]');
    if (quick && swatch.dataset.metalId) {
      var quickHref = quick.getAttribute('href') || '';
      quick.setAttribute('href', quickHref.split('?')[0] + '?variant=' + swatch.dataset.metalId);
    }

    /* And the piece the card opens. Only the query is replaced, so a card
       whose link already carried one is not doubled. */
    var title = card.querySelector('a.card__title');
    if (title && swatch.dataset.metalId) {
      /* The attribute, not the property: reading .href resolves it against the
         document and would rewrite every card's link as an absolute URL. */
      var href = title.getAttribute('href') || '';
      title.setAttribute('href', href.split('?')[0] + '?variant=' + swatch.dataset.metalId);
    }
  });

  function initCards(scope) {
    scope.querySelectorAll('[data-card]').forEach(function (card) {
      if (!bindOnce(card, 'boundCard')) return;

      var media = card.querySelector('.card__media');
      var slides = Array.prototype.slice.call(card.querySelectorAll('[data-card-slide]'));
      card.setAttribute('data-card-live', '');
      if (!media || !slides.length) return;

      var spinLabel = card.querySelector('[data-card-spin-label]');
      var count = slides.length;
      var photos = slides.filter(function (slide) {
        return !slide.hasAttribute('data-card-spin');
      }).length;

      var index = 0;
      var hovering = false;
      var manual = false;

      function shown() {
        if (hovering && !manual && photos > 1 && index < photos) return (index + 1) % photos;
        return index;
      }

      /* Slides past the first two arrive with no src at all — see
         snippets/card-slide.liquid. The one about to be shown is given its
         source now, and so are its two neighbours, so stepping never waits on
         a request. A card is only ever three photographs' worth of traffic,
         however many the piece has. */
      function load(i) {
        var slide = slides[(i % count + count) % count];
        if (!slide) return;

        var img = slide.querySelector('img[data-src]');
        if (!img) return;

        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        img.src = img.dataset.src;
        delete img.dataset.src;
        delete img.dataset.srcset;
      }

      function paint() {
        var at = shown();

        load(at);
        load(at + 1);
        load(at - 1);

        slides.forEach(function (slide, i) {
          var on = i === at;
          slide.classList.toggle('is-on', on);

          var video = slide.querySelector('video');
          if (!video) return;

          if (on && !reduceMotion.matches) {
            if (!video.src && video.dataset.src) video.src = video.dataset.src;
            watchVideoLqip(video, true);
            video.muted = true;
            requestVideoLqipPlayback(video, false);
          } else if (on) {
            /* Reduced motion keeps the preview blurred until the visitor asks
               to play, then reveals the first genuinely advancing frame. */
            watchVideoLqip(video, true);
          } else if (!video.paused) {
            video.pause();
          }
        });

        if (spinLabel) spinLabel.hidden = !slides[at].hasAttribute('data-card-spin');
      }

      function step(by) {
        index = ((shown() + by) % count + count) % count;
        manual = true;
        paint();
      }

      card.addEventListener('mouseenter', function () { hovering = true; paint(); });
      card.addEventListener('mouseleave', function () {
        hovering = false;
        manual = false;
        paint();
      });

      card.addEventListener('click', function (event) {
        var arrow = event.target.closest && event.target.closest('[data-card-step]');
        if (!arrow) return;
        event.preventDefault();
        step(parseInt(arrow.dataset.cardStep, 10));
      });

      /* Bound on the card, not on the media: the card-wide link covers the
         photographs, so a touch over them targets that link and never reaches
         the media element. Where the touch landed is checked instead, so a
         swipe across the caption still scrolls the page. */
      var swipe = null;

      function inMedia(touch) {
        var box = media.getBoundingClientRect();
        return touch.clientX >= box.left && touch.clientX <= box.right &&
               touch.clientY >= box.top && touch.clientY <= box.bottom;
      }

      card.addEventListener('touchstart', function (event) {
        var touch = event.touches && event.touches[0];
        swipe = touch && inMedia(touch) ? { x: touch.clientX, y: touch.clientY } : null;
      }, { passive: true });

      card.addEventListener('touchend', function (event) {
        var start = swipe;
        swipe = null;
        var touch = event.changedTouches && event.changedTouches[0];
        if (!start || !touch) return;

        var dx = touch.clientX - start.x;
        var dy = touch.clientY - start.y;
        /* Ignore anything that reads more like a scroll than a swipe. */
        if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.4) return;

        step(dx < 0 ? 1 : -1);
      }, { passive: true });

      paint();
    });
  }

  /* ---- Quick view ------------------------------------------------------
     The panel is Liquid's rendering of the product, fetched on demand:
     `<product url>?section_id=quick-view` returns sections/quick-view.liquid
     rendered in that product's own context, exactly as the search overlay
     fetches sections/predictive-search.liquid. Money, translation and image
     sizing therefore never leave Liquid.

     The overlay opens on the click rather than on the response, so the piece
     is never a wait with nothing on screen; the panel wears a loading state
     until the markup lands. The trigger was a real link to the product before
     any of this, and goes back to being one if the request fails.

     Every handler is delegated from the document. The panel's contents are
     replaced wholesale on each open, so a listener bound to anything inside it
     would be pointing at detached markup by the second piece. */

  var quickCache = Object.create(null);
  var quickIndex = 0;

  function quickOverlay() {
    return overlays['quick-view'];
  }

  function quickPanel() {
    var overlay = quickOverlay();
    return overlay ? overlay.el.querySelector('[data-quick-view-panel]') : null;
  }

  /* The details region is a scroll container only where the merchant asked for
     one and only in two columns, and only *then* should it be a tab stop.

     A scroller has to be reachable by keyboard, and nothing gives this one that
     for free: it holds focusable children, which is exactly the case where
     Chrome's keyboard-focusable-scrollers behaviour declines to add it to the
     tab order, and no other engine adds it either. Tabbing through its own
     controls is not a substitute — the specification list sits after every one
     of them, and each `<select>` axis eats the arrow keys to change the variant
     — so the tail of the region would be mouse-only.

     Which is why this is measured rather than rendered. Under the other two
     modes the wrapper is `display: contents` and has no box at all, so both
     values read 0 and the test is false; in two columns with nothing to scroll
     it is false as well. A stray tab stop on a region that does not move is
     worse than none, so the attributes come off again when it stops
     overflowing. */
  function syncQuickDetails() {
    var panel = quickPanel();
    var region = panel && panel.querySelector('.quick-view__details');
    if (!region) return;

    if (region.scrollHeight > region.clientHeight + 1) {
      region.setAttribute('tabindex', '0');
      region.setAttribute('role', 'group');
      region.setAttribute('aria-label', region.dataset.label || '');
    } else {
      region.removeAttribute('tabindex');
      region.removeAttribute('role');
      region.removeAttribute('aria-label');
    }
  }

  function quickFill(html) {
    var panel = quickPanel();
    var host = panel && panel.querySelector('[data-quick-view-contents]');
    if (!panel || !host) return;

    panel.classList.remove('is-loading');
    host.innerHTML = html;
    panel.scrollTop = 0;
    quickIndex = 0;
    resetQuickZoom();
    paintQuick(0);
    blurUp(host, true);
    syncQuickDetails();
  }

  function openQuickView(url) {
    var overlay = quickOverlay();
    var panel = quickPanel();
    var host = panel && panel.querySelector('[data-quick-view-contents]');
    if (!overlay || !panel || !host || !url) return;

    overlay.open();

    if (quickCache[url]) { quickFill(quickCache[url]); return; }

    host.innerHTML = '';
    panel.classList.add('is-loading');

    fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'section_id=quick-view')
      .then(function (res) { return res.ok ? res.text() : Promise.reject(res.status); })
      .then(function (text) {
        var doc = new DOMParser().parseFromString(text, 'text/html');
        var inner = doc.querySelector('[data-quick-view-inner]');
        var html = inner ? inner.innerHTML.trim() : '';
        if (!html) return Promise.reject('empty');
        quickCache[url] = html;
        quickFill(html);
      })
      .catch(function () {
        /* It was a link to the piece before the script touched it. */
        overlay.close(false);
        window.location.href = url;
      });
  }

  function paintQuick(index) {
    var panel = quickPanel();
    var track = panel && panel.querySelector('[data-quick-track]');
    if (!track) return;

    var slots = Array.prototype.slice.call(track.querySelectorAll('[data-quick-slot]'));
    if (!slots.length) return;

    quickIndex = ((index % slots.length) + slots.length) % slots.length;
    track.style.setProperty('--qv-index', quickIndex);

    panel.querySelectorAll('[data-quick-go]').forEach(function (dot) {
      dot.classList.toggle('is-on', parseInt(dot.dataset.quickGo, 10) === quickIndex);
    });

    slots.forEach(function (slot, i) {
      var video = slot.querySelector('video');
      if (!video) return;

      if (i === quickIndex && !reduceMotion.matches) {
        if (!video.src && video.dataset.src) video.src = video.dataset.src;
        watchVideoLqip(video, true);
        video.muted = true;
        requestVideoLqipPlayback(video, false);
      } else if (i === quickIndex) {
        watchVideoLqip(video, true);
      } else if (!video.paused) {
        video.pause();
      }
    });

    resetQuickZoom();
  }

  /* ---- Quick view: zoom ----
     Double-click to magnify at the point clicked, drag to pan, pinch on a
     touch screen, ctrl-wheel on a trackpad — and a minimap showing which part
     of the photograph is actually on screen. */

  var zoom = { el: null, scale: 1, x: 0, y: 0, w: 0, h: 0 };
  var zoomPoints = Object.create(null);
  var zoomDrag = null;
  var zoomPinch = null;
  var zoomFrame = 0;

  function bound(value, limit) {
    return Math.max(-limit, Math.min(limit, value));
  }

  function paintMinimap() {
    var panel = quickPanel();
    var map = panel && panel.querySelector('[data-quick-minimap]');
    var view = panel && panel.querySelector('[data-quick-minimap-view]');
    if (!map || !view) return;

    if (!zoom.el || zoom.scale <= 1.01 || !zoom.w || !zoom.h) { map.hidden = true; return; }

    map.hidden = false;
    map.style.backgroundImage = 'url("' + (zoom.el.currentSrc || zoom.el.src) + '")';
    map.style.height = Math.round(96 * Math.min(2.2, Math.max(0.4, zoom.h / zoom.w))) + 'px';

    var size = 100 / zoom.scale;
    view.style.width = size + '%';
    view.style.height = size + '%';
    view.style.left = (0.5 - zoom.x / (zoom.w * zoom.scale) - 0.5 / zoom.scale) * 100 + '%';
    view.style.top = (0.5 - zoom.y / (zoom.h * zoom.scale) - 0.5 / zoom.scale) * 100 + '%';
  }

  function applyZoom() {
    if (!zoom.el) return;
    zoom.el.style.setProperty('--qv-zoom', zoom.scale);
    zoom.el.style.setProperty('--qv-tx', zoom.x + 'px');
    zoom.el.style.setProperty('--qv-ty', zoom.y + 'px');
    if (zoom.scale > 1.01) zoom.el.setAttribute('data-quick-zoomed', '');
    else zoom.el.removeAttribute('data-quick-zoomed');
    paintMinimap();
  }

  function resetQuickZoom() {
    if (zoom.el) {
      zoom.el.style.removeProperty('--qv-zoom');
      zoom.el.style.removeProperty('--qv-tx');
      zoom.el.style.removeProperty('--qv-ty');
      zoom.el.removeAttribute('data-quick-zoomed');
      zoom.el.removeAttribute('data-quick-dragging');
    }
    zoom = { el: null, scale: 1, x: 0, y: 0, w: 0, h: 0 };
    zoomPoints = Object.create(null);
    zoomDrag = null;
    zoomPinch = null;

    var panel = quickPanel();
    var map = panel && panel.querySelector('[data-quick-minimap]');
    if (map) map.hidden = true;
  }

  function zoomTo(img, scale, clientX, clientY) {
    var box = img.getBoundingClientRect();
    var px = clientX - box.left - box.width / 2;
    var py = clientY - box.top - box.height / 2;

    if (zoom.el && zoom.el !== img) resetQuickZoom();

    zoom.el = img;
    zoom.w = box.width;
    zoom.h = box.height;
    zoom.scale = scale;
    zoom.x = bound(px * (1 - scale), box.width * (scale - 1) / 2);
    zoom.y = bound(py * (1 - scale), box.height * (scale - 1) / 2);
    applyZoom();
  }

  function runZoomFrame() {
    var ids = Object.keys(zoomPoints);

    if (zoomPinch && ids.length >= 2) {
      var a = zoomPoints[ids[0]];
      var b = zoomPoints[ids[1]];
      var box = zoomPinch.box;
      var spread = Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
      var scale = Math.max(1, Math.min(4, zoomPinch.scale * (spread / zoomPinch.spread)));
      var mx = (a.x + b.x) / 2 - box.left - box.width / 2;
      var my = (a.y + b.y) / 2 - box.top - box.height / 2;

      zoom.scale = scale;
      zoom.x = bound(mx - zoomPinch.cx * scale, box.width * (scale - 1) / 2);
      zoom.y = bound(my - zoomPinch.cy * scale, box.height * (scale - 1) / 2);
      applyZoom();
      return;
    }

    if (zoomDrag && ids.length === 1 && zoom.scale > 1) {
      var point = zoomPoints[ids[0]];
      zoom.x = bound(zoomDrag.ox + (point.x - zoomDrag.sx), zoom.w * (zoom.scale - 1) / 2);
      zoom.y = bound(zoomDrag.oy + (point.y - zoomDrag.sy), zoom.h * (zoom.scale - 1) / 2);
      applyZoom();
    }
  }

  /* ---- Quick view: the axes --------------------------------------------
     The panel's option rows are Liquid's — one per product option, with the
     design's swatches, pills or select on each. This is what makes a pick mean
     something: it resolves the chosen values against the variant list Liquid
     embedded beside them and moves the price, each row's caption, the hidden
     variant id and the button.

     Every figure in that list is Liquid's `money`, so nothing here formats a
     price. The "inc. tax" note is a sibling of the figure rather than part of
     it, which is what lets a price change write over the figure alone and
     leave the note standing — the card has to fold the note into its captured
     markup for want of that.

     Delegated from the document like the rest of the quick view: the panel's
     contents are replaced wholesale on every open, so a listener bound inside
     it would be pointing at detached markup by the second piece. */

  function quickVariants() {
    var panel = quickPanel();
    var node = panel && panel.querySelector('[data-qv-variants]');
    if (!node) return null;

    if (node.gjVariants === undefined) {
      try {
        node.gjVariants = JSON.parse(node.textContent);
      } catch (error) {
        node.gjVariants = null;
      }
    }
    return node.gjVariants;
  }

  /* What is chosen on every axis, by the option's own position — which is the
     order `variant.options` comes in, and so the order to compare against. */
  function quickChoice(panel) {
    var choice = [];

    panel.querySelectorAll('[data-qv-group]').forEach(function (group) {
      var index = parseInt(group.dataset.qvGroup, 10);
      var select = group.querySelector('[data-qv-select]');

      if (select) {
        choice[index] = select.value;
        return;
      }

      var on = group.querySelector('[data-qv-pick][aria-pressed="true"]');
      choice[index] = on ? on.dataset.qvValue : '';
    });

    return choice;
  }

  function paintQuickVariant() {
    var panel = quickPanel();
    var variants = quickVariants();
    if (!panel || !variants) return;

    var choice = quickChoice(panel);

    /* Each row says what is chosen on it. The metal row composes the karat into
       its caption — "18K Yellow Gold" is one fact about the piece, which is how
       the design's own metalName() writes it and how a bag line reads. */
    panel.querySelectorAll('[data-qv-group]').forEach(function (group) {
      var caption = group.querySelector('[data-qv-selected]');
      if (!caption) return;

      var text = choice[parseInt(group.dataset.qvGroup, 10)] || '';
      var prefix = caption.dataset.qvPrefix;
      if (prefix !== undefined && choice[parseInt(prefix, 10)]) {
        text = choice[parseInt(prefix, 10)] + ' ' + text;
      }

      caption.textContent = text;
    });

    var add = panel.querySelector('[data-qv-add]');
    var variant = null;

    for (var i = 0; i < variants.length; i++) {
      var options = variants[i].options || [];
      var hit = true;

      for (var j = 0; j < options.length; j++) {
        if (options[j] !== choice[j]) { hit = false; break; }
      }

      if (hit) { variant = variants[i]; break; }
    }

    /* A combination the shop does not make. The price is left as it was rather
       than blanked — it is still the last real figure — and the button is what
       says so, as it does for a sold-out one. */
    if (!variant) {
      if (add) {
        add.disabled = true;
        add.setAttribute('aria-disabled', 'true');
        add.textContent = add.dataset.unavailableLabel;
      }
      return;
    }

    var id = panel.querySelector('[data-qv-variant-id]');
    if (id) id.value = variant.id;

    var price = panel.querySelector('[data-qv-price]');
    if (price) price.textContent = variant.price;

    var compare = panel.querySelector('[data-qv-compare]');
    if (compare) {
      compare.textContent = variant.compareAtPrice || '';
      compare.hidden = !variant.compareAtPrice;
    }

    if (add) {
      add.disabled = !variant.available;
      add.setAttribute('aria-disabled', variant.available ? 'false' : 'true');
      add.textContent = variant.available ? add.dataset.addLabel : add.dataset.soldOutLabel;
    }

    /* And the page the panel offers, which is now this piece. Only the query is
       replaced, so a link that already carried one is not doubled. */
    var full = panel.querySelector('.quick-view__full');
    if (full) {
      var href = full.getAttribute('href') || '';
      full.setAttribute('href', href.split('?')[0] + '?variant=' + variant.id);
    }
  }

  function initQuickView() {
    /* Both thresholds the details region depends on — the panel's width and the
       viewport's height — move on a resize, so whether it scrolls at all can
       change under an open panel. Cheap enough to answer every time: one
       lookup and two property reads. */
    window.addEventListener('resize', syncQuickDetails, { passive: true });

    /* Any card's quick-view link opens the overlay instead of navigating. */
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest && event.target.closest('[data-quick-view]');
      if (!trigger || !quickOverlay()) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

      event.preventDefault();
      openQuickView(trigger.getAttribute('href'));
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest) return;

      var step = event.target.closest('[data-quick-step]');
      if (step) {
        paintQuick(quickIndex + parseInt(step.dataset.quickStep, 10));
        return;
      }

      var go = event.target.closest('[data-quick-go]');
      if (go) paintQuick(parseInt(go.dataset.quickGo, 10));
    });

    /* Picking a value on any axis — a swatch or a pill. The select's own change
       event covers the third. */
    document.addEventListener('click', function (event) {
      var pick = event.target.closest && event.target.closest('[data-qv-pick]');
      if (!pick) return;

      var group = pick.closest('[data-qv-group]');
      if (!group) return;

      group.querySelectorAll('[data-qv-pick]').forEach(function (other) {
        var on = other === pick;
        other.classList.toggle('is-selected', on);
        other.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      paintQuickVariant();
    });

    document.addEventListener('change', function (event) {
      if (!event.target.matches || !event.target.matches('[data-qv-select]')) return;
      paintQuickVariant();
    });

    /* Engraving looks like an axis and is a line item property, so it moves its
       own field and leaves the variant alone. */
    document.addEventListener('click', function (event) {
      var pick = event.target.closest && event.target.closest('[data-qv-engrave-pick]');
      if (!pick) return;

      var row = pick.closest('[data-qv-engrave]');
      if (!row) return;

      row.querySelectorAll('[data-qv-engrave-pick]').forEach(function (other) {
        var on = other === pick;
        other.classList.toggle('is-selected', on);
        other.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      var caption = row.querySelector('[data-qv-engrave-value]');
      if (caption) caption.textContent = pick.textContent;

      /* Disabled as well as hidden: a disabled control is not submitted, so an
         engraving nobody asked for never reaches the bag. */
      var field = row.querySelector('[data-qv-engrave-field]');
      if (!field) return;

      var wanted = pick.dataset.qvEngravePick === 'on';
      field.hidden = !wanted;
      field.disabled = !wanted;
      if (wanted) field.focus();
    });

    document.addEventListener('dblclick', function (event) {
      var img = event.target.closest && event.target.closest('[data-quick-zoomable]');
      if (!img) return;
      event.preventDefault();

      if (zoom.el === img && zoom.scale > 1) { resetQuickZoom(); return; }
      zoomTo(img, 2.2, event.clientX, event.clientY);
    });

    /* Ctrl-wheel is the trackpad pinch. Passive would forbid the
       preventDefault that stops the browser zooming the whole page. */
    window.addEventListener('wheel', function (event) {
      if (!event.ctrlKey) return;
      var img = event.target.closest && event.target.closest('[data-quick-zoomable]');
      if (!img) return;

      event.preventDefault();

      var box = img.getBoundingClientRect();
      var from = zoom.el === img ? zoom.scale : 1;
      var to = Math.max(1, Math.min(4, from * Math.exp(-event.deltaY * 0.012)));
      if (to === from) return;

      if (to === 1) { resetQuickZoom(); return; }
      if (zoom.el !== img) resetQuickZoom();

      var qx = event.clientX - box.left - box.width / 2;
      var qy = event.clientY - box.top - box.height / 2;
      var ox = zoom.el === img ? zoom.x : 0;
      var oy = zoom.el === img ? zoom.y : 0;

      zoom.el = img;
      zoom.w = box.width;
      zoom.h = box.height;
      zoom.scale = to;
      zoom.x = bound(qx - (qx - ox) * (to / from), box.width * (to - 1) / 2);
      zoom.y = bound(qy - (qy - oy) * (to / from), box.height * (to - 1) / 2);
      applyZoom();
    }, { passive: false });

    document.addEventListener('pointerdown', function (event) {
      var img = event.target.closest && event.target.closest('[data-quick-zoomable]');
      if (!img) return;

      zoomPoints[event.pointerId] = { x: event.clientX, y: event.clientY };
      var ids = Object.keys(zoomPoints);

      if (ids.length === 2) {
        var a = zoomPoints[ids[0]];
        var b = zoomPoints[ids[1]];
        var box = img.getBoundingClientRect();

        if (zoom.el !== img) { resetQuickZoom(); zoomPoints[event.pointerId] = { x: event.clientX, y: event.clientY }; }
        zoom.el = img;
        zoom.w = box.width;
        zoom.h = box.height;

        var mx = (a.x + b.x) / 2 - box.left - box.width / 2;
        var my = (a.y + b.y) / 2 - box.top - box.height / 2;

        zoomPinch = {
          box: box,
          spread: Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)) || 1,
          scale: zoom.scale,
          cx: (mx - zoom.x) / zoom.scale,
          cy: (my - zoom.y) / zoom.scale
        };

        event.preventDefault();
        img.setAttribute('data-quick-dragging', '');
        return;
      }

      if (ids.length === 1 && zoom.el === img && zoom.scale > 1) {
        event.preventDefault();
        zoomDrag = { sx: event.clientX, sy: event.clientY, ox: zoom.x, oy: zoom.y };
        img.setAttribute('data-quick-dragging', '');
      }
    });

    document.addEventListener('pointermove', function (event) {
      if (!zoomPoints[event.pointerId]) return;
      zoomPoints[event.pointerId] = { x: event.clientX, y: event.clientY };

      if (zoomFrame) return;
      zoomFrame = window.requestAnimationFrame(function () {
        zoomFrame = 0;
        runZoomFrame();
      });
    });

    function releasePointer(event) {
      if (!zoomPoints[event.pointerId]) return;
      delete zoomPoints[event.pointerId];

      var ids = Object.keys(zoomPoints);
      if (ids.length < 2) zoomPinch = null;

      /* Lifting one finger out of a pinch leaves the other one panning. */
      if (ids.length === 1 && zoom.scale > 1) {
        zoomDrag = { sx: zoomPoints[ids[0]].x, sy: zoomPoints[ids[0]].y, ox: zoom.x, oy: zoom.y };
        return;
      }

      if (ids.length) return;

      zoomDrag = null;
      if (zoom.el) zoom.el.removeAttribute('data-quick-dragging');
      /* Pinched back to about life size — settle at exactly life size. */
      if (zoom.scale <= 1.06) resetQuickZoom();
    }

    document.addEventListener('pointerup', releasePointer);
    document.addEventListener('pointercancel', releasePointer);

    /* Swiping the gallery steps it, unless a zoomed photograph is being
       dragged instead. */
    var swipe = null;

    document.addEventListener('touchstart', function (event) {
      var gallery = event.target.closest && event.target.closest('[data-quick-gallery]');
      if (!gallery || zoom.scale > 1) { swipe = null; return; }
      var touch = event.touches && event.touches[0];
      swipe = touch ? { x: touch.clientX, y: touch.clientY } : null;
    }, { passive: true });

    document.addEventListener('touchend', function (event) {
      var start = swipe;
      swipe = null;
      if (!start || zoom.scale > 1) return;
      if (!event.target.closest || !event.target.closest('[data-quick-gallery]')) return;

      var touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;

      var dx = touch.clientX - start.x;
      var dy = touch.clientY - start.y;
      if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.4) return;

      paintQuick(quickIndex + (dx < 0 ? 1 : -1));
    }, { passive: true });

    document.addEventListener('overlay:close', function (event) {
      var el = event.target;
      if (!el.matches || !el.matches('[data-overlay="quick-view"]')) return;
      resetQuickZoom();
      el.querySelectorAll('video').forEach(function (video) {
        if (!video.paused) video.pause();
      });
    });
  }

  /* ---- Tooltip ---------------------------------------------------------
     One chip for the whole document, delegated: anything carrying data-tip
     gets it on hover or keyboard focus. A touch pointer is ignored, because a
     tap would raise a chip nobody asked for. Purely decorative — every
     control that has one also has its own accessible name. */

  function initTooltips() {
    var DELAY = 130;
    var GAP = 9;

    var chip = null;
    var label = null;
    var arrow = null;
    var current = null;
    var showTimer = 0;
    var hideTimer = 0;

    function build() {
      chip = document.createElement('div');
      chip.className = 'tip';
      chip.setAttribute('role', 'tooltip');

      arrow = document.createElement('span');
      arrow.className = 'tip__arrow';

      label = document.createElement('span');
      label.className = 'tip__label';

      chip.appendChild(arrow);
      chip.appendChild(label);
      document.body.appendChild(chip);
    }

    function place(target) {
      var anchor = target.getBoundingClientRect();
      var box = chip.getBoundingClientRect();
      var below = anchor.top - box.height - GAP < 6;

      var left = anchor.left + anchor.width / 2 - box.width / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - box.width - 8));

      chip.style.left = Math.round(left) + 'px';
      chip.style.top = Math.round(below ? anchor.bottom + GAP : anchor.top - box.height - GAP) + 'px';
      chip.style.transformOrigin = '50% ' + (below ? '0%' : '100%');
      chip.classList.toggle('tip--below', below);

      /* The arrow keeps pointing at the thing it describes even when the chip
         has been pushed back inside the viewport. */
      var point = anchor.left + anchor.width / 2 - left;
      arrow.style.left = Math.round(Math.max(11, Math.min(point, box.width - 11)) - 4) + 'px';

      return below;
    }

    function show(target) {
      var text = target.getAttribute('data-tip');
      if (!text) return;

      current = target;
      if (!chip) build();

      label.textContent = text;
      chip.classList.remove('is-on');
      place(target);
      /* Re-place once the chip has been measured at its real width. */
      place(target);
      chip.classList.add('is-on');
    }

    function hide() {
      current = null;
      window.clearTimeout(showTimer);
      if (!chip) return;

      chip.classList.remove('is-on');
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(function () {
        if (!current && chip) chip.style.left = '-9999px';
      }, 220);
    }

    function trigger(node) {
      return node && node.closest ? node.closest('[data-tip]') : null;
    }

    document.addEventListener('pointerover', function (event) {
      if (event.pointerType === 'touch') return;
      var target = trigger(event.target);
      if (!target || target === current) return;
      window.clearTimeout(showTimer);
      showTimer = window.setTimeout(function () { show(target); }, DELAY);
    }, true);

    document.addEventListener('pointerout', function (event) {
      var target = trigger(event.target);
      if (!target) return;
      if (event.relatedTarget && trigger(event.relatedTarget) === target) return;
      hide();
    }, true);

    document.addEventListener('focusin', function (event) {
      var target = trigger(event.target);
      if (target &&
          !target.hasAttribute('data-tip-silent-focus') &&
          event.target.matches(':focus-visible')) {
        show(target);
      }
    }, true);

    document.addEventListener('focusout', hide, true);
    document.addEventListener('pointerdown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') hide();
    }, true);
  }

  /* ---- Hero carousel --------------------------------------------------
     Two pieces at a time out of the selected metal's collection. The whole
     pool is already in the document, so stepping is a matter of choosing
     which pair is on show — no request, and every piece stays a real link
     for a visitor without scripting, who simply sees the first pair. */

  /* The hero is a screenful, and its content does not always agree. Rather
     than clip it — which loses the call to action first — the design scales
     the whole grid down until it fits, and if even the floor is not enough
     it releases the section to grow instead.

     Binary search rather than a formula because the grid's height is not a
     linear function of the scale: type wraps, the carousel captions reflow.
     Eight passes lands within half a percent. */

  function fitHero(hero) {
    var outer = hero.querySelector('[data-hero-fit]');
    var grid = hero.querySelector('[data-hero-grid]');
    if (!outer || !grid) return;

    var FLOOR = 0.7;

    function pin(on) {
      hero.style.height = on ? '100dvh' : 'auto';
    }

    /* Measured against the deepest descendant, not the grid's own box: a
       grid item can overflow its track without the container growing. */
    function fits(scale) {
      grid.style.zoom = scale === 1 ? '' : String(scale);

      var box = grid.getBoundingClientRect();
      var bottom = box.bottom;
      var nodes = grid.querySelectorAll('*');
      var scan = nodes.length <= 400 ? nodes : grid.children;

      Array.prototype.forEach.call(scan, function (el) {
        var b = el.getBoundingClientRect().bottom;
        if (b > bottom) bottom = b;
      });

      return (bottom - box.top) <= outer.clientHeight - (scale === 1 ? 0 : 14);
    }

    pin(true);
    var done = fits(1);

    if (!done) {
      var lo = FLOOR;
      var hi = 1;
      var best = FLOOR;

      for (var i = 0; i < 8; i++) {
        var mid = (lo + hi) / 2;
        if (fits(mid)) { best = mid; lo = mid; } else { hi = mid; }
      }

      done = fits(Math.max(FLOOR, best - 0.004));
    }

    /* Even at the floor it does not fit — let the section grow. A hero that
       runs past the fold beats one with its button cut off. */
    if (!done) {
      grid.style.zoom = '';
      pin(false);
    }
  }

  function initHero(scope) {
    scope.querySelectorAll('[data-hero]').forEach(function (hero) {
      if (!bindOnce(hero, 'boundHero')) return;

      var fitTimer = null;
      function refit() {
        window.clearTimeout(fitTimer);
        fitTimer = window.setTimeout(function () { fitHero(hero); }, 120);
      }

      fitHero(hero);
      window.addEventListener('resize', refit, { passive: true });

      /* The bundled faces land after first paint and change every measurement
         this depends on. */
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { fitHero(hero); });
      }

      /* A resize event only covers the viewport changing. Watching the boxes
         themselves also catches content that grew or shrank on its own — and
         it is what lets a scaled-down hero scale back up once there is room
         again, which a listener on window alone would never notice. */
      if ('ResizeObserver' in window) {
        var outer = hero.querySelector('[data-hero-fit]');
        var grid = hero.querySelector('[data-hero-grid]');

        if (outer && grid) {
          var observer = new ResizeObserver(function () {
            window.clearTimeout(fitTimer);
            fitTimer = window.setTimeout(function () {
              var need = grid.getBoundingClientRect().height;
              var have = outer.clientHeight;
              var scale = parseFloat(grid.style.zoom) || 1;

              /* Too tall, or scaled down with room to spare. */
              if (need > have + 2 || (scale < 1 && need < have - 12)) fitHero(hero);
            }, 150);
          });

          observer.observe(outer);
          observer.observe(grid);
        }
      }

      var pools = Array.prototype.slice.call(hero.querySelectorAll('[data-hero-pool]'));
      var switches = Array.prototype.slice.call(hero.querySelectorAll('[data-hero-metal]'));
      var carousel = hero.querySelector('[data-hero-carousel]');
      var windowEl = hero.querySelector('[data-hero-window]');
      var below = hero.querySelector('.hero-carousel__below');
      if (!pools.length || !windowEl) return;

      var VISIBLE = 2;
      var metal = 0;
      var offset = 0;

      function cards() {
        return Array.prototype.slice.call(pools[metal].querySelectorAll('[data-hero-card]'));
      }

      function paint(replay) {
        pools.forEach(function (pool, i) { pool.hidden = i !== metal; });
        switches.forEach(function (btn, i) {
          btn.classList.toggle('is-on', i === metal);
          btn.setAttribute('aria-pressed', String(i === metal));
        });

        var list = cards();
        var cyclable = list.length > VISIBLE;
        if (carousel) carousel.classList.toggle('is-static', !cyclable);
        if (below) below.hidden = !cyclable;

        if (!list.length) return;
        offset = ((offset % list.length) + list.length) % list.length;

        list.forEach(function (card) { card.hidden = true; });

        for (var n = 0; n < Math.min(VISIBLE, list.length); n++) {
          var card = list[(offset + n) % list.length];
          card.hidden = false;
          card.style.setProperty('--card', n);

          /* Same nodes, new pair: the entry animation only replays if it is
             taken away and given back across a reflow. */
          if (replay && !reduceMotion.matches) {
            card.style.animation = 'none';
            void card.offsetWidth;
            card.style.animation = '';
          }
        }

        /* A different pair can be a different height — captions wrap. */
        if (replay) refit();
      }

      hero.addEventListener('click', function (event) {
        var step = event.target.closest('[data-hero-step]');
        if (step) {
          offset += parseInt(step.dataset.heroStep, 10);
          paint(true);
          return;
        }

        var pick = event.target.closest('[data-hero-metal]');
        if (pick) {
          metal = parseInt(pick.dataset.heroMetal, 10);
          offset = 0;
          paint(true);
        }
      });

      var swipe = null;

      windowEl.addEventListener('touchstart', function (event) {
        var touch = event.touches && event.touches[0];
        swipe = touch ? { x: touch.clientX, y: touch.clientY } : null;
      }, { passive: true });

      windowEl.addEventListener('touchend', function (event) {
        var start = swipe;
        swipe = null;
        var touch = event.changedTouches && event.changedTouches[0];
        if (!start || !touch) return;

        var dx = touch.clientX - start.x;
        var dy = touch.clientY - start.y;
        /* Ignore anything that reads more like a scroll than a swipe. */
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

        offset += dx < 0 ? 1 : -1;
        paint(true);
      }, { passive: true });

      paint(false);
    });
  }

  /* ---- Row carousel ----------------------------------------------------
     The optional carousel layout of a section's row, shared by Most Loved and
     Our Products. Every card is already in the document — Liquid rendered the
     same `.grid-auto` the other layout ships — so nothing here builds markup;
     it only decides which page is on show.
     Without this script the section simply stays that grid, which is why the
     controls are rendered hidden and are only unhidden once there is more
     than one page to move between.

     How many cards fit is not worked out here. `.row-carousel__ruler` carries
     `.grid-auto`'s own width expression and the browser resolves it, so the
     column count is read rather than re-derived — including the 440px
     single-column override, which is a media query on the ruler. The two
     layouts therefore cannot drift apart about a column count. */

  function initRowCarousels(scope) {
    scope.querySelectorAll('[data-row-carousel]').forEach(function (root) {
      if (!bindOnce(root, 'boundRowCarousel')) return;

      var viewport = root.querySelector('[data-row-viewport]');
      var track = root.querySelector('[data-row-track]');
      var ruler = root.querySelector('[data-row-ruler]');
      /* Every element that has no business being there while there is nothing
         to cycle through. Under or over the track that is the one control row;
         beside it there is no row, so it is the two arrows and the marks. */
      var controls = Array.prototype.slice.call(root.querySelectorAll('[data-row-controls]'));
      var marks = root.querySelector('[data-row-dots]');
      var marksTrack = root.querySelector('[data-row-dots-track]');
      var dots = Array.prototype.slice.call(root.querySelectorAll('[data-row-dot]'));
      var cells = Array.prototype.slice.call(root.querySelectorAll('[data-row-cell]'));
      var arrows = Array.prototype.slice.call(root.querySelectorAll('[data-row-step]'));
      if (!viewport || !track || !ruler || !cells.length) return;

      var fade = root.dataset.rowMotion === 'fade';
      var per = 0;
      var pages = 1;
      /* The page on show, and the page it is going to. They differ only while a
         fade is handing one over to the other, which is exactly the window in
         which a second press must not be measured against the old number. */
      var page = 0;
      var target = 0;
      var swapping = false;
      /* The stylesheet's own, so the fallback and the animation land together. */
      var FADE_OUT = 180;

      function measure() {
        var width = viewport.clientWidth;
        var column = ruler.getBoundingClientRect().width;
        var gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
        if (!width || !column) return per || 1;

        /* The count `auto-fit` would reach: as many whole columns as fit, each
           with the gap that follows it. The half pixel absorbs the rounding at
           an exact fit, where the division lands a hair under the integer. */
        var fits = Math.floor((width + gap + 0.5) / (column + gap));
        return Math.max(1, Math.min(fits, cells.length));
      }

      /* Where the marks stand. They are a carousel of their own — a strip in a
         window that clips — so that sixteen pages stay one line instead of
         wrapping into a block of rules: the strip travels to keep the current
         mark near the middle, and what is off either end half-shows past the
         edge, which is how the row says there is more before or after.

         The shift is worked out from the mark's own geometry rather than
         measured off the marks themselves. The current mark is 12px wider than
         the rest and is still growing into that when the page changes, so a
         measurement taken here reads a width in mid-transition and lands the
         strip a few pixels out; the resting figures give the number the strip
         is actually heading for. They are read from the stylesheet, where the
         marks are drawn — the same arrangement as the ruler above. */
      function shiftMarks() {
        if (!marks || !marksTrack) return;

        var style = window.getComputedStyle(marks);
        var mark = parseFloat(style.getPropertyValue('--row-mark')) || 0;
        var wide = parseFloat(style.getPropertyValue('--row-mark-on')) || mark;
        var gap = parseFloat(style.getPropertyValue('--row-mark-gap')) || 0;
        if (!mark) return;

        var win = marks.clientWidth;
        var pitch = mark + gap;
        /* Every mark at rest, plus the extra the current one carries. */
        var strip = pages * pitch - gap + (wide - mark);
        var centre = page * pitch + wide / 2;

        /* Centred, then held inside the strip's own ends: at either end the
           last mark sits flush and the peeking is all on the one side. */
        var shift = Math.min(Math.max(centre - win / 2, 0), Math.max(strip - win, 0));
        root.style.setProperty('--row-mark-shift', shift + 'px');
      }

      function paint(replay) {
        var next = measure();
        if (next !== per) {
          per = next;
          root.style.setProperty('--row-per', per);
        }

        pages = Math.ceil(cells.length / per);
        if (page > pages - 1) page = pages - 1;
        if (page < 0) page = 0;
        /* Fewer pages than there were: whatever a fade is on its way to no
           longer exists, so the two agree again. Mid-hand-over the target is
           the newer answer of the two and is left alone. */
        if (!swapping) target = page;
        root.style.setProperty('--row-page', page);

        var first = page * per;
        var last = first + per;

        cells.forEach(function (cell, i) {
          var on = i >= first && i < last;
          cell.style.setProperty('--row-card', i % per);

          if (fade) {
            cell.hidden = !on;
            return;
          }

          /* Slide keeps the whole row in the document, so the cards either
             side of the page are still focusable — and focusing one scrolls
             the clipped viewport, leaving the track translated away from what
             is on screen. */
          if (on) cell.removeAttribute('inert');
          else cell.setAttribute('inert', '');
        });

        controls.forEach(function (control) {
          control.hidden = pages < 2;
        });

        /* The row is bounded rather than looping: an end is an end, which is
           what the marks beside these already say.

           Reaching an end disables the very control that was just pressed, and
           a disabled button drops focus to <body> — so a keyboard visitor
           stepping to the last page is thrown back to the top of the tab order.
           Focus moves to the arrow that still works. */
        var focused = document.activeElement;

        arrows.forEach(function (arrow) {
          var by = parseInt(arrow.dataset.rowStep, 10);
          arrow.disabled = by < 0 ? page === 0 : page >= pages - 1;
        });

        if (focused && focused.disabled && arrows.indexOf(focused) !== -1) {
          var live = arrows.filter(function (arrow) { return !arrow.disabled; })[0];
          if (live) live.focus();
        }

        dots.forEach(function (dot, i) {
          dot.hidden = i >= pages;
          if (i === page) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
        });

        shiftMarks();

        /* Same nodes, new page: the entry animation only replays if it is
           taken away and given back across a reflow. Slide has a motion of its
           own and must not have it cut across. */
        if (fade && replay && !reduceMotion.matches) {
          for (var n = first; n < Math.min(last, cells.length); n++) {
            var child = cells[n].firstElementChild;
            if (!child) continue;
            child.style.animation = 'none';
            void child.offsetWidth;
            child.style.animation = '';
          }
        }
      }

      /* Slide moves the track and the change *is* the motion, so it happens at
         once. Fade has nothing of its own to move, and taking the page away in
         one frame and rising the next one in reads as a flicker rather than as
         a fade — so it hands over: the cards on show leave behind a fade, the
         swap happens while nothing is on screen, and the arriving page plays
         `gj-card` as it always has. `afterFade` is the drawer's mechanic, doing
         the same job here. */
      function go(to) {
        var clamped = Math.max(0, Math.min(to, pages - 1));
        if (clamped === target) return;
        target = clamped;

        if (!fade || reduceMotion.matches) {
          page = target;
          paint(true);
          return;
        }

        /* A press while one is in flight is held, not dropped: the hand-over
           already running lands on whatever `target` says by the time it gets
           there. The same answer the cart gives a quick second press. */
        if (swapping) return;
        swapping = true;

        var leaving = cells.filter(function (cell) { return !cell.hidden; });
        leaving.forEach(function (cell) { cell.setAttribute('data-row-leaving', ''); });

        afterFade(viewport, FADE_OUT, function () {
          leaving.forEach(function (cell) { cell.removeAttribute('data-row-leaving'); });
          swapping = false;
          page = target;
          paint(true);
        });
      }

      root.addEventListener('click', function (event) {
        var step = event.target.closest('[data-row-step]');
        if (step) {
          /* Stepped from where it is going, not from where it still is, or a
             second press during a fade would ask for the page already on its
             way and be thrown away as a no-op. */
          go(target + parseInt(step.dataset.rowStep, 10));
          return;
        }

        var dot = event.target.closest('[data-row-dot]');
        if (dot) go(parseInt(dot.dataset.rowDot, 10));
      });

      /* A swipe across a card's photographs belongs to the card — it steps
         through the piece's own images. Anywhere else on the row moves the
         carousel. The same test the card itself makes, so the two agree
         rather than both answering the one gesture. */
      function cardOwns(touch, node) {
        var card = node && node.closest ? node.closest('[data-card]') : null;
        if (!card || card.querySelectorAll('[data-card-slide]').length < 2) return false;

        var media = card.querySelector('.card__media');
        if (!media) return false;

        var box = media.getBoundingClientRect();
        return touch.clientX >= box.left && touch.clientX <= box.right &&
               touch.clientY >= box.top && touch.clientY <= box.bottom;
      }

      var swipe = null;

      viewport.addEventListener('touchstart', function (event) {
        var touch = event.touches && event.touches[0];
        swipe = touch && !cardOwns(touch, event.target)
          ? { x: touch.clientX, y: touch.clientY }
          : null;
      }, { passive: true });

      viewport.addEventListener('touchend', function (event) {
        var start = swipe;
        swipe = null;
        var touch = event.changedTouches && event.changedTouches[0];
        if (!start || !touch) return;

        var dx = touch.clientX - start.x;
        var dy = touch.clientY - start.y;
        /* Ignore anything that reads more like a scroll than a swipe. */
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

        go(target + (dx < 0 ? 1 : -1));
      }, { passive: true });

      /* The count follows the component's own width, not the screen's, so a
         carousel in a narrow section is right too. */
      if ('ResizeObserver' in window) {
        new ResizeObserver(function () { paint(false); }).observe(viewport);
      } else {
        window.addEventListener('resize', function () { paint(false); }, { passive: true });
      }

      /* Measured while the track is still the plain grid, and only then handed
         over: --row-per has to hold a number before the live rules can size a
         column, or `grid-auto-columns` is invalid and the row collapses. */
      paint(false);
      root.setAttribute('data-row-live', '');
    });
  }

  /* ---- Lookbook -------------------------------------------------------
     Every scene, point, card and list row is already in the document —
     Liquid rendered them all. Nothing here builds markup; it only decides
     what is shown. A visitor without scripting still gets the first look
     and real links to every piece in it.

     On a film, a point can carry an in and an out second, and appears as
     its piece comes on screen. */

  function initLookbook(scope) {
    scope.querySelectorAll('[data-lookbook]').forEach(function (root) {
      if (!bindOnce(root, 'boundLookbook')) return;

      var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-look-tab]'));
      var stage = root.querySelector('[data-look-stage]');
      var film = root.querySelector('[data-look-film]');
      if (!stage) return;

      var scene = 0;
      var pin = null;

      function all(selector) {
        return Array.prototype.slice.call(root.querySelectorAll(selector));
      }

      function inScene(selector, index) {
        return all(selector).filter(function (el) {
          return parseInt(el.dataset.lookPinScene || el.dataset.lookCardScene ||
                          el.dataset.lookRowScene, 10) === index;
        });
      }

      function video() {
        var panel = root.querySelector('[data-look-scene="' + scene + '"]');
        return panel ? panel.querySelector('video') : null;
      }

      /* ---- Points and cards ---- */

      function closeCard() {
        pin = null;
        all('[data-look-card]').forEach(function (c) { c.hidden = true; });
        all('.lookbook-pin').forEach(function (p) { p.classList.remove('is-active'); });
        all('.lookbook-row').forEach(function (r) { r.classList.remove('is-active'); });
      }

      function openPin(index) {
        if (pin === index) { closeCard(); return; }
        closeCard();
        pin = index;

        var card = root.querySelector(
          '[data-look-card="' + index + '"][data-look-card-scene="' + scene + '"]'
        );
        if (card) card.hidden = false;

        var marker = root.querySelector(
          '[data-look-pin="' + index + '"][data-look-pin-scene="' + scene + '"]'
        );
        if (marker) marker.classList.add('is-active');

        var row = root.querySelector(
          '[data-look-row="' + index + '"][data-look-row-scene="' + scene + '"]'
        );
        if (row) row.classList.add('is-active');
      }

      /* ---- Film timing ----
         A point with no window is simply always there. */

      function applyTiming() {
        var v = video();
        if (!v) return;
        var t = v.currentTime || 0;

        inScene('.lookbook-pin', scene).forEach(function (marker) {
          var from = parseFloat(marker.dataset.lookIn) || 0;
          var to = parseFloat(marker.dataset.lookOut) || 0;
          if (!to) return;
          var index = parseInt(marker.dataset.lookPin, 10);
          marker.hidden = !(t >= from && t <= to) && pin !== index;
        });
      }

      function clock(seconds) {
        if (!isFinite(seconds)) seconds = 0;
        var m = Math.floor(seconds / 60);
        var s = Math.floor(seconds % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
      }

      function paintFilm() {
        var v = video();
        if (!film) return;

        film.hidden = !v;
        if (!v) return;

        var fill = film.querySelector('[data-look-fill]');
        var time = film.querySelector('[data-look-time]');
        var glyph = film.querySelector('[data-look-play-glyph]');
        var dur = v.duration || 0;

        if (fill) fill.style.width = (dur ? (v.currentTime / dur) * 100 : 0) + '%';
        if (time) time.textContent = clock(v.currentTime) + ' / ' + clock(dur);
        if (glyph) glyph.innerHTML = v.paused ? '&#9654;' : '&#10074;&#10074;';

        applyTiming();
      }

      function paintMarks() {
        var v = video();
        var marks = film && film.querySelector('[data-look-marks]');
        if (!marks) return;

        marks.innerHTML = '';
        var dur = v && v.duration;
        if (!dur) return;

        inScene('.lookbook-pin', scene).forEach(function (marker) {
          var from = parseFloat(marker.dataset.lookIn) || 0;
          if (!from) return;
          var tick = document.createElement('span');
          tick.style.left = (from / dur) * 100 + '%';
          marks.appendChild(tick);
        });
      }

      /* ---- Scenes ---- */

      function show(index) {
        scene = index;
        closeCard();

        tabs.forEach(function (tab, i) {
          tab.classList.toggle('is-active', i === index);
          tab.setAttribute('aria-selected', String(i === index));
        });

        all('[data-look-scene]').forEach(function (panel) {
          var on = parseInt(panel.dataset.lookScene, 10) === index;
          panel.hidden = !on;
          var v = panel.querySelector('video');
          if (v && !on) v.pause();
        });

        all('[data-look-tag]').forEach(function (tag) {
          tag.hidden = parseInt(tag.dataset.lookTag, 10) !== index;
        });

        all('.lookbook-pin').forEach(function (marker) {
          marker.hidden = parseInt(marker.dataset.lookPinScene, 10) !== index;
        });

        all('[data-look-rows]').forEach(function (rows) {
          rows.hidden = parseInt(rows.dataset.lookRows, 10) !== index;
        });

        all('[data-look-count]').forEach(function (count) {
          count.hidden = parseInt(count.dataset.lookCount, 10) !== index;
        });

        var v = video();
        if (v) {
          v.muted = true;
          v.setAttribute('playsinline', '');
          v.loop = true;
          if (v.readyState >= 1) { paintMarks(); paintFilm(); }
        }
        paintFilm();
      }

      /* ---- Wiring ---- */

      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function () { show(i); });
      });

      root.addEventListener('click', function (event) {
        var marker = event.target.closest('.lookbook-pin');
        if (marker) {
          openPin(parseInt(marker.dataset.lookPin, 10));
          return;
        }

        if (event.target.closest('[data-look-card-close]')) { closeCard(); return; }

        var pick = event.target.closest('[data-look-row-pick]');
        if (pick) {
          var row = pick.closest('.lookbook-row');
          if (row) openPin(parseInt(row.dataset.lookRow, 10));
        }
      });

      /* Hovering a row lights its point, and the other way round. */
      root.addEventListener('mouseover', function (event) {
        var row = event.target.closest('.lookbook-row');
        if (!row || row.classList.contains('is-active')) return;
        var marker = root.querySelector(
          '[data-look-pin="' + row.dataset.lookRow + '"][data-look-pin-scene="' + scene + '"]'
        );
        if (marker) marker.classList.add('is-active');
      });

      root.addEventListener('mouseout', function (event) {
        var row = event.target.closest('.lookbook-row');
        if (!row || row.classList.contains('is-active')) return;
        var marker = root.querySelector(
          '[data-look-pin="' + row.dataset.lookRow + '"][data-look-pin-scene="' + scene + '"]'
        );
        if (marker && parseInt(marker.dataset.lookPin, 10) !== pin) {
          marker.classList.remove('is-active');
        }
      });

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && pin !== null) closeCard();
      });

      if (film) {
        var play = film.querySelector('[data-look-play]');
        var bar = film.querySelector('[data-look-bar]');

        if (play) {
          play.addEventListener('click', function () {
            var v = video();
            if (!v) return;
            if (v.paused) {
              watchVideoLqip(v, true);
              requestVideoLqipPlayback(v, false);
            } else {
              v.pause();
            }
            paintFilm();
          });
        }

        if (bar) {
          bar.addEventListener('click', function (event) {
            var v = video();
            if (!v || !v.duration) return;
            var box = bar.getBoundingClientRect();
            v.currentTime = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * v.duration;
            paintFilm();
          });
        }
      }

      stage.addEventListener('timeupdate', paintFilm, true);
      stage.addEventListener('loadedmetadata', function () { paintMarks(); paintFilm(); }, true);
      stage.addEventListener('play', paintFilm, true);
      stage.addEventListener('pause', paintFilm, true);

      /* Play only while the stage is actually on screen. */
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            var v = video();
            if (!v) return;
            if (entry.isIntersecting && !reduceMotion.matches) {
              watchVideoLqip(v, true);
              requestVideoLqipPlayback(v, false);
            } else {
              v.pause();
            }
          });
        }, { threshold: 0.4 }).observe(stage);
      }

      show(0);
    });
  }

  /* ---- Footer accordion ---------------------------------------------
     The toggle is inert above the container-query threshold, where CSS
     already holds every panel open, so this only ever runs on narrow
     footers. */

  function initFooter(scope) {
    scope.querySelectorAll('[data-footer-toggle]').forEach(function (btn) {
      if (!bindOnce(btn, 'boundFooter')) return;

      btn.addEventListener('click', function () {
        var col = btn.closest('.footer__col');
        var group = col && col.closest('[data-footer-cols]');
        if (!col || !group) return;

        var open = col.hasAttribute('data-open');

        /* One row at a time, as the design does: opening a section closes
           whichever was already open. */
        group.querySelectorAll('.footer__col[data-open]').forEach(function (other) {
          other.removeAttribute('data-open');
          var toggle = other.querySelector('[data-footer-toggle]');
          if (toggle) toggle.setAttribute('aria-expanded', 'false');
        });

        if (!open) {
          col.setAttribute('data-open', '');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ---- Cookie choice -------------------------------------------------
     Record the decision with Shopify's Customer Privacy API where it is
     available, so declining actually withholds consent rather than only
     hiding the notice. */

  function initCookieChoice(scope) {
    scope.querySelectorAll('[data-cookie-choice]').forEach(function (btn) {
      if (!bindOnce(btn, 'boundCookie')) return;

      btn.addEventListener('click', function () {
        var choice = btn.dataset.cookieChoice;
        var accepted = choice === 'all';

        /* The key is the notice's own `data-storage-key`, not a literal. The
           overlay controller reads that same attribute to decide whether this
           visitor has answered already (see `storageKey` in registerOverlay),
           so a literal here is two names for one fact — and renaming the theme
           proved it: the attribute moved and this did not, which would have
           left the notice writing one key and testing another, and so asking
           every visitor again on every page. */
        var notice = btn.closest('[data-storage-key]');
        var key = notice && notice.dataset.storageKey;
        if (key) safeStore(function () { localStorage.setItem(key, choice); });

        var api = window.Shopify && window.Shopify.customerPrivacy;
        if (api && typeof api.setTrackingConsent === 'function') {
          try {
            api.setTrackingConsent(
              { analytics: accepted, marketing: accepted, preferences: accepted },
              function () {}
            );
          } catch (e) { /* consent API unavailable — the stored choice still stands */ }
        }

        var banner = overlays['cookie-preferences'];
        if (banner) banner.close(false);
      });
    });
  }

  /* ---- Scroll reveal -------------------------------------------------
     Elements are visible by default in CSS for no-JS and reduced-motion
     visitors; the class is only added once we know we can animate. */

  function initReveals(scope) {
    var targets = scope.querySelectorAll('.reveal:not([data-revealed])');
    if (!targets.length) return;

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) {
        el.dataset.revealed = 'true';
        el.classList.add('is-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

    targets.forEach(function (el) {
      el.dataset.revealed = 'true';
      observer.observe(el);
    });
  }

  /* ---- Testimonials --------------------------------------------------- */

  function initQuotes(scope) {
    scope.querySelectorAll('[data-quotes]').forEach(function (group) {
      if (!bindOnce(group, 'boundQuotes')) return;

      var quotes = Array.prototype.slice.call(group.querySelectorAll('[data-quote]'));
      if (quotes.length < 2) return;

      var section = group.closest('.section') || group.parentNode;
      var dots = section
        ? Array.prototype.slice.call(section.querySelectorAll('[data-quote-dots] button'))
        : [];

      var index = 0;
      var timer = null;
      var interval = parseInt(group.dataset.interval, 10) || 7000;
      var autorotate = group.dataset.autorotate === 'true' && !reduceMotion.matches;

      function show(next) {
        index = (next + quotes.length) % quotes.length;
        quotes.forEach(function (q, i) { q.classList.toggle('is-active', i === index); });
        dots.forEach(function (d, i) { d.setAttribute('aria-selected', String(i === index)); });
      }

      function stop() {
        if (timer) { window.clearInterval(timer); timer = null; }
      }

      function start() {
        if (!autorotate) return;
        stop();
        timer = window.setInterval(function () { show(index + 1); }, interval);
      }

      dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () { show(i); start(); });
      });

      group.addEventListener('mouseenter', stop);
      group.addEventListener('mouseleave', start);
      group.addEventListener('focusin', stop);
      group.addEventListener('focusout', start);

      show(0);
      start();
    });
  }

  /* ---- Localization --------------------------------------------------- */

  function initLocalization(scope) {
    scope.querySelectorAll('[data-localization-select]').forEach(function (select) {
      if (!bindOnce(select, 'boundLocale')) return;
      select.addEventListener('change', function () {
        if (select.form) select.form.submit();
      });
    });
  }

  /* ---- Boot ----------------------------------------------------------- */

  function init(scope) {
    initReveals(scope);
    initQuotes(scope);
    initLocalization(scope);
    initFooter(scope);
    initHero(scope);
    initRowCarousels(scope);
    initLookbook(scope);
    blurUp(scope);
    initCards(scope);
    initCardMetals(scope);
    initOverlays(scope);
    initCookieChoice(scope);
  }

  function boot() {
    initMediaLqipObserver();
    initNav();
    init(document);
    initSearch();

    /* Bound once for the life of the page, unlike everything above. */
    initOverlayTriggers();
    initSearchTriggers();
    initCartTriggers();
    initQuickView();
    initTooltips();

    /* Shopify bounces back with this after a customer form posts, so the
       newsletter modal can reopen on its success state. */
    if (window.location.search.indexOf('customer_posted=true') !== -1) {
      var news = overlays.newsletter;
      if (news) news.open();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* The theme editor swaps section markup in place; rebind on reload. */
  document.addEventListener('shopify:section:load', function (event) {
    initNav();
    init(event.target);
    initSearch();
  });
})();
