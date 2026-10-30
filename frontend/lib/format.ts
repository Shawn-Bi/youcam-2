const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Whole-dollar price, e.g. "$114". */
export const formatPrice = (amount: number) => usd.format(amount);

/** Budget raised by 50%, rounded up to the next $5. */
export const raisedBudget = (budget: number) => Math.ceil((budget * 1.5) / 5) * 5;
