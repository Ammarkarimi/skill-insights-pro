import { cn } from "@/lib/utils";
import { PayCurrency } from "@/lib/currency";

interface Props {
  options: { value: PayCurrency; label: string }[];
  current: PayCurrency;
  onChange: (c: PayCurrency) => void;
  activeClass?: string;
}

/** Segmented control for the price list (USD, GBP, EUR, AUD, INR...). */
const CurrencySwitch = ({ options, current, onChange, activeClass = "bg-primary text-primary-foreground" }: Props) => (
  <div className="inline-flex flex-wrap rounded-lg border bg-white p-1" role="group" aria-label="Currency">
    {options.map(({ value, label }) => (
      <button
        key={value}
        type="button"
        onClick={() => onChange(value)}
        aria-pressed={current === value}
        className={cn("rounded-md px-3 py-1.5 text-sm", current === value ? activeClass : "text-gray-700")}
      >
        {label}
      </button>
    ))}
  </div>
);

export default CurrencySwitch;
