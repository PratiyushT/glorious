export function retailPrice(rawPrice, config) {
  const amount = Number(rawPrice);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Nivoda returned an invalid price");
  }

  const base = amount / config.priceDivisor;
  const retail = base * (1 + config.markupPercent / 100);
  return retail.toFixed(2);
}

export function formatMoney(amount, currency, locale = "en") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(Number(amount));
}
