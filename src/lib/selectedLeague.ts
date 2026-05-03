const SELECTED_LEAGUE_KEY = "selectedLeagueId";

export function getStoredSelectedLeagueId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(SELECTED_LEAGUE_KEY);
}

export function storeSelectedLeagueId(leagueId: string | null): void {
  if (typeof window === "undefined") return;
  if (!leagueId) {
    window.sessionStorage.removeItem(SELECTED_LEAGUE_KEY);
    return;
  }
  window.sessionStorage.setItem(SELECTED_LEAGUE_KEY, leagueId);
}

export function resolveSelectedLeagueId(
  searchParams: URLSearchParams | null,
): string | null {
  if (!searchParams) return getStoredSelectedLeagueId();
  const leagueId = searchParams.get("leagueId");
  if (leagueId) {
    storeSelectedLeagueId(leagueId);
    return leagueId;
  }
  return getStoredSelectedLeagueId();
}
