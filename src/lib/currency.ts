export type CurrencyInfo = {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  /** approx. units of this currency per 1 USD (used only for optional conversion & demo scaling) */
  rate: number;
  decimals: number;
};

export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US", rate: 1, decimals: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB", rate: 0.79, decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE", rate: 0.92, decimals: 2 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN", rate: 83.5, decimals: 2 },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", locale: "en-CA", rate: 1.36, decimals: 2 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU", rate: 1.52, decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP", rate: 150, decimals: 0 },
  { code: "CNY", symbol: "CN¥", name: "Chinese Yuan", locale: "zh-CN", rate: 7.2, decimals: 2 },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", locale: "de-CH", rate: 0.88, decimals: 2 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG", rate: 1.34, decimals: 2 },
  { code: "AED", symbol: "AED", name: "UAE Dirham", locale: "en-AE", rate: 3.67, decimals: 2 },
  { code: "SAR", symbol: "SAR", name: "Saudi Riyal", locale: "en-SA", rate: 3.75, decimals: 2 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", locale: "pt-BR", rate: 5.0, decimals: 2 },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", locale: "es-MX", rate: 17.2, decimals: 2 },
  { code: "ZAR", symbol: "R", name: "South African Rand", locale: "en-ZA", rate: 18.5, decimals: 2 },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", locale: "en-NZ", rate: 1.65, decimals: 2 },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", locale: "sv-SE", rate: 10.5, decimals: 2 },
  { code: "KRW", symbol: "₩", name: "South Korean Won", locale: "ko-KR", rate: 1350, decimals: 0 },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", locale: "tr-TR", rate: 32, decimals: 2 },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", locale: "en-NG", rate: 1500, decimals: 2 },
  { code: "PKR", symbol: "Rs", name: "Pakistani Rupee", locale: "en-PK", rate: 278, decimals: 2 },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", locale: "en-BD", rate: 117, decimals: 2 },
  { code: "PHP", symbol: "₱", name: "Philippine Peso", locale: "en-PH", rate: 57, decimals: 2 },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", locale: "id-ID", rate: 15800, decimals: 0 },
];

export function getCurrency(code: string): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function formatMoney(
  value: number,
  code: string,
  opts: { compact?: boolean; decimals?: boolean; sign?: boolean } = {},
): string {
  const c = getCurrency(code);
  const abs = Math.abs(value);
  let digits = c.decimals;
  if (opts.decimals === false) digits = 0;
  try {
    const f = new Intl.NumberFormat(c.locale, {
      style: "currency",
      currency: c.code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: opts.compact ? 0 : digits,
      maximumFractionDigits: opts.compact ? 1 : digits,
      notation: opts.compact && abs >= 10000 ? "compact" : "standard",
    });
    const s = f.format(abs);
    const sign = value < 0 ? "−" : opts.sign && value > 0 ? "+" : "";
    return sign + s;
  } catch {
    return (value < 0 ? "−" : "") + c.symbol + abs.toFixed(digits);
  }
}
