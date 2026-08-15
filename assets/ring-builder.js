(function () {
  'use strict';

  function buttonClass(style) {
    if (style === 'outline') return 'btn btn--outline';
    if (style === 'link') return 'btn btn--link';
    if (style === 'quiet') return 'btn btn--quiet';
    if (style === 'arrow') return 'btn btn--arrow';
    if (style === 'arrow_outline') return 'btn btn--arrow btn--outline';
    return 'btn btn--primary';
  }

  function interpolate(text, values) {
    return Object.keys(values).reduce(function (result, key) {
      return result.replace(new RegExp('\\[\\[' + key + '\\]\\]', 'g'), values[key]);
    }, text);
  }

  function money(amount, currency) {
    try {
      return new Intl.NumberFormat(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: currency
      }).format(Number(amount));
    } catch (error) {
      return currency + ' ' + Number(amount).toFixed(2);
    }
  }

  function initBuilder(root) {
    if (root.dataset.builderBound === 'true') return;
    root.dataset.builderBound = 'true';

    if (
      root.dataset.publicPath &&
      root.dataset.nativePath &&
      window.location.pathname === root.dataset.nativePath
    ) {
      window.history.replaceState(
        window.history.state,
        '',
        root.dataset.publicPath + window.location.search + window.location.hash
      );
    }

    var translations = JSON.parse(root.querySelector('[data-builder-translations]').textContent);
    var panels = root.querySelectorAll('[data-builder-panel]');
    var tabs = root.querySelectorAll('[data-builder-tab]');
    var notice = root.querySelector('[data-builder-notice]');
    var noticeText = root.querySelector('[data-builder-notice-text]');
    var retry = root.querySelector('[data-builder-retry]');
    var form = root.querySelector('[data-diamond-filters]');
    var results = root.querySelector('[data-diamond-results]');
    var resultsCount = root.querySelector('[data-results-count]');
    var loaderHost = root.querySelector('[data-results-loader]');
    var loaderTemplate = root.querySelector('[data-builder-loader]');
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
    var state = {
      step: root.dataset.initialStep,
      setting: null,
      diamond: null,
      offset: 0,
      total: 0,
      loaded: false,
      loading: false,
      controller: null,
      lastAction: null,
      added: false
    };

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

    summarySetting.dataset.fallback = summarySetting.textContent;
    summaryDiamond.dataset.fallback = summaryDiamond.textContent;

    function selectSetting(card) {
      resetAddedState();
      root.querySelectorAll('[data-setting-card]').forEach(function (item) {
        item.removeAttribute('data-selected');
        item.querySelector('[data-setting-select]').setAttribute('aria-pressed', 'false');
      });
      var button = card.querySelector('[data-setting-select]');
      card.setAttribute('data-selected', '');
      button.setAttribute('aria-pressed', 'true');
      state.setting = {
        productTitle: card.dataset.productTitle,
        variantId: button.dataset.variantId,
        variantTitle: button.dataset.variantTitle,
        price: button.dataset.price,
        priceMinor: button.dataset.priceMinor
      };
      updateSummary();
      showStep(state.diamond ? 'review' : 'diamonds');
    }

    root.addEventListener('click', function (event) {
      var tab = event.target.closest('[data-builder-tab]');
      if (tab && !tab.disabled) {
        showStep(tab.dataset.builderTab);
        return;
      }

      var settingButton = event.target.closest('[data-setting-select]');
      if (settingButton) {
        selectSetting(settingButton.closest('[data-setting-card]'));
        return;
      }

      var diamondButton = event.target.closest('[data-diamond-select]');
      if (diamondButton) {
        resetAddedState();
        root.querySelectorAll('[data-diamond-select]').forEach(function (item) {
          item.setAttribute('aria-pressed', 'false');
        });
        diamondButton.setAttribute('aria-pressed', 'true');
        state.diamond = JSON.parse(diamondButton.dataset.diamond);
        updateSummary();
        showStep(state.setting ? 'review' : 'settings');
        return;
      }

      var edit = event.target.closest('[data-summary-edit]');
      if (edit) showStep(edit.dataset.summaryEdit);
    });

    root.addEventListener('change', function (event) {
      if (!event.target.matches('[data-setting-variant]')) return;
      var select = event.target;
      var option = select.options[select.selectedIndex];
      var card = select.closest('[data-setting-card]');
      var button = card.querySelector('[data-setting-select]');
      button.dataset.variantId = option.value;
      button.dataset.variantTitle = option.dataset.title;
      button.dataset.price = option.dataset.price;
      button.dataset.priceMinor = option.dataset.priceMinor;
      var price = card.querySelector('[data-setting-price]');
      if (price) price.textContent = option.dataset.price;
      if (card.hasAttribute('data-selected')) selectSetting(card);
    });

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

    function element(name, className, text) {
      var node = document.createElement(name);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    }

    function diamondCard(diamond) {
      var card = element('button', 'ring-builder__diamond-card');
      card.type = 'button';
      card.dataset.diamondSelect = '';
      card.dataset.diamond = JSON.stringify(diamond);
      card.setAttribute('aria-pressed', state.diamond && state.diamond.offerId === diamond.offerId ? 'true' : 'false');

      var media = element('span', 'ring-builder__diamond-media');
      if (diamond.image) {
        var image = document.createElement('img');
        image.src = diamond.image;
        image.dataset.imageLqip = diamond.image;
        image.alt = [diamond.certificate.carats + ' ct', diamond.certificate.shape, 'diamond'].filter(Boolean).join(' ');
        image.width = 640;
        image.height = 640;
        image.loading = 'lazy';
        media.appendChild(image);
      } else {
        media.appendChild(element('span', 'ring-builder__diamond-placeholder', translations.imageUnavailable));
      }
      card.appendChild(media);

      var copy = element('span', 'ring-builder__diamond-copy');
      copy.appendChild(element('span', 'micro-label', [diamond.certificate.lab, diamond.certificate.number].filter(Boolean).join(' ')));
      copy.appendChild(element('h3', '', [diamond.certificate.carats + ' ct', diamond.certificate.shape].filter(Boolean).join(' ')));
      var meta = element('span', 'ring-builder__diamond-meta');
      [diamond.certificate.color, diamond.certificate.clarity, diamond.certificate.cut].filter(Boolean).forEach(function (value) {
        meta.appendChild(element('span', '', value));
      });
      copy.appendChild(meta);
      copy.appendChild(element('strong', 'ring-builder__diamond-price', money(diamond.price, diamond.currency)));
      copy.appendChild(element('span', buttonClass(root.dataset.secondaryStyle), translations.select));
      card.appendChild(copy);
      return card;
    }

    function renderResults(payload) {
      results.replaceChildren();
      state.total = Number(payload.total) || 0;
      payload.items.forEach(function (diamond) {
        results.appendChild(diamondCard(diamond));
      });
      resultsCount.textContent = state.total
        ? interpolate(translations.results, { count: state.total })
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
      var settingCard = element('article', 'ring-builder__review-card');
      settingCard.appendChild(element('p', 'micro-label', translations.setting));
      settingCard.appendChild(element('h3', '', state.setting.productTitle));
      if (state.setting.variantTitle !== 'Default Title') settingCard.appendChild(element('p', '', state.setting.variantTitle));
      settingCard.appendChild(element('strong', '', state.setting.price));
      review.appendChild(settingCard);

      var diamondCard = element('article', 'ring-builder__review-card');
      diamondCard.appendChild(element('p', 'micro-label', translations.diamond));
      diamondCard.appendChild(element('h3', '', [state.diamond.certificate.carats + ' ct', state.diamond.certificate.shape].filter(Boolean).join(' ')));
      diamondCard.appendChild(element('p', '', [state.diamond.certificate.color, state.diamond.certificate.clarity, state.diamond.certificate.cut].filter(Boolean).join(' · ')));
      diamondCard.appendChild(element('strong', '', money(state.diamond.price, state.diamond.currency)));
      review.appendChild(diamondCard);
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
