"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CalendarX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getRsvpStatus, setRsvp, removeRsvp } from "@/lib/ladder/rsvp";
import { useAuth } from "@/lib/auth-context";

interface Props {
  playDateId: string;
  className?: string;
}

/** Inline RSVP toggle. Shows attending/not-attending for the current user. */
export function RsvpButton({ playDateId, className }: Props) {
  const { user } = useAuth();
  const [attending, setAttending] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getRsvpStatus(playDateId, user.uid)
      .then(setAttending)
      .finally(() => setLoading(false));
  }, [playDateId, user]);

  if (!user || loading) return null;

  async function toggle() {
    if (!user || pending) return;
    setPending(true);
    try {
      if (attending) {
        await removeRsvp(playDateId, user.uid);
        setAttending(null);
      } else {
        await setRsvp(playDateId, user.uid, user.displayName ?? "Player", true);
        setAttending(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      size="sm"
      variant={attending ? "outline" : "ghost"}
      className={className}
      onClick={toggle}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : attending ? (
        <><CalendarCheck className="h-3.5 w-3.5 text-spectral-400" /> Going</>
      ) : (
        <><CalendarX className="h-3.5 w-3.5" /> RSVP</>
      )}
    </Button>
  );
}
