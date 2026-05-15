import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { WalletValuation } from '@/hooks/useWalletValuation';

const SLICE_COLORS = [
  'hsl(var(--primary))',
  'hsl(217 91% 60%)',
  'hsl(160 84% 45%)',
  'hsl(38 92% 55%)',
  'hsl(280 80% 65%)',
  'hsl(340 82% 60%)',
];

interface Props {
  valuations: WalletValuation[];
  selectedAddress: string | null;
  onSelect: (address: string) => void;
}

const fmtUsd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const TreasuryPieChart = ({ valuations, selectedAddress, onSelect }: Props) => {
  const total = valuations.reduce((s, v) => s + v.totalUsd, 0);
  // Ensure visible slices even when value is $0 so users can still click them
  const chartData = valuations.map((v, i) => ({
    name: v.wallet.label,
    address: v.wallet.address,
    value: v.totalUsd > 0 ? v.totalUsd : Math.max(total * 0.001, 1),
    realValue: v.totalUsd,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
    purpose: v.wallet.purpose,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
      <div className="h-72 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
              onClick={(d: any) => onSelect(d.address)}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.address}
                  fill={entry.color}
                  className="cursor-pointer transition-opacity"
                  opacity={
                    selectedAddress && selectedAddress !== entry.address ? 0.35 : 1
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
                `${fmtUsd(props.payload.realValue)} (${
                  total > 0 ? ((props.payload.realValue / total) * 100).toFixed(1) : '0.0'
                }%)`,
                props.payload.name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xs text-muted-foreground">Total Treasury</p>
          <p className="text-2xl font-bold">{fmtUsd(total)}</p>
        </div>
      </div>

      <div className="space-y-2">
        {chartData.map((entry) => {
          const pct = total > 0 ? (entry.realValue / total) * 100 : 0;
          const selected = selectedAddress === entry.address;
          return (
            <button
              key={entry.address}
              onClick={() => onSelect(entry.address)}
              className={`w-full text-left p-3 rounded-md border transition-all ${
                selected
                  ? 'border-primary bg-primary/5'
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
                  <p className="font-semibold text-sm">{pct.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">{fmtUsd(entry.realValue)}</p>
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
