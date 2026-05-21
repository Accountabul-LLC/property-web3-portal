import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { TreasuryWalletConfig } from '@/config/treasuryWallets';

const SLICE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
];

interface Props {
  wallets: TreasuryWalletConfig[];
  selectedAddress: string | null;
  onSelect: (address: string) => void;
}

const fmtUsd = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
};

const fmtUsdFull = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const TreasuryPieChart = ({ wallets, selectedAddress, onSelect }: Props) => {
  const total = wallets.reduce((s, w) => s + w.mockUsd, 0);
  const chartData = wallets.map((w, i) => ({
    name: w.label,
    address: w.address,
    value: w.mockUsd,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
    purpose: w.purpose,
    pct: total > 0 ? (w.mockUsd / total) * 100 : 0,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
      <div className="h-80 relative [&_svg]:outline-none [&_*:focus]:outline-none [&_*]:!outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
              onClick={(d: any) => onSelect(d.address)}
              stroke="hsl(var(--background))"
              strokeWidth={3}
              label={({ pct }: any) => `${pct.toFixed(1)}%`}
              labelLine={false}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.address}
                  fill={entry.color}
                  className="cursor-pointer transition-opacity"
                  fillOpacity={
                    selectedAddress && selectedAddress !== entry.address ? 0.4 : 1
                  }
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(_v: number, _n: string, props: any) => [
                `${fmtUsdFull(props.payload.value)} (${props.payload.pct.toFixed(1)}%)`,
                props.payload.name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xs text-muted-foreground">Total Treasury</p>
          <p className="text-2xl font-bold tabular-nums">{fmtUsdFull(total)}</p>
        </div>
      </div>

      <div className="space-y-2">
        {chartData.map((entry) => {
          const selected = selectedAddress === entry.address;
          return (
            <button
              key={entry.address}
              onClick={() => onSelect(entry.address)}
              className={`w-full text-left p-3 rounded-md border transition-all ${
                selected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{entry.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{entry.purpose}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm" style={{ color: entry.color }}>
                    {entry.pct.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">{fmtUsd(entry.value)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TreasuryPieChart;
