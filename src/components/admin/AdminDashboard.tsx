/**
 * Admin Dashboard
 * Operational control surface for admins
 * Shows season/play date management, check-in review, session generation, monitoring, and finalization
 */

"use client";

import React, { useState } from "react";
import {
  LadderSeasonDoc,
  PlayDateDoc,
  CheckInDoc,
  LadderSessionDoc,
} from "@/lib/firestore/types";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import {
  Calendar,
  Users,
  Play,
  Eye,
  CheckCircle,
  Settings,
  Plus,
} from "lucide-react";

export interface AdminDashboardProps {
  currentSeason?: LadderSeasonDoc;
  upcomingPlayDates: PlayDateDoc[];
  selectedPlayDate?: PlayDateDoc;
  onSelectPlayDate: (pd: PlayDateDoc) => void;
  onCreateSeason: () => void;
  onCreatePlayDate: () => void;
  onReviewAttendance: (pd: PlayDateDoc) => void;
  onGenerateSession: (pd: PlayDateDoc) => void;
  onMonitorSession: (session: LadderSessionDoc) => void;
  onFinalizeSession: (session: LadderSessionDoc) => void;
}

export function AdminDashboard(props: AdminDashboardProps) {
  const {
    currentSeason,
    upcomingPlayDates,
    selectedPlayDate,
    onSelectPlayDate,
    onCreateSeason,
    onCreatePlayDate,
    onReviewAttendance,
    onGenerateSession,
    onMonitorSession,
    onFinalizeSession,
  } = props;

  const [activeTab, setActiveTab] = useState<
    "overview" | "season" | "playdate" | "checkin" | "generation" | "monitoring"
  >("overview");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex gap-2">
          <Button onClick={onCreateSeason} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New Season
          </Button>
        </div>
      </div>

      {/* Status Block */}
      <Panel className="bg-slate-50 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-slate-600">Current Season</div>
            <div className="text-lg font-semibold">
              {currentSeason?.name || "—"}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-600">Play Dates</div>
            <div className="text-lg font-semibold">{upcomingPlayDates.length}</div>
          </div>
          <div>
            <div className="text-sm text-slate-600">Selected</div>
            <div className="text-lg font-semibold">
              {selectedPlayDate?.date.substring(0, 10) || "—"}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-600">Status</div>
            <div className="text-lg font-semibold">
              {selectedPlayDate?.status || "—"}
            </div>
          </div>
        </div>
      </Panel>

      {/* Play Date Selection */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Play Dates</h2>
        </div>
        {upcomingPlayDates.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No play dates scheduled</p>
            <Button
              onClick={onCreatePlayDate}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              Create Play Date
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {upcomingPlayDates.map((pd) => (
                <button
                  key={pd.id}
                  onClick={() => onSelectPlayDate(pd)}
                  className={`w-full text-left p-3 rounded border-2 transition ${
                    selectedPlayDate?.id === pd.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <div className="font-semibold">{pd.date}</div>
                  <div className="text-sm text-slate-600">
                    Status: <span className="font-medium">{pd.status}</span>
                  </div>
                </button>
              ))}
            </div>
            <Button
              onClick={onCreatePlayDate}
              variant="outline"
              size="sm"
              className="w-full"
            >
              + New Play Date
            </Button>
          </>
        )}
      </Panel>

      {/* Operational Workflows */}
      {selectedPlayDate && (
        <Panel>
          <h2 className="text-xl font-semibold mb-4">Session Workflow</h2>
          <div className="space-y-3">
            <OperationalStep
              icon={<Users className="w-5 h-5" />}
              title="1. Review Attendance"
              description="Review check-ins and adjust fairness placements"
              onClick={() => onReviewAttendance(selectedPlayDate)}
              buttonLabel="Review"
            />
            <OperationalStep
              icon={<Play className="w-5 h-5" />}
              title="2. Generate Session A"
              description="Create court distribution and match rotations"
              onClick={() => onGenerateSession(selectedPlayDate)}
              buttonLabel="Generate"
            />
            <OperationalStep
              icon={<Eye className="w-5 h-5" />}
              title="3. Monitor Session A"
              description="Track pending, submitted, and verified scores"
              onClick={() => {
                // TODO: Implement monitoringflow
              }}
              buttonLabel="Monitor"
              disabled
            />
            <OperationalStep
              icon={<CheckCircle className="w-5 h-5" />}
              title="4. Finalize Session A"
              description="Assign incomplete matches and compute movement"
              onClick={() => {
                // TODO: Implement finalization flow
              }}
              buttonLabel="Finalize"
              disabled
            />
            <OperationalStep
              icon={<Play className="w-5 h-5" />}
              title="5. Generate Session B"
              description="Create Session B from Session A participants"
              onClick={() => {
                // TODO: Implement Session B generation
              }}
              buttonLabel="Generate"
              disabled
            />
          </div>
        </Panel>
      )}

      {/* Shortcuts */}
      <Panel className="bg-slate-50 p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Button variant="outline" size="sm" className="w-full">
            View Seasons
          </Button>
          <Button variant="outline" size="sm" className="w-full">
            Manage Venues
          </Button>
          <Button variant="outline" size="sm" className="w-full">
            Audit Log
          </Button>
        </div>
      </Panel>
    </div>
  );
}

interface OperationalStepProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
}

function OperationalStep({
  icon,
  title,
  description,
  buttonLabel,
  onClick,
  disabled,
}: OperationalStepProps) {
  return (
    <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
      <div className="flex items-center gap-3">
        <div className="text-blue-600">{icon}</div>
        <div>
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-xs text-slate-600">{description}</div>
        </div>
      </div>
      <Button
        onClick={onClick}
        disabled={disabled}
        size="sm"
        variant="outline"
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
