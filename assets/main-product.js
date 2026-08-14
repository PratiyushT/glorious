(function () {
  'use strict';

  function parseVariants(root) {
    var source = root.querySelector('[data-product-variants]');
    if (!source) return [];
    try {
      return JSON.parse(source.textContent);
    } catch (error) {
      return [];
    }
  }

  function optionValues(root) {
    var groups = root.querySelectorAll('[data-product-option-group]');
    return Array.prototype.map.call(groups, function (group) {
      var select = group.querySelector('select[data-product-option]');
      if (select) return select.value;
      var checked = group.querySelector('input[data-product-option]:checked');
      return checked ? checked.value : '';
    });
  }

  function selectedVariant(variants, values) {
    for (var i = 0; i < variants.length; i += 1) {
      var matches = true;
      for (var j = 0; j < values.length; j += 1) {
        if (variants[i].options[j] !== values[j]) {
          matches = false;
          break;
        }
      }
      if (matches) return variants[i];
    }
    return null;
  }

  function syncOptionLabels(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-product-option-group]'), function (group) {
      var label = group.querySelector('[data-product-option-selected]');
      if (!label) return;
      var select = group.querySelector('select[data-product-option]');
      var checked = group.querySelector('input[data-product-option]:checked');
      label.textContent = select ? select.value : (checked ? checked.value : '');
    });
  }

  function showMedia(root, mediaId) {
    var slides = root.querySelectorAll('[data-product-media]');
    if (!slides.length) return;

    var target = null;
    for (var i = 0; i < slides.length; i += 1) {
      if (String(slides[i].dataset.mediaId) === String(mediaId)) target = slides[i];
    }
    if (!target) target = slides[0];

    var gallery = target.closest('.product-gallery');
    var isStacked = gallery && gallery.dataset.productGalleryLayout === 'stacked';
    var track = gallery && gallery.querySelector('.product-gallery__track');

    Array.prototype.forEach.call(slides, function (slide) {
      var active = slide === target;
      slide.hidden = false;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', isStacked || active ? 'false' : 'true');
      Array.prototype.forEach.call(slide.querySelectorAll('video'), function (video) {
        if (!active) video.pause();
      });
    });

    if (track && !isStacked) {
      track.style.setProperty('--product-media-index', target.dataset.mediaIndex || 0);
    } else if (isStacked && target.scrollIntoView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    Array.prototype.forEach.call(root.querySelectorAll('[data-product-media-control]'), function (control) {
      var active = String(control.dataset.mediaId) === String(target.dataset.mediaId);
      control.setAttribute('aria-current', active ? 'true' : 'false');
      control.classList.toggle('is-active', active);
    });
  }

  function initStickyColumns(root) {
    var showcase = root.querySelector('.product-showcase');
    var gallery = showcase && showcase.querySelector('.product-gallery');
    var details = showcase && showcase.querySelector('.product-details');
    if (!showcase || !gallery || !details) return;

    function syncStickyColumn() {
      var mode = gallery.dataset.stickyMode || 'adaptive';
      var column = mode;
      if (mode === 'adaptive') {
        /* Pin the shorter column: a sticky element that is the tallest thing
           in its row has no room to move, so pinning the taller one is a
           no-op and nothing sticks. */
        column = gallery.scrollHeight >= details.scrollHeight ? 'details' : 'gallery';
      }
      if (column !== 'gallery' && column !== 'details') column = 'none';
      showcase.dataset.stickyColumn = column;
      if (mode === 'adaptive' && column !== 'none') {
        /* The shorter column must also fit. A pinned column taller than the
           viewport holds its top at the nav offset, so its tail sits below
           the fold for as long as the showcase is on screen — on a stacked
           gallery that hides the end of the details column for the whole
           browse. Explicit Gallery/Details modes keep the merchant's pin
           regardless. The dataset is set first so the sticky top offset can
           be read back resolved to pixels. */
        var pinned = column === 'gallery' ? gallery : details;
        var offset = parseFloat(window.getComputedStyle(pinned).top) || 0;
        if (pinned.offsetHeight + offset > window.innerHeight + 1) {
          showcase.dataset.stickyColumn = 'none';
        }
      }
    }

    if (window.ResizeObserver) {
      var stickyObserver = new ResizeObserver(syncStickyColumn);
      stickyObserver.observe(gallery);
      stickyObserver.observe(details);
    }
    /* The fit check reads window.innerHeight, which a ResizeObserver on the
       columns cannot see change — a window-height resize alone must still
       re-decide. */
    window.addEventListener('resize', syncStickyColumn, { passive: true });
    root.addEventListener('load', syncStickyColumn, true);
    window.setTimeout(syncStickyColumn, 0);
  }

  function pickupAvailability(root, variantId) {
    var container = root.querySelector('[data-pickup-availability]');
    if (!container || !variantId) return;

    var url = container.dataset.rootUrl + 'variants/' + variantId + '/?section_id=pickup-availability';
    container.setAttribute('aria-busy', 'true');

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error('Pickup availability request failed');
        return response.text();
      })
      .then(function (html) {
        var documentFragment = new DOMParser().parseFromString(html, 'text/html');
        var response = documentFragment.querySelector('[data-pickup-availability-response]');
        container.innerHTML = response ? response.innerHTML : '';
        container.removeAttribute('aria-busy');
      })
      .catch(function () {
        container.removeAttribute('aria-busy');
      });
  }

  function syncVariant(root, variants) {
    syncOptionLabels(root);
    var variant = selectedVariant(variants, optionValues(root));
    var price = root.querySelector('[data-product-price]');
    var compare = root.querySelector('[data-product-compare]');
    var unit = root.querySelector('[data-product-unit-price]');
    var sku = root.querySelector('[data-product-sku-value]');
    var submit = root.querySelector('[data-product-submit]');
    var variantInput = root.querySelector('[data-product-variant-id]');

    if (!variant) {
      if (submit) {
        submit.disabled = true;
        (submit.querySelector('[data-button-label]') || submit).textContent = submit.dataset.unavailableLabel;
      }
      if (variantInput) variantInput.value = '';
      return;
    }

    if (variantInput) variantInput.value = variant.id;
    if (price) price.innerHTML = variant.price;
    if (compare) {
      compare.innerHTML = variant.compareAtPrice;
      compare.hidden = !variant.compareAtPrice;
    }
    if (unit) {
      unit.innerHTML = variant.unitPrice;
      unit.hidden = !variant.unitPrice;
    }
    if (sku) sku.textContent = variant.sku;

    var quantity = root.querySelector('[data-product-quantity]');
    if (quantity && variant.quantityRule) {
      var rule = variant.quantityRule;
      quantity.min = rule.min;
      if (rule.max) quantity.max = rule.max;
      else quantity.removeAttribute('max');
      quantity.step = rule.increment;
      /* Snap the carried value onto the new variant's min-anchored grid —
         min and max are multiples of the increment, but a value carried from
         another variant's grid need not be, and an off-grid value the theme
         itself wrote would fail native validation and block the submit
         before the delegated add ever saw it. */
      var carried = Number(quantity.value) || rule.min;
      var snapped = rule.min + Math.round((carried - rule.min) / rule.increment) * rule.increment;
      snapped = Math.max(rule.min, snapped);
      if (rule.max) snapped = Math.min(rule.max, snapped);
      quantity.value = snapped;
    }

    if (submit) {
      submit.disabled = !variant.available;
      (submit.querySelector('[data-button-label]') || submit).textContent = variant.available ? submit.dataset.addLabel : submit.dataset.soldOutLabel;
    }

    if (variant.featuredMediaId) showMedia(root, variant.featuredMediaId);
    pickupAvailability(root, variant.id);

    if (root.hasAttribute('data-product-update-url')) {
      var url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.href);
    }

    var fullDetails = root.querySelector('[data-product-full-details]');
    if (fullDetails) {
      var fullUrl = new URL(fullDetails.href, window.location.origin);
      fullUrl.searchParams.set('variant', variant.id);
      fullDetails.href = fullUrl.href;
    }
  }

  function syncRecipient(root, toggle) {
    var fields = root.querySelector('[data-recipient-fields]');
    if (!fields || !toggle) return;

    fields.hidden = !toggle.checked;
    Array.prototype.forEach.call(fields.querySelectorAll('input, textarea, select'), function (field) {
      field.disabled = !toggle.checked;
    });

    var email = fields.querySelector('[data-recipient-email]');
    if (email) email.required = toggle.checked;

    var offset = fields.querySelector('[data-recipient-offset]');
    if (offset && toggle.checked) offset.value = String(new Date().getTimezoneOffset());
  }

  /* One step function for the arrows and the swipe, wrapping at either end.
     Stacked mode renders no media controls, so both callers are inert there. */
  function stepGallery(root, delta) {
    var controls = Array.prototype.slice.call(root.querySelectorAll('[data-product-media-control]'));
    if (!controls.length) return;
    var activeIndex = controls.findIndex(function (control) { return control.classList.contains('is-active'); });
    var nextIndex = (activeIndex + delta + controls.length) % controls.length;
    if (controls[nextIndex]) showMedia(root, controls[nextIndex].dataset.mediaId);
  }

  function initProduct(root) {
    if (root.dataset.productBound === 'true') return;
    root.dataset.productBound = 'true';

    /* A swipe across the gallery steps it, the same horizontal-intent test the
       row carousel makes: short movements and vertical scrolls pass through.
       Passive listeners — nothing here prevents the page's own gestures. */
    var gallery = root.querySelector('.product-gallery');
    if (gallery) {
      var gallerySwipe = null;
      gallery.addEventListener('touchstart', function (event) {
        var touch = event.touches && event.touches[0];
        gallerySwipe = touch ? { x: touch.clientX, y: touch.clientY } : null;
      }, { passive: true });
      gallery.addEventListener('touchend', function (event) {
        var start = gallerySwipe;
        gallerySwipe = null;
        var touch = event.changedTouches && event.changedTouches[0];
        if (!start || !touch) return;
        var dx = touch.clientX - start.x;
        var dy = touch.clientY - start.y;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        stepGallery(root, dx < 0 ? 1 : -1);
      }, { passive: true });
    }

    var variants = parseVariants(root);

    root.addEventListener('change', function (event) {
      if (event.target.matches('[data-product-option]')) syncVariant(root, variants);

      if (event.target.matches('[data-recipient-toggle]')) {
        syncRecipient(root, event.target);
      }
    });

    root.addEventListener('click', function (event) {
      var mediaControl = event.target.closest('[data-product-media-control]');
      if (mediaControl) {
        showMedia(root, mediaControl.dataset.mediaId);
        return;
      }

      var direction = event.target.closest('[data-product-gallery-step]');
      if (direction) {
        stepGallery(root, direction.dataset.productGalleryStep === 'next' ? 1 : -1);
        return;
      }

      var quantityButton = event.target.closest('[data-quantity-step]');
      if (quantityButton) {
        var input = root.querySelector('[data-product-quantity]');
        if (!input) return;
        /* The input's min/max/step are the variant's quantity rule. Native
           validation checks the grid anchored at min, so the arrows re-snap
           rather than merely add the increment — a typed off-grid value must
           recover on the first press, not ride the wrong grid forever. */
        var increment = Number(input.step) || 1;
        var minimum = Number(input.min) || 1;
        var maximum = input.max === '' ? Infinity : Number(input.max);
        var next = (Number(input.value) || minimum) + Number(quantityButton.dataset.quantityStep) * increment;
        next = minimum + Math.round((next - minimum) / increment) * increment;
        input.value = Math.min(maximum, Math.max(minimum, next));
        return;
      }

      var zoom = event.target.closest('[data-product-zoom]');
      if (zoom) {
        var dialog = root.querySelector('[data-product-zoom-dialog]');
        var image = dialog && dialog.querySelector('img');
        if (dialog && image) {
          image.src = zoom.dataset.zoomSrc;
          image.alt = zoom.querySelector('img') ? zoom.querySelector('img').alt : '';
          if (typeof dialog.showModal === 'function') dialog.showModal();
        }
        return;
      }

      if (event.target.closest('[data-product-zoom-close]')) {
        var openDialog = event.target.closest('dialog');
        if (openDialog) openDialog.close();
      }
    });

    var initial = variants.filter(function (variant) {
      return String(variant.id) === String(root.dataset.initialVariantId);
    })[0] || variants[0];

    var variantInput = root.querySelector('[data-product-variant-id]');
    if (variantInput && initial) variantInput.value = initial.id;
    var recipientToggle = root.querySelector('[data-recipient-toggle]');
    if (recipientToggle) syncRecipient(root, recipientToggle);
    syncOptionLabels(root);
    if (initial) pickupAvailability(root, initial.id);
    initStickyColumns(root);
  }

  function initProducts(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('[data-main-product]'), initProduct);
  }

  function bootProducts() {
    initProducts(document);
  }

  window.VeylinProducts = window.VeylinProducts || {};
  window.VeylinProducts.init = initProducts;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootProducts);
  } else {
    bootProducts();
  }

  document.addEventListener('shopify:section:load', function (event) {
    initProducts(event.target);
  });
})();
