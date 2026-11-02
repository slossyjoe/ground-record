import type { CasualtyTrend, OutletCount, Party } from "@/lib/types";
import { formatDay, partyById } from "@/lib/utils";

export function OutletChart({ counts }: { counts: OutletCount[] }) {
  const top = counts.slice(0, 8);
  const max = Math.max(1, ...top.map((row) => row.count));
  if (!top.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No articles matched this conflict in the latest pull, so there is no outlet chart.
      </p>
    );
  }
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Count of matched articles in this pull, by outlet. This is how many items were filed, not how true they are.
      </p>
      <ul className="mt-4 space-y-2">
        {top.map((row) => (
          <li key={row.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>
                {row.name}
                <span className="text-muted-foreground"> · {row.outletType}</span>
              </span>
              <span className="tabular-nums">{row.count}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[#efe8dc]">
              <div
                className="h-2 rounded-full bg-[#1e3a34]"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CasualtyChart({
  trend,
  parties,
  figures = [],
}: {
  trend: CasualtyTrend | null;
  parties: Party[];
  figures?: { label: string; value: number; detail: string }[];
}) {
  if (figures.length) {
    const max = Math.max(...figures.map((figure) => figure.value), 1);
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          Each bar is a number written in one headline in this pull. Bars are not added together, and they are not a shared total.
        </p>
        <ul className="mt-4 space-y-3">
          {figures.slice(0, 8).map((figure) => (
            <li key={`${figure.label}-${figure.value}-${figure.detail}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{figure.label}</span>
                <span className="tabular-nums">{figure.value.toLocaleString("en-GB")}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-[#efe8dc]">
                <div className="h-2 rounded-full bg-[#1e3a34]" style={{ width: `${(figure.value / max) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{figure.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (!trend || trend.points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No casualty trend is drawn. This record does not include a made-up daily body count.
      </p>
    );
  }
  const width = 640;
  const height = 280;
  const pad = { top: 16, right: 12, bottom: 36, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const flat = trend.points.flatMap((point) => point.values.map((value) => value.high));
  const max = Math.max(1, ...flat);
  const seriesIds = trend.points[0]?.values.map((value) => value.id) ?? [];
  const step = innerW / Math.max(1, trend.points.length);

  return (
    <div>
      <p className="text-sm text-muted-foreground">{trend.caption}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 w-full" role="img" aria-label="Sample casualty ranges">
        {[0, 0.5, 1].map((tick) => {
          const y = pad.top + innerH - tick * innerH;
          const label = Math.round(max * tick).toLocaleString("en-GB");
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e0d5c4" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#5e574c">
                {label}
              </text>
            </g>
          );
        })}
        {trend.points.map((point, index) => (
          <text
            key={point.date}
            x={pad.left + index * step + step / 2}
            y={height - 12}
            textAnchor="middle"
            fontSize="11"
            fill="#5e574c"
          >
            {formatDay(point.date).replace(/ \d{4}$/, "")}
          </text>
        ))}
        {seriesIds.map((id, seriesIndex) => {
          const meta = trend.points[0].values.find((value) => value.id === id);
          const color = partyById(parties, meta?.partyId)?.color ?? "#1c1915";
          const offset = (seriesIndex - (seriesIds.length - 1) / 2) * 10;
          return (
            <g key={id}>
              {trend.points.map((point, index) => {
                const value = point.values.find((item) => item.id === id);
                if (!value) return null;
                const x = pad.left + index * step + step / 2 + offset;
                const yHigh = pad.top + innerH - (value.high / max) * innerH;
                const yLow = pad.top + innerH - (value.low / max) * innerH;
                return (
                  <g key={point.date}>
                    <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth="3" />
                    <circle cx={x} cy={yHigh} r="3" fill={color} />
                    <circle cx={x} cy={yLow} r="3" fill="#fbf8f3" stroke={color} strokeWidth="2" />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {trend.points[0].values.map((value) => {
          const color = partyById(parties, value.partyId)?.color ?? "#1c1915";
          return (
            <li key={value.id} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-6 rounded-sm" style={{ background: color }} />
              {value.label}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs uppercase tracking-wide text-[#6d4e16]">Sample · not a measurement</p>
    </div>
  );
}
