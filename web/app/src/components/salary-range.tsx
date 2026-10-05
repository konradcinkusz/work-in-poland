import { formatAmount } from '@/lib/salary';

export interface RangeValues {
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

/**
 * Horizontal range graphic: whisker min..max, box p25..p75, median tick. Plain SVG, no chart
 * library. The figure carries a text equivalent (role="img" + aria-label and a visible table).
 */
export function SalaryRange({ values, unit }: { values: RangeValues; unit: string }) {
  const { min, p25, median, p75, max } = values;
  const span = max - min || 1;
  const W = 600;
  const pad = 12;
  const x = (v: number) => pad + ((v - min) / span) * (W - pad * 2);
  const label = `Widełki: minimum ${formatAmount(min)}, dolny kwartyl ${formatAmount(p25)}, mediana ${formatAmount(median)}, górny kwartyl ${formatAmount(p75)}, maksimum ${formatAmount(max)} ${unit}`;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} 70`} role="img" aria-label={label} className="h-auto w-full">
        <line x1={x(min)} x2={x(max)} y1={35} y2={35} stroke="#475569" strokeWidth={2} />
        <line x1={x(min)} x2={x(min)} y1={25} y2={45} stroke="#475569" strokeWidth={2} />
        <line x1={x(max)} x2={x(max)} y1={25} y2={45} stroke="#475569" strokeWidth={2} />
        <rect x={x(p25)} y={20} width={Math.max(x(p75) - x(p25), 2)} height={30} fill="#fbe3e3" stroke="#a31d24" strokeWidth={2} rx={3} />
        <line x1={x(median)} x2={x(median)} y1={14} y2={56} stroke="#861920" strokeWidth={4} />
        <text x={x(min)} y={68} fontSize={12} textAnchor="start" fill="#334155">{formatAmount(min)}</text>
        <text x={x(median)} y={10} fontSize={12} textAnchor="middle" fill="#861920" fontWeight={700}>{formatAmount(median)}</text>
        <text x={x(max)} y={68} fontSize={12} textAnchor="end" fill="#334155">{formatAmount(max)}</text>
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
