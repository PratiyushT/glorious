(function () {
  'use strict';

  function interpolate(template, values) {
    return Object.keys(values).reduce(function (result, key) {
      return result.replace(new RegExp('\\[\\[' + key + '\\]\\]', 'g'), values[key]);
    }, template);
  }

  function money(value, currency) {
    try {
      return new Intl.NumberFormat(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: currency
      }).format(Number(value));
    } catch (error) {
      return currency + ' ' + Number(value).toFixed(2);
    }
  }

  function element(name, className, text) {
    var node = document.createElement(name);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function enabled(value) {
    return value !== 'false';
  }

  function initBuilder(root) {
    if (root.dataset.builderBound === 'true') return;
    root.dataset.builderBound = 'true';

    var translations = JSON.parse(root.querySelector('[data-builder-translations]').textContent);
    var panels = root.querySelectorAll('[data-builder-panel]');
    var tabs = root.querySelectorAll('[data-builder-tab]');
    var notice = root.querySelector('[data-builder-notice]');
    var noticeText = root.querySelector('[data-builder-notice-text]');
    var retry = root.querySelector('[data-builder-retry]');
    var form = root.querySelector('[data-diamond-filters]');
    var results = root.querySelector('[data-diamond-results]');
    var settingResults = root.querySelector('[data-setting-results]');
    var settingsLoader = root.querySelector('[data-settings-loader]');
    var settingsEmpty = root.querySelector('[data-settings-empty]');
    var fixtureBanner = root.querySelector('[data-fixture-banner]');
    var stagingBanner = root.querySelector('[data-staging-banner]');
    var resultsCount = root.querySelector('[data-results-count]');
    var loaderHost = root.querySelector('[data-results-loader]');
    var loaderTemplate = root.querySelector('[data-builder-loader]');
    var eyeTemplate = root.querySelector('[data-builder-eye]');
    var previousIconTemplate = root.querySelector('[data-builder-chevron-previous]');
    var nextIconTemplate = root.querySelector('[data-builder-chevron-next]');
    var pagination = root.querySelector('[data-diamond-pagination]');
    var previous = root.querySelector('[data-diamond-previous]');
    var next = root.querySelector('[data-diamond-next]');
    var pageLabel = root.querySelector('[data-diamond-page]');
    var addButton = root.querySelector('[data-ring-add]');
    var addButtonLabel = addButton.querySelector('[data-button-label]');
    var defaultAddLabel = addButtonLabel ? addButtonLabel.textContent : '';
    var summarySetting = root.querySelector('[data-summary-setting]');
    var summaryDiamond = root.querySelector('[data-summary-diamond]');
    var summaryTotal = root.querySelector('[data-summary-total]');
    var review = root.querySelector('[data-builder-review]');
    var quickDialog = root.querySelector('[data-builder-quick-view-dialog]');
    var quickContents = root.querySelector('[data-builder-quick-view-contents]');
    var quickTrigger = null;
    var closeTimer = 0;

    var cardConfig = {
      textAlign: root.dataset.cardTextAlign || 'left',
      imageRatio: root.dataset.cardImageRatio || '1 / 1',
      imageFit: root.dataset.cardImageFit || 'contain',
      animate: enabled(root.dataset.cardAnimation),
      media: enabled(root.dataset.showCardMedia),
      badges: enabled(root.dataset.showCardBadges),
      vendor: enabled(root.dataset.showCardVendor),
      title: enabled(root.dataset.showCardTitle),
      options: enabled(root.dataset.showCardOptions),
      price: enabled(root.dataset.showCardPrice),
      action: enabled(root.dataset.showCardAction)
    };

    var quickConfig = {
      media: enabled(root.dataset.showQuickMedia),
      mediaControls: root.dataset.quickMediaControls || 'arrows_dots',
      badges: enabled(root.dataset.showQuickBadges),
      vendor: enabled(root.dataset.showQuickVendor),
      title: enabled(root.dataset.showQuickTitle),
      price: enabled(root.dataset.showQuickPrice),
      options: enabled(root.dataset.showQuickOptions),
      description: enabled(root.dataset.showQuickDescription),
      specs: enabled(root.dataset.showQuickSpecs),
      action: enabled(root.dataset.showQuickAction)
    };

    var state = {
      step: root.dataset.initialStep,
      setting: null,
      diamond: null,
      offset: 0,
      total: 0,
      loaded: false,
      settingsLoaded: false,
      settingsLoading: false,
      loading: false,
      controller: null,
      lastAction: null,
      added: false
    };

    summarySetting.dataset.fallback = summarySetting.textContent;
    summaryDiamond.dataset.fallback = summaryDiamond.textContent;

    function showNotice(message, canRetry, tone) {
      notice.hidden = !message;
      notice.dataset.tone = tone || '';
      noticeText.textContent = message || '';
      retry.hidden = !canRetry;
    }

    function readJson(response, fallbackMessage) {
      return response.text().then(function (text) {
        var payload;
        try {
          payload = text ? JSON.parse(text) : {};
        } catch (error) {
          throw new Error(fallbackMessage);
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error(fallbackMessage);
        }
        if (!response.ok) throw new Error(payload.error || fallbackMessage);
        return payload;
      });
    }

    function setBusy(busy) {
      state.loading = busy;
      form.setAttribute('aria-busy', busy ? 'true' : 'false');
      if (busy) loaderHost.replaceChildren(loaderTemplate.content.cloneNode(true));
      else loaderHost.replaceChildren();
      form.querySelectorAll('button, input, select').forEach(function (control) {
        control.disabled = busy;
      });
    }

    function showStep(step) {
      state.step = step;
      panels.forEach(function (panel) {
        panel.hidden = panel.dataset.builderPanel !== step;
      });
      tabs.forEach(function (tab) {
        var selected = tab.dataset.builderTab === step;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
      });
      if (step === 'settings' && !state.settingsLoaded && !state.settingsLoading) loadSettings();
      if (step === 'diamonds' && !state.loaded && !state.loading) searchDiamonds(false);
      if (step === 'review') renderReview();
    }

    function updateSummary() {
      var unselected = summarySetting.dataset.fallback || summarySetting.textContent;
      summarySetting.textContent = state.setting
        ? state.setting.productTitle + (state.setting.variantTitle === 'Default Title' ? '' : ' · ' + state.setting.variantTitle)
        : unselected;
      summaryDiamond.textContent = state.diamond
        ? [state.diamond.certificate.carats + ' ct', state.diamond.certificate.shape, state.diamond.certificate.color, state.diamond.certificate.clarity].filter(Boolean).join(' · ')
        : unselected;

      var settingAmount = state.setting ? Number(state.setting.priceMinor) / 100 : 0;
      var diamondAmount = state.diamond ? Number(state.diamond.price) : 0;
      summaryTotal.textContent = state.setting && state.diamond
        ? money(settingAmount + diamondAmount, root.dataset.currency)
        : '—';
      root.querySelector('[data-summary-edit="settings"]').hidden = !state.setting;
      root.querySelector('[data-summary-edit="diamonds"]').hidden = !state.diamond;
      var ready = Boolean(state.setting && state.diamond);
      root.querySelector('[data-builder-tab="review"]').disabled = !ready;
      addButton.disabled = !ready || state.added;
    }

    function resetAddedState() {
      state.added = false;
      if (addButtonLabel) addButtonLabel.textContent = defaultAddLabel;
    }

    function titleStyle(node) {
      node.style.cssText = '--block-padding:0;font-family:var(--text-small-font,var(--font-body));font-weight:var(--text-small-weight,400);font-style:var(--text-small-style,normal);font-size:var(--text-small-size,var(--rb-fs-sm));line-height:var(--text-small-leading,1.3);letter-spacing:var(--track-wide,var(--text-small-tracking,.05em));text-transform:uppercase;';
      return node;
    }

    function badge(label, modifier) {
      var badges = element('div', 'product-badges product-badges--top-left');
      badges.appendChild(element('span', 'product-badge product-badge--' + (modifier || 'custom'), label));
      return badges;
    }

    function mediaSource(value, fallbackTitle) {
      if (!value || !value.url) return null;
      return {
        type: value.type || 'image',
        url: value.url,
        preview: value.preview,
        altText: value.altText || fallbackTitle,
        width: value.width,
        height: value.height,
        mimeType: value.mimeType
      };
    }

    function cardMedia(source, title) {
      if (!cardConfig.media) return null;
      var media = element('div', 'card__media');
      media.style.aspectRatio = cardConfig.imageRatio;
      media.style.setProperty('--card-fit', cardConfig.imageFit);
      var slide = element('span', 'card__slide is-on');
      slide.dataset.cardSlide = '0';
      if (source && source.url) {
        var image = document.createElement('img');
        image.className = 'card__img';
        image.src = source.type === 'video' && source.preview ? source.preview.url : source.url;
        image.dataset.imageLqip = image.src;
        image.alt = source.altText || title;
        image.width = source.width || (source.preview && source.preview.width) || 800;
        image.height = source.height || (source.preview && source.preview.height) || 800;
        image.loading = 'lazy';
        image.decoding = 'async';
        slide.appendChild(image);
      } else {
        slide.appendChild(element('span', 'ring-builder-card__placeholder', translations.imageUnavailable));
      }
      media.appendChild(slide);
      return media;
    }

    function quickButton(label, open) {
      var button = element('button', 'card__quick');
      button.type = 'button';
      button.setAttribute('aria-label', translations.quickView + ': ' + label);
      button.appendChild(eyeTemplate.content.cloneNode(true));
      button.addEventListener('click', function () { open(button); });
      return button;
    }

    function cardTitle(title) {
      return titleStyle(element('h3', 'text-block product-details__title product-title--minimum-two-lines', title));
    }

    function vendorText(vendor) {
      return element('span', 'text-block product-details__vendor text-wrap--nowrap', vendor);
    }

    function priceText(value, currency, compareAt) {
      var price = element('span', 'card__price');
      if (compareAt && Number(compareAt) > Number(value)) {
        price.appendChild(element('s', '', money(compareAt, currency)));
      }
      price.appendChild(document.createTextNode(money(value, currency)));
      return price;
    }

    function actionSlot(label, onSelect) {
      var slot = element('div', 'card__add-slot');
      var button = element('button', 'btn btn--outline card__add', label);
      button.type = 'button';
      button.dataset.defaultLabel = label;
      button.dataset.selectedLabel = translations.selected;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', onSelect);
      slot.appendChild(button);
      return slot;
    }

    function updateCardSelected(kind, key) {
      root.querySelectorAll('.ring-builder-card[data-builder-card-kind="' + kind + '"]').forEach(function (card) {
        var selected = card.dataset.builderSelectionKey === String(key);
        card.toggleAttribute('data-selected', selected);
        var action = card.querySelector('.card__add');
        if (action) {
          action.textContent = selected ? action.dataset.selectedLabel : action.dataset.defaultLabel;
          action.setAttribute('aria-pressed', selected ? 'true' : 'false');
        }
      });
    }

    function settingRecord(product, variant) {
      return {
        productTitle: product.title,
        variantId: variant.id,
        variantTitle: variant.title,
        price: money(variant.price, variant.currency),
        priceMinor: String(Math.round(Number(variant.price) * 100)),
        product: product,
        variant: variant
      };
    }

    function selectSetting(card, product, variant, advance) {
      resetAddedState();
      state.setting = settingRecord(product, variant);
      card.dataset.builderSelectionKey = variant.id;
      updateCardSelected('setting', variant.id);
      updateSummary();
      if (advance !== false) showStep(state.diamond ? 'review' : 'diamonds');
    }

    function selectDiamond(card, diamond, advance) {
      resetAddedState();
      state.diamond = diamond;
      card.dataset.builderSelectionKey = diamond.offerId;
      updateCardSelected('diamond', diamond.offerId);
      updateSummary();
      if (advance !== false) showStep(state.setting ? 'review' : 'settings');
    }

    function optionValues(product, optionName) {
      var values = [];
      product.variants.forEach(function (variant) {
        var option = (variant.selectedOptions || []).find(function (item) { return item.name === optionName; });
        if (option && values.indexOf(option.value) === -1) values.push(option.value);
      });
      return values;
    }

    function variantForOption(product, current, optionName, value) {
      var wanted = {};
      (current.selectedOptions || []).forEach(function (option) { wanted[option.name] = option.value; });
      wanted[optionName] = value;
      return product.variants.find(function (variant) {
        return (variant.selectedOptions || []).every(function (option) {
          return wanted[option.name] === option.value;
        });
      }) || product.variants.find(function (variant) {
        return (variant.selectedOptions || []).some(function (option) {
          return option.name === optionName && option.value === value;
        });
      }) || current;
    }

    function settingCard(product, index) {
      var current = product.variants[0];
      var card = element('article', 'card card--composed ring-builder-card');
      card.dataset.builderCardKind = 'setting';
      card.dataset.builderAnimate = cardConfig.animate ? 'true' : 'false';
      card.style.setProperty('--ring-builder-card-index', index);
      card.style.setProperty('--ring-builder-card-align', cardConfig.textAlign);
      card.dataset.builderSelectionKey = current.id;

      var lead = mediaSource(current.image || product.image || (product.media || [])[0], product.title);
      var media = cardMedia(lead, product.title);
      if (media) card.appendChild(media);
      if (cardConfig.badges) card.appendChild(badge(translations.setting, 'custom'));
      card.appendChild(quickButton(product.title, function (trigger) {
        openSettingQuickView(product, card, current, trigger);
      }));
      if (cardConfig.vendor && product.vendor) card.appendChild(vendorText(product.vendor));
      if (cardConfig.title) card.appendChild(cardTitle(product.title));

      var price = null;
      var meta = null;
      var pillButtons = [];
      var firstOption = current.selectedOptions && current.selectedOptions[0];
      if (cardConfig.options && firstOption) {
        var control = element('div', 'card__option-control');
        meta = element('span', 'card__meta', firstOption.value);
        control.appendChild(meta);
        var pills = element('div', 'card__pills');
        optionValues(product, firstOption.name).forEach(function (value) {
          var pill = element('button', 'card__pill' + (value === firstOption.value ? ' is-selected' : ''), value);
          pill.type = 'button';
          pill.setAttribute('aria-pressed', value === firstOption.value ? 'true' : 'false');
          pill.addEventListener('click', function () {
            current = variantForOption(product, current, firstOption.name, value);
            card.dataset.builderSelectionKey = current.id;
            meta.textContent = value;
            pillButtons.forEach(function (item) {
              var selected = item === pill;
              item.classList.toggle('is-selected', selected);
              item.setAttribute('aria-pressed', selected ? 'true' : 'false');
            });
            if (price) price.replaceWith(price = priceText(current.price, current.currency, current.compareAtPrice));
            if (card.hasAttribute('data-selected')) selectSetting(card, product, current, false);
          });
          pillButtons.push(pill);
          pills.appendChild(pill);
        });
        control.appendChild(pills);
        card.appendChild(control);
      }

      if (cardConfig.price) {
        price = priceText(current.price, current.currency, current.compareAtPrice);
        card.appendChild(price);
      }
      if (cardConfig.action) {
        card.appendChild(actionSlot(translations.chooseSetting, function () {
          selectSetting(card, product, current, true);
        }));
      }
      return card;
    }

    function diamondTitle(diamond) {
      return [diamond.certificate.carats + ' ct', diamond.certificate.shape, 'Diamond'].filter(Boolean).join(' ');
    }

    function diamondMedia(diamond) {
      var media = [];
      if (diamond.image) media.push({ type: 'image', url: diamond.image, altText: diamondTitle(diamond), width: 900, height: 900 });
      if (diamond.video) media.push({ type: 'video', url: diamond.video, altText: diamondTitle(diamond), preview: diamond.image ? { url: diamond.image } : null });
      return media;
    }

    function diamondCard(diamond, index) {
      var card = element('article', 'card card--composed ring-builder-card');
      card.dataset.builderCardKind = 'diamond';
      card.dataset.builderSelectionKey = diamond.offerId;
      card.dataset.builderAnimate = cardConfig.animate ? 'true' : 'false';
      card.style.setProperty('--ring-builder-card-index', index);
      card.style.setProperty('--ring-builder-card-align', cardConfig.textAlign);

      var mediaItems = diamondMedia(diamond);
      var media = cardMedia(mediaItems[0], diamondTitle(diamond));
      if (media) card.appendChild(media);
      if (cardConfig.badges) card.appendChild(badge(diamond.availability === 'AVAILABLE' ? translations.diamond : diamond.availability, 'custom'));
      card.appendChild(quickButton(diamondTitle(diamond), function (trigger) {
        openDiamondQuickView(diamond, card, trigger);
      }));
      if (cardConfig.vendor) card.appendChild(vendorText('Nivoda'));
      if (cardConfig.title) card.appendChild(cardTitle(diamondTitle(diamond)));

      if (cardConfig.options) {
        var control = element('div', 'card__option-control ring-builder-card__meta-pills');
        control.appendChild(element('span', 'card__meta', [diamond.certificate.lab, diamond.certificate.number].filter(Boolean).join(' ')));
        var pills = element('div', 'card__pills');
        [diamond.certificate.color, diamond.certificate.clarity, diamond.certificate.cut].filter(Boolean).forEach(function (value) {
          var pill = element('span', 'card__pill', value);
          pill.setAttribute('aria-disabled', 'true');
          pills.appendChild(pill);
        });
        control.appendChild(pills);
        card.appendChild(control);
      }
      if (cardConfig.price) card.appendChild(priceText(diamond.price, diamond.currency));
      if (cardConfig.action) {
        card.appendChild(actionSlot(translations.select, function () {
          selectDiamond(card, diamond, true);
        }));
      }
      if (state.diamond && state.diamond.offerId === diamond.offerId) card.setAttribute('data-selected', '');
      return card;
    }

    function mediaGallery(items, title) {
      var gallery = element('div', 'product-gallery product-gallery--carousel');
      var track = element('div', 'product-gallery__track');
      var current = 0;
      var slides = [];
      var dots = [];
      var usable = (items || []).filter(function (item) { return item && item.url; });
      gallery.setAttribute('aria-label', translations.productMedia);
      gallery.dataset.productGalleryLayout = 'carousel';
      gallery.dataset.stickyMode = 'none';
      gallery.style.setProperty('--product-media-fit', 'contain');
      track.style.setProperty('--product-media-index', '0');

      if (!usable.length) {
        var emptySlide = element('div', 'product-gallery__slide is-active');
        emptySlide.appendChild(element('span', 'ring-builder-card__placeholder', translations.imageUnavailable));
        track.appendChild(emptySlide);
      }
      usable.forEach(function (item, index) {
        var slide = element('div', 'product-gallery__slide' + (index === 0 ? ' is-active' : ''));
        var node;
        if (item.type === 'video') {
          node = document.createElement('video');
          node.controls = true;
          node.playsInline = true;
          node.preload = 'metadata';
          node.src = item.url;
          if (item.preview && item.preview.url) node.poster = item.preview.url;
          node.setAttribute('aria-label', translations.video + ': ' + title);
        } else {
          node = document.createElement('img');
          node.src = item.url;
          node.alt = item.altText || title;
          node.width = item.width || 1000;
          node.height = item.height || 1000;
          node.loading = index === 0 ? 'eager' : 'lazy';
        }
        slide.dataset.productMedia = '';
        slide.dataset.mediaId = 'builder-media-' + index;
        slide.dataset.mediaType = item.type || 'image';
        slide.dataset.mediaIndex = String(index);
        slide.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
        slide.appendChild(node);
        track.appendChild(slide);
        slides.push(slide);
      });
      gallery.appendChild(track);

      function show(index) {
        current = (index + slides.length) % slides.length;
        track.style.setProperty('--product-media-index', String(current));
        slides.forEach(function (slide, slideIndex) {
          var selected = slideIndex === current;
          slide.classList.toggle('is-active', selected);
          slide.setAttribute('aria-hidden', selected ? 'false' : 'true');
          var video = slide.querySelector('video');
          if (video && !selected) video.pause();
        });
        dots.forEach(function (dot, dotIndex) {
          var selected = dotIndex === current;
          dot.setAttribute('aria-current', selected ? 'true' : 'false');
          dot.classList.toggle('is-active', selected);
        });
      }

      if (slides.length > 1) {
        if (quickConfig.mediaControls === 'arrows_dots' || quickConfig.mediaControls === 'arrows') {
          var controls = element('div', 'product-gallery__controls');
          var previousMedia = element('button', 'product-gallery__arrow product-gallery__arrow--previous');
          previousMedia.type = 'button';
          previousMedia.setAttribute('aria-label', translations.previousMedia);
          previousMedia.addEventListener('click', function () { show(current - 1); });
          previousMedia.appendChild(previousIconTemplate.content.cloneNode(true));
          var nextMedia = element('button', 'product-gallery__arrow product-gallery__arrow--next');
          nextMedia.type = 'button';
          nextMedia.setAttribute('aria-label', translations.nextMedia);
          nextMedia.addEventListener('click', function () { show(current + 1); });
          nextMedia.appendChild(nextIconTemplate.content.cloneNode(true));
          controls.appendChild(previousMedia);
          controls.appendChild(nextMedia);
          gallery.appendChild(controls);
        }
        if (quickConfig.mediaControls === 'arrows_dots' || quickConfig.mediaControls === 'dots') {
          var dotList = element('div', 'product-gallery__dots');
          usable.forEach(function (item, index) {
            var isVideo = item.type === 'video';
            var dot = element('button', 'product-gallery__dot' + (isVideo ? ' product-gallery__dot--video' : '') + (index === 0 ? ' is-active' : ''));
            dot.type = 'button';
            dot.setAttribute('aria-label', translations.goToView + ' ' + String(index + 1) + (isVideo ? ', ' + translations.video : ''));
            dot.setAttribute('aria-current', index === 0 ? 'true' : 'false');
            if (isVideo) dot.appendChild(element('span', '', translations.video));
            dot.addEventListener('click', function () { show(index); });
            dots.push(dot);
            dotList.appendChild(dot);
          });
          gallery.appendChild(dotList);
        }

        var swipeStart = null;
        gallery.addEventListener('touchstart', function (event) {
          var touch = event.touches && event.touches[0];
          swipeStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }, { passive: true });
        gallery.addEventListener('touchend', function (event) {
          var start = swipeStart;
          var touch = event.changedTouches && event.changedTouches[0];
          swipeStart = null;
          if (!start || !touch) return;
          var dx = touch.clientX - start.x;
          var dy = touch.clientY - start.y;
          if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
          show(current + (dx < 0 ? 1 : -1));
        }, { passive: true });
      }
      return gallery;
    }

    function quickBadge(label) {
      var badges = badge(label, 'custom');
      badges.classList.remove('product-badges--top-left');
      return badges;
    }

    function quickVendor(value) {
      var vendor = element('span', 'text-block product-details__vendor', value);
      vendor.setAttribute('style', '--block-padding:0;font-family:var(--text-caption-font);font-weight:var(--text-caption-weight);font-style:var(--text-caption-style);font-size:var(--text-caption-size);line-height:var(--text-caption-leading);letter-spacing:var(--track-wide);text-transform:uppercase;');
      return vendor;
    }

    function quickTitle(value) {
      var title = element('h2', 'text-block product-details__title ring-builder__quick-title', value);
      title.setAttribute('style', '--block-padding:0;font-family:var(--text-heading_2-font);font-weight:var(--text-heading_2-weight);font-style:var(--text-heading_2-style);font-size:var(--type-4xl);line-height:var(--text-heading_2-leading);letter-spacing:var(--text-heading_2-tracking);text-transform:uppercase;');
      return title;
    }

    function quickPrice(value, currency, compareAt) {
      var price = element('span', 'text-block product-price ring-builder__quick-price');
      price.setAttribute('style', '--block-padding:0;font-family:var(--text-heading_4-font);font-weight:var(--text-heading_4-weight);font-style:var(--text-heading_4-style);font-size:var(--text-heading_4-size);line-height:var(--text-heading_4-leading);letter-spacing:var(--text-heading_4-tracking);text-transform:var(--text-heading_4-case);');
      if (compareAt && Number(compareAt) > Number(value)) {
        price.appendChild(element('s', '', money(compareAt, currency)));
      }
      price.appendChild(element('span', 'product-price__figure', money(value, currency)));
      return price;
    }

    function quickAction(label, onSelect) {
      var form = element('div', 'product-buy-form ring-builder__quick-action');
      var buttons = element('div', 'product-buy-form__buttons');
      var button = element('button', 'btn btn--primary product-buy-form__submit', label);
      button.type = 'button';
      button.addEventListener('click', onSelect);
      buttons.appendChild(button);
      form.appendChild(buttons);
      return form;
    }

    function quickOptionPicker(product, initialVariant, onChange) {
      var current = initialVariant;
      var wrapper = element('div', 'product-options');
      var optionNames = [];
      product.variants.forEach(function (variant) {
        (variant.selectedOptions || []).forEach(function (option) {
          if (optionNames.indexOf(option.name) === -1) optionNames.push(option.name);
        });
      });

      function render() {
        wrapper.replaceChildren();
        optionNames.forEach(function (name) {
          var selectedOption = (current.selectedOptions || []).find(function (option) { return option.name === name; });
          var fieldset = element('fieldset', 'product-option');
          var legend = document.createElement('legend');
          legend.appendChild(element('span', '', name));
          legend.appendChild(element('span', '', selectedOption ? selectedOption.value : ''));
          fieldset.appendChild(legend);
          var choices = element('div', 'product-option__values product-option__values--pill');
          optionValues(product, name).forEach(function (value, index) {
            var label = element('label', 'product-option__choice');
            var input = document.createElement('input');
            input.type = 'radio';
            input.name = 'ring-builder-' + product.id + '-' + name;
            input.value = value;
            input.checked = Boolean(selectedOption && selectedOption.value === value);
            input.id = 'ring-builder-option-' + String(product.id).replace(/\D/g, '') + '-' + name.replace(/\W/g, '-') + '-' + index;
            var control = element('span', 'btn btn--outline product-option__pill', value);
            label.htmlFor = input.id;
            label.appendChild(input);
            label.appendChild(control);
            input.addEventListener('change', function () {
              current = variantForOption(product, current, name, value);
              onChange(current);
              render();
            });
            choices.appendChild(label);
          });
          fieldset.appendChild(choices);
          wrapper.appendChild(fieldset);
        });
      }
      render();
      return { element: wrapper, selected: function () { return current; } };
    }

    function specList(entries) {
      var list = element('dl', 'ring-builder__quick-specs');
      entries.filter(function (entry) { return entry[1] != null && entry[1] !== ''; }).forEach(function (entry) {
        var item = document.createElement('div');
        item.appendChild(element('dt', '', entry[0]));
        item.appendChild(element('dd', '', String(entry[1])));
        list.appendChild(item);
      });
      return list;
    }

    function openQuickView(content, trigger) {
      window.clearTimeout(closeTimer);
      quickTrigger = trigger;
      quickContents.replaceChildren(content);
      quickDialog.classList.remove('is-closing');
      var panel = quickDialog.querySelector('[data-builder-quick-view-panel]');
      if (!quickDialog.open) quickDialog.showModal();
      var close = quickDialog.querySelector('.quick-view__close');
      if (close) close.focus({ preventScroll: true });
      if (panel) {
        panel.scrollTop = 0;
        window.requestAnimationFrame(function () { panel.scrollTop = 0; });
      }
    }

    function closeQuickView() {
      if (!quickDialog.open || quickDialog.classList.contains('is-closing')) return;
      quickDialog.classList.add('is-closing');
      quickDialog.querySelectorAll('video').forEach(function (video) { video.pause(); });
      closeTimer = window.setTimeout(function () {
        quickDialog.close();
        quickDialog.classList.remove('is-closing');
        quickContents.replaceChildren();
        if (quickTrigger && document.contains(quickTrigger)) quickTrigger.focus({ preventScroll: true });
        quickTrigger = null;
      }, 320);
    }

    function openSettingQuickView(product, card, initialVariant, trigger) {
      var current = initialVariant;
      var frame = element('section', 'main-product quick-view-product ring-builder__quick-view-frame');
      if (!quickConfig.media) frame.classList.add('ring-builder__quick-view-frame--no-media');
      var grid = element('div', 'quick-view__grid');
      if (quickConfig.media) grid.appendChild(mediaGallery(product.media || [product.image], product.title));
      var info = element('div', 'quick-view__info');
      if (quickConfig.badges) info.appendChild(quickBadge(translations.setting));
      if (quickConfig.vendor && product.vendor) info.appendChild(quickVendor(product.vendor));
      if (quickConfig.title) info.appendChild(quickTitle(product.title));
      var price = quickConfig.price ? quickPrice(current.price, current.currency, current.compareAtPrice) : null;
      if (price) info.appendChild(price);
      if (quickConfig.options && current.selectedOptions && current.selectedOptions.length) {
        var picker = quickOptionPicker(product, current, function (variant) {
          current = variant;
          if (price) price.replaceWith(price = quickPrice(current.price, current.currency, current.compareAtPrice));
        });
        info.appendChild(picker.element);
      }
      if (quickConfig.description && product.description) {
        info.appendChild(element('p', 'ring-builder__quick-description', product.description));
      }
      if (quickConfig.action) {
        info.appendChild(quickAction(translations.chooseSetting, function () {
          selectSetting(card, product, current, true);
          closeQuickView();
        }));
      }
      grid.appendChild(info);
      frame.appendChild(grid);
      openQuickView(frame, trigger);
    }

    function openDiamondQuickView(diamond, card, trigger) {
      var frame = element('section', 'main-product quick-view-product ring-builder__quick-view-frame');
      if (!quickConfig.media) frame.classList.add('ring-builder__quick-view-frame--no-media');
      var grid = element('div', 'quick-view__grid');
      if (quickConfig.media) grid.appendChild(mediaGallery(diamondMedia(diamond), diamondTitle(diamond)));
      var info = element('div', 'quick-view__info');
      if (quickConfig.badges) info.appendChild(quickBadge(translations.diamond));
      if (quickConfig.vendor) info.appendChild(quickVendor('Nivoda'));
      if (quickConfig.title) info.appendChild(quickTitle(diamondTitle(diamond)));
      if (quickConfig.price) info.appendChild(quickPrice(diamond.price, diamond.currency));
      if (quickConfig.description) info.appendChild(element('p', 'ring-builder__quick-description', translations.diamondDetails));
      if (quickConfig.specs) {
        info.appendChild(specList([
          ['Lab', diamond.certificate.lab],
          ['Certificate', diamond.certificate.number],
          ['Carat', diamond.certificate.carats],
          ['Shape', diamond.certificate.shape],
          ['Color', diamond.certificate.color],
          ['Clarity', diamond.certificate.clarity],
          ['Cut', diamond.certificate.cut],
          ['Polish', diamond.certificate.polish],
          ['Symmetry', diamond.certificate.symmetry],
          ['Fluorescence', diamond.certificate.fluorescence],
          ['Table', diamond.certificate.table],
          ['Depth', diamond.certificate.depthPercentage]
        ]));
      }
      if (quickConfig.action) {
        info.appendChild(quickAction(translations.select, function () {
          selectDiamond(card, diamond, true);
          closeQuickView();
        }));
      }
      grid.appendChild(info);
      frame.appendChild(grid);
      openQuickView(frame, trigger);
    }

    quickDialog.querySelectorAll('[data-builder-quick-view-close]').forEach(function (button) {
      button.addEventListener('click', closeQuickView);
    });
    quickDialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeQuickView();
    });

    root.addEventListener('click', function (event) {
      var tab = event.target.closest('[data-builder-tab]');
      if (tab && !tab.disabled) {
        showStep(tab.dataset.builderTab);
        return;
      }
      var edit = event.target.closest('[data-summary-edit]');
      if (edit) showStep(edit.dataset.summaryEdit);
    });

    function loadSettings() {
      state.settingsLoading = true;
      state.lastAction = loadSettings;
      settingsLoader.hidden = false;
      settingsEmpty.hidden = true;
      showNotice('', false);

      fetch(root.dataset.proxyPath + '/settings', { headers: { Accept: 'application/json' } })
        .then(function (response) { return readJson(response, translations.settingsError); })
        .then(function (payload) {
          settingResults.replaceChildren();
          (payload.items || []).forEach(function (product, index) {
            settingResults.appendChild(settingCard(product, index));
          });
          state.settingsLoaded = true;
          settingsEmpty.hidden = Boolean(payload.items && payload.items.length);
        })
        .catch(function (error) {
          showNotice(error.message || translations.settingsError, true, 'error');
        })
        .finally(function () {
          state.settingsLoading = false;
          settingsLoader.hidden = true;
        });
    }

    function filterParams() {
      var data = new FormData(form);
      var params = new URLSearchParams();
      ['source', 'minCarat', 'maxCarat', 'minPrice', 'maxPrice', 'sort'].forEach(function (name) {
        params.set(name, data.get(name) || '');
      });
      params.set('shapes', data.getAll('shapes').join(','));
      params.set('limit', root.dataset.resultsPerPage);
      params.set('offset', String(state.offset));
      params.set('currency', root.dataset.currency);
      return params;
    }

    function renderResults(payload) {
      results.replaceChildren();
      state.total = Number(payload.total) || 0;
      payload.items.forEach(function (diamond, index) {
        results.appendChild(diamondCard(diamond, index));
      });
      var resultsLabel = payload.providerMode === 'fixture'
        ? translations.fixtureResults
        : payload.providerEnvironment === 'staging'
          ? translations.stagingResults
          : translations.results;
      resultsCount.textContent = state.total
        ? interpolate(resultsLabel, { count: state.total })
        : translations.noResults;
      var limit = Number(root.dataset.resultsPerPage);
      var currentPage = Math.floor(state.offset / limit) + 1;
      var pageCount = Math.max(1, Math.ceil(state.total / limit));
      pageLabel.textContent = interpolate(translations.page, { current: currentPage, total: pageCount });
      previous.disabled = state.offset === 0;
      next.disabled = state.offset + limit >= state.total;
      pagination.hidden = state.total <= limit;
    }

    function searchDiamonds(scroll) {
      if (state.controller) state.controller.abort();
      state.controller = new AbortController();
      state.lastAction = function () { searchDiamonds(false); };
      setBusy(true);
      showNotice('', false);
      var slowTimer = window.setTimeout(function () {
        resultsCount.textContent = translations.stillLoading;
      }, 8000);

      fetch(root.dataset.proxyPath + '/diamonds?' + filterParams().toString(), {
        headers: { Accept: 'application/json' },
        signal: state.controller.signal
      })
        .then(function (response) { return readJson(response, translations.connectionError); })
        .then(function (payload) {
          state.loaded = true;
          renderResults(payload);
          if (scroll) resultsCount.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function (error) {
          if (error.name === 'AbortError') return;
          showNotice(error.message || translations.connectionError, true, 'error');
          resultsCount.textContent = '';
        })
        .finally(function () {
          window.clearTimeout(slowTimer);
          setBusy(false);
        });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      state.offset = 0;
      searchDiamonds(true);
    });
    previous.addEventListener('click', function () {
      state.offset = Math.max(0, state.offset - Number(root.dataset.resultsPerPage));
      searchDiamonds(true);
    });
    next.addEventListener('click', function () {
      state.offset += Number(root.dataset.resultsPerPage);
      searchDiamonds(true);
    });
    retry.addEventListener('click', function () {
      if (state.lastAction) state.lastAction();
    });

    function renderReview() {
      review.replaceChildren();
      if (!state.setting || !state.diamond) return;
      var setting = element('article', 'ring-builder__review-card');
      setting.appendChild(element('p', 'ring-builder__eyebrow', translations.setting));
      setting.appendChild(element('h3', '', state.setting.productTitle));
      if (state.setting.variantTitle !== 'Default Title') setting.appendChild(element('p', '', state.setting.variantTitle));
      setting.appendChild(element('strong', '', state.setting.price));
      review.appendChild(setting);

      var diamond = element('article', 'ring-builder__review-card');
      diamond.appendChild(element('p', 'ring-builder__eyebrow', translations.diamond));
      diamond.appendChild(element('h3', '', diamondTitle(state.diamond)));
      diamond.appendChild(element('p', '', [state.diamond.certificate.color, state.diamond.certificate.clarity, state.diamond.certificate.cut].filter(Boolean).join(' · ')));
      diamond.appendChild(element('strong', '', money(state.diamond.price, state.diamond.currency)));
      review.appendChild(diamond);
    }

    function addRing() {
      if (!state.setting || !state.diamond || addButton.disabled) return;
      state.lastAction = addRing;
      addButton.disabled = true;
      addButton.setAttribute('aria-busy', 'true');
      state.added = false;
      if (addButtonLabel) addButtonLabel.textContent = translations.adding;
      showNotice('', false);

      fetch(root.dataset.proxyPath + '/selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          settingVariantId: state.setting.variantId,
          offerId: state.diamond.offerId,
          diamondId: state.diamond.diamondId,
          currency: root.dataset.currency
        })
      })
        .then(function (response) { return readJson(response, translations.cartError); })
        .then(function (payload) {
          if (payload.diamond && payload.diamond.price !== state.diamond.price) {
            state.diamond = payload.diamond;
            updateSummary();
            renderReview();
            showNotice(translations.priceUpdated, false);
          }
          if (window.VeylinCart && window.VeylinCart.addItems) {
            return window.VeylinCart.addItems(payload.items);
          }
          return fetch((window.Shopify && window.Shopify.routes.root || '/') + 'cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: payload.items })
          }).then(function (response) {
            if (!response.ok) throw new Error(translations.cartError);
            window.location.assign((window.Shopify && window.Shopify.routes.root || '/') + 'cart');
          });
        })
        .then(function () {
          state.added = true;
          if (addButtonLabel) addButtonLabel.textContent = translations.added;
        })
        .catch(function (error) {
          showNotice(error.message || translations.cartError, true, 'error');
          state.added = false;
          if (addButtonLabel) addButtonLabel.textContent = defaultAddLabel;
        })
        .finally(function () {
          addButton.removeAttribute('aria-busy');
          addButton.disabled = state.added || !(state.setting && state.diamond);
        });
    }

    addButton.addEventListener('click', addRing);
    updateSummary();
    showStep(state.step);

    fetch(root.dataset.proxyPath + '/config', { headers: { Accept: 'application/json' } })
      .then(function (response) { return readJson(response, translations.connectionError); })
      .then(function (payload) {
        if (!payload.ready) showNotice(translations.connectionError, true, 'error');
        fixtureBanner.hidden = payload.providerMode !== 'fixture';
        stagingBanner.hidden = payload.providerEnvironment !== 'staging';
      })
      .catch(function () { showNotice(translations.connectionError, true, 'error'); });
  }

  function init(scope) {
    scope.querySelectorAll('[data-ring-builder]').forEach(initBuilder);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
  });
})();
