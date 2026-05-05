"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Trophy, Users, Pencil, MapPin, X } from "lucide-react";
import { ResponsiveShell } from "@/components/layout/ResponsiveShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RuneChip } from "@/components/ui/RuneChip";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { subscribeLeaderboard, getPlayerProfile } from "@/lib/players/repo";
import { skillBand } from "@/lib/players/elo";
import type { PlayerProfileDoc } from "@/lib/firestore/types";

type Band = ReturnType<typeof skillBand>;

const BAND_TONE: Record<Band, Parameters<typeof RuneChip>[0]["tone"]> = {
  NOVICE: "neutral",
  BEGINNER: "spectral",
  INTERMEDIATE: "rune",
  ADVANCED: "ember",
  EXPERT: "gold",
  ELITE: "crimson",
};

const ALL_BANDS: Band[] = ["NOVICE", "BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT", "ELITE"];

export default function PlayersPage() {
  const { user, ready } = useAuth();
  const [rows, setRows] = useState<PlayerProfileDoc[] | null>(null);
  const [myProfile, setMyProfile] = useState<PlayerProfileDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bandFilter, setBandFilter] = useState<Band | null>(null);

  const filteredRows = useMemo(() => {
    if (!rows) return null;
    let r = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (p) =>
          p.displayName.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q) ||
          p.region?.toLowerCase().includes(q),
      );
    }
    if (bandFilter) {
      r = r.filter((p) => skillBand(p.elo) === bandFilter);
    }
    return r;
  }, [rows, search, bandFilter]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setRows([]);
      return;
    }
    const unsub = subscribeLeaderboard(setRows, 100);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setMyProfile(null);
      return;
    }
    getPlayerProfile(user.uid)
      .then(setMyProfile)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load."),
      );
  }, [user]);

  return (
    <ResponsiveShell desktopChromeless>
      <main className="container py-6 md:py-10 space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="heading-fantasy text-display-md text-ash-100 flex items-center gap-2">
              <Trophy className="h-6 w-6 text-gold-400" />
              Leaderboard
            </h1>
            <p className="text-ash-400 text-sm mt-1">
              Ranked by ELO. Climb by winning matches and taking down
              higher-rated opponents.
            </p>
          </div>
          {ready && user && (
            <Link href="/players/edit">
              <Button size="sm">
                <Pencil className="h-3.5 w-3.5" />
                {myProfile ? "Edit Profile" : "Create Profile"}
              </Button>
            </Link>
          )}
        </div>

        {error && (
          <Panel variant="base" padding="md">
            <p className="text-crimson-500 text-sm">{error}</p>
          </Panel>
        )}

        {ready && user && !myProfile && (
          <Panel variant="quest" padding="lg">
            <RuneChip tone="ember" className="mb-2">
              No profile yet
            </RuneChip>
            <p className="text-ash-300 text-sm mb-3">
              Create your player profile to appear on the leaderboard, track
              stats, and earn ELO from verified matches.
            </p>
            <Link href="/players/edit">
              <Button size="sm">Create My Profile</Button>
            </Link>
          </Panel>
        )}

        {/* Search + filter */}
        {rows !== null && rows.length > 0 && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ash-500 pointer-events-none" />
              <input
                className="w-full rounded-pixel bg-obsidian-800 border border-ash-700 text-ash-100 pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-ember-500 placeholder:text-ash-600"
                placeholder="Search by name or city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ash-500 hover:text-ash-100 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_BANDS.map((band) => (
                <button
                  key={band}
                  type="button"
                  onClick={() => setBandFilter((prev) => (prev === band ? null : band))}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    bandFilter === band
                      ? "bg-ember-500/20 border-ember-500/60 text-ember-300"
                      : "bg-obsidian-700 border-ash-700 text-ash-400 hover:border-ash-500 hover:text-ash-200"
                  }`}
                >
                  {band.charAt(0) + band.slice(1).toLowerCase()}
                </button>
              ))}
              {(search || bandFilter) && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setBandFilter(null); }}
                  className="px-2.5 py-1 rounded-full text-xs border border-ash-700 text-ash-500 hover:text-ash-200 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {filteredRows === null ? (
          <SkeletonList count={5} />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title={rows && rows.length > 0 ? "No players match your search" : "No players yet"}
            description={
              rows && rows.length > 0
                ? "Try adjusting your search or filters."
                : "Be the first to create a profile and appear on the leaderboard."
            }
          />
        ) : (
          <Panel variant="inventory" padding="md">
            <ol className="divide-y divide-obsidian-400">
              {filteredRows.map((p, i) => {
                const band = skillBand(p.elo);
                const globalRank = rows ? rows.findIndex((r) => r.userId === p.userId) + 1 : i + 1;
                const isMe = user && p.userId === user.uid;
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="w-8 text-right heading-fantasy text-sm text-ash-500">
                      {globalRank}
                    </span>
                    <Link
                      href={`/players/view?uid=${p.userId}`}
                      className="flex-1 min-w-0 flex items-center gap-3 hover:bg-obsidian-700/30 rounded-pixel px-2 py-1 -mx-2"
                    >
                      {p.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photoURL}
                          alt=""
                          className="h-8 w-8 rounded-pixel object-cover border border-obsidian-400"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-pixel bg-obsidian-700 border border-obsidian-400 flex items-center justify-center text-xs text-ash-500">
                          {p.displayName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ash-100 truncate flex items-center gap-2">
                          {p.displayName}
                          {isMe && (
                            <span className="text-[10px] text-ember-400 uppercase tracking-widest">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-ash-500 font-mono flex items-center gap-2">
                          {p.city && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {p.city}
                              {p.region ? `, ${p.region}` : ""}
                            </span>
                          )}
                          {p.homeVenueName && (
                            <span>· {p.homeVenueName}</span>
                          )}
                        </div>
                      </div>
                      <RuneChip tone={BAND_TONE[band]}>{band}</RuneChip>
                      <div className="w-14 text-right heading-fantasy text-sm text-ash-100">
                        {p.elo}
                      </div>
                      <div className="w-16 text-right text-[11px] text-ash-500 font-mono hidden md:block">
                        {p.stats.wins}W-{p.stats.losses}L
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Panel>
        )}
      </main>
    </ResponsiveShell>
  );
}
