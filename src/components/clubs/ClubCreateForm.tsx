"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { CreateClubInput } from "@/lib/permissions/types";

interface ClubCreateFormProps {
  onSubmit: (data: CreateClubInput) => Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<CreateClubInput>;
  isEditing?: boolean;
}

export function ClubCreateForm({
  onSubmit,
  onCancel,
  initialData,
  isEditing,
}: ClubCreateFormProps) {
  const [clubName, setClubName] = useState(initialData?.clubName ?? "");
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [logoUrl, setLogoUrl] = useState(initialData?.logoUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clubName.trim() || !location.trim()) {
      setError("Club name and location are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        clubName: clubName.trim(),
        location: location.trim(),
        description: description.trim(),
        logoUrl: logoUrl.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded border border-ash-700 bg-ash-900 text-ash-100 px-3 py-2 text-sm focus:outline-none focus:border-ember-500 placeholder:text-ash-600";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-ash-400 mb-1 uppercase tracking-wider">
          Club Name *
        </label>
        <input
          type="text"
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
          placeholder="e.g. Irongate Pickleball Club"
          className={inputClass}
          required
        />
      </div>
      <div>
        <label className="block text-xs text-ash-400 mb-1 uppercase tracking-wider">
          Location *
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Austin, TX"
          className={inputClass}
          required
        />
      </div>
      <div>
        <label className="block text-xs text-ash-400 mb-1 uppercase tracking-wider">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell us about your club..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>
      <div>
        <label className="block text-xs text-ash-400 mb-1 uppercase tracking-wider">
          Logo URL (optional)
        </label>
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://..."
          className={inputClass}
        />
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting
            ? isEditing
              ? "Saving…"
              : "Submitting…"
            : isEditing
              ? "Save Changes"
              : "Submit for Approval"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
