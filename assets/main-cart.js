(function () {
  if (document.documentElement.dataset.mainCartReady === 'true') return;
  document.documentElement.dataset.mainCartReady = 'true';

  document.addEventListener('click', function (event) {
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
