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

    Array.prototype.forEach.call(slides, function (slide) {
      var active = slide === target;
      slide.hidden = !active;
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      Array.prototype.forEach.call(slide.querySelectorAll('video'), function (video) {
        if (!active) video.pause();
      });
    });

    Array.prototype.forEach.call(root.querySelectorAll('[data-product-media-control]'), function (control) {
      var active = String(control.dataset.mediaId) === String(target.dataset.mediaId);
      control.setAttribute('aria-current', active ? 'true' : 'false');
      control.classList.toggle('is-active', active);
    });
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
        submit.textContent = submit.dataset.unavailableLabel;
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

    if (submit) {
      submit.disabled = !variant.available;
      submit.textContent = variant.available ? submit.dataset.addLabel : submit.dataset.soldOutLabel;
    }

    if (variant.featuredMediaId) showMedia(root, variant.featuredMediaId);
    pickupAvailability(root, variant.id);

    var url = new URL(window.location.href);
    url.searchParams.set('variant', variant.id);
    window.history.replaceState({}, '', url.href);
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

  function initProduct(root) {
    if (root.dataset.productBound === 'true') return;
    root.dataset.productBound = 'true';

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
        var controls = Array.prototype.slice.call(root.querySelectorAll('[data-product-media-control]'));
        var activeIndex = controls.findIndex(function (control) { return control.classList.contains('is-active'); });
        var delta = direction.dataset.productGalleryStep === 'next' ? 1 : -1;
        var nextIndex = (activeIndex + delta + controls.length) % controls.length;
        if (controls[nextIndex]) showMedia(root, controls[nextIndex].dataset.mediaId);
        return;
      }

      var quantityButton = event.target.closest('[data-quantity-step]');
      if (quantityButton) {
        var input = root.querySelector('[data-product-quantity]');
        if (!input) return;
        var step = Number(quantityButton.dataset.quantityStep);
        var minimum = Number(input.min || 1);
        input.value = Math.max(minimum, Number(input.value || minimum) + step);
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
  }

  function initProducts(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('[data-main-product]'), initProduct);
  }

  function bootProducts() {
    initProducts(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootProducts);
  } else {
    bootProducts();
  }

  document.addEventListener('shopify:section:load', function (event) {
    initProducts(event.target);
  });
})();
