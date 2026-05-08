"use client";

import { useEffect, useState } from "react";
import { Activity, BarChart2, Flame, Handshake, Trophy, Users } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { getPlatformAnalytics, type PlatformAnalytics } from "@/lib/admin/analytics";
import { isFirebaseConfigured } from "@/lib/firebase";

export function AnalyticsDashboard() {
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured()) { setLoading(false); return; }
    getPlatformAnalytics()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Panel key={i} variant="raised" padding="md" className="h-24 animate-pulse bg-obsidian-800" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile
          label="Total Matches"
          value={data.totalMatches}
          icon={<Trophy className="h-4 w-4" />}
          tone="text-gold-400"
        />
        <MetricTile
          label="Matches (30d)"
          value={data.matchesLast30d}
          icon={<Activity className="h-4 w-4" />}
          tone="text-ember-400"
        />
        <MetricTile
          label="Active Players"
          value={data.activePlayers30d}
          icon={<Flame className="h-4 w-4" />}
          tone="text-ember-400"
          sub="last 30 days"
        />
        <MetricTile
          label="Open Challenges"
          value={data.openChallenges}
          icon={<Handshake className="h-4 w-4" />}
          tone="text-rune-glow"
        />
        <MetricTile
          label="Player Follows"
          value={data.totalFollows}
          icon={<Users className="h-4 w-4" />}
          tone="text-spectral-400"
        />
        <MetricTile
          label="Active Leagues"
          value={data.activeLeagues}
          icon={<BarChart2 className="h-4 w-4" />}
          tone="text-emerald-400"
        />
      </div>

      {data.matchesByDay.length > 0 && (
        <Panel variant="base" padding="md">
          <h3 className="heading-fantasy text-xs uppercase tracking-[0.2em] text-ash-500 mb-4">
            Matches — Last 7 Days
          </h3>
          <BarChart data={data.matchesByDay} />
        </Panel>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
  tone,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
  sub?: string;
}) {
  return (
    <Panel variant="raised" padding="md" className="flex flex-col gap-1">
      <div className={`${tone} shrink-0`}>{icon}</div>
      <div className="font-mono text-2xl tabular-nums text-ash-100 leading-none mt-1">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-ash-500 leading-tight">{label}</div>
      {sub && <div className="text-[9px] text-ash-600 font-mono">{sub}</div>}
    </Panel>
  );
}

function BarChart({ data }: { data: { label: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const W = 560;
  const H = 90;
  const PAD = { top: 8, right: 8, bottom: 28, left: 8 };
  const barW = Math.floor((W - PAD.left - PAD.right) / data.length) - 4;
  const innerH = H - PAD.top - PAD.bottom;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-label="Matches per day">
        {data.map((d, i) => {
          const barH = Math.max(2, (d.count / maxCount) * innerH);
          const x = PAD.left + i * (barW + 4);
          const y = PAD.top + innerH - barH;
          const isToday = i === data.length - 1;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={2}
                fill={isToday ? "#ef6820" : "#3a3a5c"}
              />
              {d.count > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 3}
                  textAnchor="middle"
                  fontSize="9"
                  fill={isToday ? "#ef6820" : "#6b7280"}
                  fontFamily="monospace"
                >
                  {d.count}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={H - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#6b7280"
                fontFamily="monospace"
              >
                {d.label.split("/")[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
