(function () {
  if (document.documentElement.dataset.mainCartReady === 'true') return;
  document.documentElement.dataset.mainCartReady = 'true';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function routeRoot() {
    return window.Shopify && window.Shopify.routes && window.Shopify.routes.root
      ? window.Shopify.routes.root
      : '/';
  }

  function afterRemovalMotion(row) {
    if (reduceMotion.matches || !window.Promise) return Promise.resolve();

    /* Resolve styles after data-leaving is set so getAnimations() sees the
       real CSS transitions. A timeout remains only as a cancelled-transition
       backstop. */
    void row.offsetWidth;

    return new Promise(function (resolve) {
      var finished = false;
      var animations = [];

      function done() {
        if (finished) return;
        finished = true;
        resolve();
      }

      try {
        if (row.getAnimations) {
          animations = row.getAnimations({ subtree: true }).filter(function (animation) {
            return animation.playState === 'running' || animation.playState === 'paused';
          });
        }
      } catch (error) { animations = []; }

      if (animations.length) {
        Promise.all(animations.map(function (animation) {
          return animation.finished.catch(function () {});
        })).then(done);
      }

      window.setTimeout(done, 450);
    });
  }

  function syncCartCount(scope) {
    var source = scope.querySelector('[data-cart-count-value]');
    if (!source) return;

    var count = parseInt(source.dataset.cartCountValue, 10) || 0;
    document.querySelectorAll('[data-cart-count]').forEach(function (badge) {
      badge.textContent = count;
      badge.hidden = count === 0;
    });

    document.querySelectorAll('[data-cart-status]').forEach(function (status) {
      if (status.textContent === source.dataset.cartAnnounce) status.textContent = '';
      status.textContent = source.dataset.cartAnnounce || '';
    });
  }

  function cartRowByKey(scope, key) {
    var match = null;
    scope.querySelectorAll('[data-cart-line]').forEach(function (line) {
      if (!match && line.dataset.cartLine === key) match = line;
    });
    return match;
  }

  function focusWithoutScroll(element) {
    if (!element || !element.focus) return;
    try { element.focus({ preventScroll: true }); }
    catch (error) { element.focus(); }
  }

  /* Re-rendering keeps totals authoritative, but a remove must not erase a
     cart note or quantities the shopper has typed and not submitted yet. */
  function preserveDrafts(current, next, removedKey) {
    var note = current.querySelector('textarea[name="note"]');
    var nextNote = next.querySelector('textarea[name="note"]');
    if (note && nextNote) nextNote.value = note.value;

    current.querySelectorAll('[data-cart-line]').forEach(function (line) {
      var key = line.dataset.cartLine;
      if (!key || key === removedKey) return;
      var input = line.querySelector('input[name="updates[]"]');
      if (!input) return;

      var nextLine = cartRowByKey(next, key);
      var nextInput = nextLine && nextLine.querySelector('input[name="updates[]"]');
      if (nextInput) nextInput.value = input.value;
    });
  }

  function removeLine(link, row, root) {
    if (root.hasAttribute('aria-busy')) return;

    var sectionId = root.dataset.sectionId;
    var key = row.dataset.cartLine;
    if (!sectionId || !key || !window.fetch || !window.Promise) {
      window.location.assign(link.href);
      return;
    }

    root.setAttribute('aria-busy', 'true');
    var adjacent = row.nextElementSibling || row.previousElementSibling;
    var focusKey = adjacent && adjacent.dataset.cartLine;
    var restoreFocus = row.contains(document.activeElement);
    row.style.setProperty('--cart-line-height', Math.ceil(row.getBoundingClientRect().height) + 'px');
    void row.offsetHeight;
    row.setAttribute('data-leaving', '');

    var motion = afterRemovalMotion(row);
    var requestSucceeded = false;
    var request = fetch(routeRoot() + 'cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        id: key,
        quantity: 0,
        sections: sectionId
      })
    }).then(function (response) {
      if (!response.ok) throw new Error('Cart removal failed');
      return response.json();
    }).then(function (payload) {
      requestSucceeded = true;
      return payload;
    });

    Promise.all([request, motion])
      .then(function (result) {
        var payload = result[0];
        var html = payload.sections && payload.sections[sectionId];
        if (!html) throw new Error('Cart section missing');

        var parsed = new DOMParser().parseFromString(html, 'text/html');
        var next = parsed.querySelector('main-cart');
        if (!next) throw new Error('Cart markup missing');

        preserveDrafts(root, next, key);
        next.setAttribute('data-cart-arriving', '');
        root.replaceWith(next);
        syncCartCount(next);
        next.dispatchEvent(new CustomEvent('shopify:section:load', { bubbles: true }));

        if (restoreFocus) {
          var focusRow = focusKey && cartRowByKey(next, focusKey);
          var focusTarget = focusRow && (
            focusRow.querySelector('[data-main-cart-remove]') ||
            focusRow.querySelector('.cart-line__title')
          );
          if (!focusTarget) {
            focusTarget = next.querySelector('.cart-page__heading');
            if (focusTarget) focusTarget.setAttribute('tabindex', '-1');
          }
          focusWithoutScroll(focusTarget);
        }

        window.setTimeout(function () {
          next.removeAttribute('data-cart-arriving');
        }, reduceMotion.matches ? 0 : 380);
      })
      .catch(function () {
        /* Restore the progressive-enhancement path. Before Shopify accepts the
           mutation, retry its real removal URL; after acceptance, reload the
           cart instead of addressing a line key that no longer exists. */
        root.removeAttribute('aria-busy');
        row.removeAttribute('data-leaving');
        row.style.removeProperty('--cart-line-height');
        window.location.assign(requestSucceeded ? routeRoot() + 'cart' : link.href);
      });
  }

  /* Claim and perform the real remove link before an app-level page-transition
     handler can schedule navigation. Without JavaScript the same href remains
     a complete fallback. */
  document.addEventListener('click', function (event) {
    if (!event.target.closest) return;
    var link = event.target.closest('[data-main-cart-remove]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof event.button === 'number' && event.button !== 0) return;
    event.preventDefault();

    /* Perform the action here as well as claiming it. Some app embeds stop a
       claimed link before the event reaches document in the bubble phase;
       keeping removal in capture makes that integration detail irrelevant. */
    var root = link.closest('main-cart');
    var row = link.closest('[data-cart-line]');
    if (root && row) removeLine(link, row, root);
  }, true);

  document.addEventListener('click', function (event) {
    if (!event.target.closest) return;

    var button = event.target.closest('[data-cart-quantity-change]');
    if (!button || !button.closest('main-cart')) return;

    var quantity = button.closest('[data-cart-quantity]');
    var input = quantity ? quantity.querySelector('input[type="number"]') : null;
    if (!input) return;

    /* The input's min/max/step are the line's quantity rule. Native
       validation checks the grid anchored at min, so the discs re-snap
       rather than merely add the increment — the product stepper's own
       rule, and here the stakes are the whole cart form: an off-grid value
       the theme itself wrote would block every submit, checkout included.
       The discs clamp at the minimum rather than reaching zero, because a
       zero is below the minimum the shop sells and this surface's removal
       is the Remove link. */
    var direction = Number(button.dataset.cartQuantityChange);
    var increment = Number(input.step) || 1;
    var minimum = Number(input.min) || 1;
    var maximum = input.max === '' ? Infinity : Number(input.max);
    var next = (Number(input.value) || minimum) + direction * increment;
    next = minimum + Math.round((next - minimum) / increment) * increment;
    input.value = Math.min(maximum, Math.max(minimum, next));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
})();
