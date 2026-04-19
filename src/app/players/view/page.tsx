"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Swords,
  Pencil,
  Trophy,
  Activity,
} from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { useAuth } from "@/lib/auth-context";
import {
  getPlayerProfile,
  listRecentEloEvents,
} from "@/lib/players/repo";
import { skillBand } from "@/lib/players/elo";
import type {
  PlayerProfileDoc,
  EloEventDoc,
} from "@/lib/firestore/types";

export default function PlayerViewPage() {
  return (
    <Suspense
      fallback={
        <ResponsiveShell desktopChromeless>
          <main className="container py-10 text-ash-400">Loading…</main>
        </ResponsiveShell>
      }
    >
      <PlayerView />
    </Suspense>
  );
}

function PlayerView() {
  const params = useSearchParams();
  const uid = params.get("uid");
  const { user } = useAuth();
  const [profile, setProfile] = useState<PlayerProfileDoc | null>(null);
  const [events, setEvents] = useState<EloEventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setError("Missing uid.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [p, ev] = await Promise.all([
          getPlayerProfile(uid),
          listRecentEloEvents(uid, 20).catch(() => []),
        ]);
        setProfile(p);
        setEvents(ev);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  if (loading) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10">
          <Panel variant="base" padding="md">
            <p className="text-ash-400 text-sm">Loading profile…</p>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }
  if (error || !profile) {
    return (
      <ResponsiveShell desktopChromeless>
        <main className="container py-10">
          <Panel variant="base" padding="md">
            <h2 className="heading-fantasy text-lg text-crimson-500 mb-2">
              Profile not found
            </h2>
            <p className="text-ash-400 text-sm">
              {error ?? "This player has no profile yet."}
            </p>
            <Link
              href="/players"
              className="text-spectral-500 hover:text-spectral-400 text-sm mt-3 inline-block"
            >
              ← Leaderboard
            </Link>
          </Panel>
        </main>
      </ResponsiveShell>
    );
  }

  const band = skillBand(profile.elo);
  const isMe = user?.uid === profile.userId;
  const winRate =
    profile.stats.matches > 0
      ? Math.round((profile.stats.wins / profile.stats.matches) * 100)
      : 0;
  const avgPoints =
    profile.stats.matches > 0
      ? (profile.stats.pointsFor / profile.stats.matches).toFixed(1)
      : "—";

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6 max-w-3xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/players"
            className="text-ash-400 hover:text-ash-200 text-sm inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Leaderboard
          </Link>
          {isMe && (
            <Link href="/players/edit">
              <Button size="sm" variant="outline">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </Link>
          )}
        </div>

        <Panel variant="quest" padding="lg" glow="rune">
          <div className="flex items-start gap-4 flex-wrap">
            {profile.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoURL}
                alt=""
                className="h-20 w-20 rounded-pixel object-cover border border-obsidian-400"
              />
            ) : (
              <div className="h-20 w-20 rounded-pixel bg-obsidian-700 border border-obsidian-400 flex items-center justify-center heading-fantasy text-2xl text-ash-400">
                {profile.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <RuneChip tone="ember">{band}</RuneChip>
                {profile.dominantHand && (
                  <RuneChip tone="neutral">
                    {profile.dominantHand === "AMBI"
                      ? "Ambidextrous"
                      : `${profile.dominantHand.toLowerCase()}-handed`}
                  </RuneChip>
                )}
              </div>
              <h1 className="heading-fantasy text-display-md text-ash-100 mt-2">
                {profile.displayName}
              </h1>
              <div className="text-ash-500 text-xs font-mono mt-1 flex items-center gap-2 flex-wrap">
                {profile.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[profile.city, profile.region, profile.country]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
                {profile.homeVenueName && (
                  <span>· Home: {profile.homeVenueName}</span>
                )}
              </div>
              {profile.bio && (
                <p className="text-ash-300 text-sm mt-3 leading-relaxed">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </Panel>

        <div className="grid gap-3 md:grid-cols-4">
          <Stat
            icon={<Trophy className="h-4 w-4 text-gold-400" />}
            label="ELO"
            value={String(profile.elo)}
            sub={`Peak ${profile.eloPeak}`}
          />
          <Stat
            icon={<Swords className="h-4 w-4 text-ember-400" />}
            label="Record"
            value={`${profile.stats.wins}-${profile.stats.losses}`}
            sub={`${winRate}% win rate`}
          />
          <Stat
            icon={<Activity className="h-4 w-4 text-spectral-400" />}
            label="Matches"
            value={String(profile.stats.matches)}
            sub={`${avgPoints} PF/match`}
          />
          <Stat
            icon={<Trophy className="h-4 w-4 text-rune-glow" />}
            label="DUPR"
            value={
              typeof profile.duprRating === "number"
                ? profile.duprRating.toFixed(3)
                : "—"
            }
            sub={profile.duprId ? `id: ${profile.duprId}` : "not linked"}
          />
        </div>

        {(profile.paddleBrand || profile.paddleModel || profile.yearsPlaying) && (
          <Panel variant="inventory" padding="md">
            <h2 className="heading-fantasy text-lg text-ash-100 mb-2">
              Equipment
            </h2>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {profile.paddleBrand && (
                <DescItem label="Paddle" value={profile.paddleBrand} />
              )}
              {profile.paddleModel && (
                <DescItem label="Model" value={profile.paddleModel} />
              )}
              {typeof profile.yearsPlaying === "number" && (
                <DescItem
                  label="Experience"
                  value={`${profile.yearsPlaying} yr${profile.yearsPlaying === 1 ? "" : "s"}`}
                />
              )}
            </dl>
          </Panel>
        )}

        <Panel variant="base" padding="md">
          <h2 className="heading-fantasy text-lg text-ash-100 mb-3">
            Recent ELO Changes
          </h2>
          {events.length === 0 ? (
            <p className="text-ash-500 text-sm">
              No rated matches yet. Play a match and have it verified to see
              ELO events here.
            </p>
          ) : (
            <ul className="divide-y divide-obsidian-400">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-ash-200 truncate">
                      {e.source === "ladderMatch"
                        ? "Ladder match"
                        : e.source === "tournamentMatch"
                          ? "Tournament match"
                          : e.source}{" "}
                      {typeof e.pointsFor === "number" &&
                        typeof e.pointsAgainst === "number" && (
                          <span className="text-ash-500 font-mono">
                            · {e.pointsFor}–{e.pointsAgainst}
                          </span>
                        )}
                    </div>
                    <div className="text-[11px] text-ash-500 font-mono">
                      {e.eloBefore} → {e.eloAfter}
                    </div>
                  </div>
                  <span
                    className={`heading-fantasy text-sm ${e.delta >= 0 ? "text-ember-400" : "text-crimson-500"}`}
                  >
                    {e.delta >= 0 ? "+" : ""}
                    {e.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </main>
    </ResponsiveShell>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Panel variant="inventory" padding="md">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ash-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="heading-fantasy text-2xl text-ash-100 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-ash-500 font-mono">{sub}</div>}
    </Panel>
  );
}

function DescItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.2em] text-ash-500">
        {label}
      </dt>
      <dd className="text-ash-100">{value}</dd>
    </div>
  );
}
