export interface CardBrandDetails {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  barClass: string;
}

export function getCardBrandDetails(cardName: string): CardBrandDetails {
  const nameLower = cardName.toLowerCase();
  if (nameLower.includes("visa")) {
    return {
      label: "Visa",
      bgClass: "bg-blue-500/10 dark:bg-blue-500/20",
      textClass: "text-blue-600 dark:text-blue-400",
      borderClass: "border-blue-200/50 dark:border-blue-900/40",
      barClass: "bg-blue-600 dark:bg-blue-500",
    };
  }
  if (nameLower.includes("mastercard") || nameLower.includes("master")) {
    return {
      label: "Mastercard",
      bgClass: "bg-orange-500/10 dark:bg-orange-500/20",
      textClass: "text-orange-600 dark:text-orange-400",
      borderClass: "border-orange-200/50 dark:border-orange-900/40",
      barClass: "bg-orange-500",
    };
  }
  if (nameLower.includes("elo")) {
    return {
      label: "Elo",
      bgClass: "bg-amber-500/10 dark:bg-amber-500/20",
      textClass: "text-amber-600 dark:text-amber-400",
      borderClass: "border-amber-200/50 dark:border-amber-900/40",
      barClass: "bg-amber-500",
    };
  }
  if (nameLower.includes("american express") || nameLower.includes("amex")) {
    return {
      label: "Amex",
      bgClass: "bg-teal-500/10 dark:bg-teal-500/20",
      textClass: "text-teal-600 dark:text-teal-400",
      borderClass: "border-teal-200/50 dark:border-teal-900/40",
      barClass: "bg-teal-500",
    };
  }
  if (nameLower.includes("hipercard") || nameLower.includes("hiper")) {
    return {
      label: "Hipercard",
      bgClass: "bg-rose-500/10 dark:bg-rose-500/20",
      textClass: "text-rose-600 dark:text-rose-400",
      borderClass: "border-rose-200/50 dark:border-rose-900/40",
      barClass: "bg-rose-500",
    };
  }
  if (nameLower.includes("diners")) {
    return {
      label: "Diners",
      bgClass: "bg-sky-500/10 dark:bg-sky-500/20",
      textClass: "text-sky-600 dark:text-sky-400",
      borderClass: "border-sky-200/50 dark:border-sky-900/40",
      barClass: "bg-sky-500",
    };
  }
  return {
    label: "Cartão",
    bgClass: "bg-indigo-50 dark:bg-indigo-950/20",
    textClass: "text-[#8b5cf6]",
    borderClass: "border-indigo-100 dark:border-indigo-900/20",
    barClass: "bg-[#8b5cf6]",
  };
}
