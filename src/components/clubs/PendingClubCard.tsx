import { Building2, CheckCircle, Clock, Edit, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RuneChip } from "@/components/ui/RuneChip";
import type { ClubDoc } from "@/lib/permissions/types";

const STATUS_CONFIG = {
  pending: {
    Icon: Clock,
    tone: "rune" as const,
    label: "Pending Approval",
    detail: "Your submission is under review by a Site Administrator.",
  },
  approved: {
    Icon: CheckCircle,
    tone: "success" as const,
    label: "Approved",
    detail: "Your club is approved. You are now a Club Director.",
  },
  rejected: {
    Icon: XCircle,
    tone: "danger" as const,
    label: "Not Approved",
    detail: "Your club proposal was not approved.",
  },
};

interface PendingClubCardProps {
  club: ClubDoc;
  onEdit?: () => void;
}

export function PendingClubCard({ club, onEdit }: PendingClubCardProps) {
  const { Icon, tone, label, detail } = STATUS_CONFIG[club.status];

  return (
    <Panel variant="quest" padding="lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded bg-ash-800 shrink-0">
            <Building2 className="h-5 w-5 text-ember-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="heading-fantasy text-ash-100 text-base">{club.clubName}</h3>
              <RuneChip tone={tone} className="inline-flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {label}
              </RuneChip>
            </div>
            <p className="text-ash-400 text-xs mb-1">{club.location}</p>
            <p className="text-ash-500 text-xs">{detail}</p>
          </div>
        </div>
        {club.status === "pending" && onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit} className="shrink-0">
            <Edit className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </div>
      {club.description && (
        <p className="text-ash-400 text-sm mt-3 pt-3 border-t border-ash-800">
          {club.description}
        </p>
      )}
    </Panel>
  );
}
