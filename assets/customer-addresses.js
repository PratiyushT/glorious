(function () {
  function initializeSelectors() {
    if (!window.Shopify || !Shopify.CountryProvinceSelector) return;

    var forms = document.querySelectorAll('[data-address-form]');
    for (var i = 0; i < forms.length; i += 1) {
      var form = forms[i];
      var country = form.querySelector('[data-address-country]');
      var province = form.querySelector('[data-address-province]');
      var container = form.querySelector('[data-address-province-container]');
      if (!country || !province || !container) continue;

      new Shopify.CountryProvinceSelector(country.id, province.id, {
        hideElement: container.id
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initializeSelectors);
})();
