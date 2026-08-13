(function () {
  'use strict';

  if (window.VeylinProductRecommendations) {
    window.VeylinProductRecommendations(document);
    return;
  }

  function loadRecommendations(root) {
    if (!root || root.dataset.loaded === 'true' || root.dataset.loaded === 'loading' || !root.dataset.url) return;

    root.dataset.loaded = 'loading';

    fetch(root.dataset.url)
        .then(function (response) {
          if (!response.ok) throw new Error('Recommendations request failed');
          return response.text();
        })
        .then(function (html) {
          var documentFragment = new DOMParser().parseFromString(html, 'text/html');
          var selector = 'product-recommendations[data-section-id="' + root.dataset.sectionId + '"]';
          var next = documentFragment.querySelector(selector);

          if (!next || !next.querySelector('[data-recommendations-list]')) {
            root.remove();
            return;
          }

          next.dataset.loaded = 'true';
          root.replaceWith(next);
          next.dispatchEvent(new CustomEvent('shopify:section:load', { bubbles: true }));
        })
        .catch(function () {
          root.dataset.loaded = 'error';
        });
  }

  function initRecommendations(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('product-recommendations'), loadRecommendations);
  }

  window.VeylinProductRecommendations = initRecommendations;

  function bootRecommendations() {
    initRecommendations(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootRecommendations);
  } else {
    bootRecommendations();
  }

  document.addEventListener('shopify:section:load', function (event) {
    initRecommendations(event.target);
  });
})();
