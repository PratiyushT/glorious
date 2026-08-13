(function () {
  if (document.documentElement.dataset.mainCartReady === 'true') return;
  document.documentElement.dataset.mainCartReady = 'true';

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-cart-quantity-change]');
    if (!button || !button.closest('main-cart')) return;

    var quantity = button.closest('[data-cart-quantity]');
    var input = quantity ? quantity.querySelector('input[type="number"]') : null;
    if (!input) return;

    var direction = Number(button.dataset.cartQuantityChange);
    var minimum = Number(input.min || 0);
    var nextValue = Math.max(minimum, Number(input.value || 0) + direction);
    input.value = nextValue;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
})();
