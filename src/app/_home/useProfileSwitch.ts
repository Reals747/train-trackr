"use client";

import { useCallback, useState } from "react";
import type { RoleName } from "@/lib/permissions";
import type { ActiveProfile, StoreProfileRow } from "./types";

type SaveProfileBody = {
  activeProfile: ActiveProfile;
  storeCode?: string;
};

export function useProfileSwitch({
  role,
  activeProfile,
  setActiveProfile,
  storeProfiles,
  saveProfile,
  onSuccess,
}: {
  role: RoleName | null | undefined;
  activeProfile: ActiveProfile;
  setActiveProfile: (value: ActiveProfile) => void;
  storeProfiles: StoreProfileRow[];
  saveProfile: (body: SaveProfileBody) => Promise<unknown>;
  onSuccess?: (next: ActiveProfile) => void | Promise<void>;
}) {
  const [profileSaving, setProfileSaving] = useState(false);
  const [pendingProfileKey, setPendingProfileKey] = useState<ActiveProfile | null>(null);
  const [profileSwitchError, setProfileSwitchError] = useState("");

  const applyProfileSwitch = useCallback(
    async (next: ActiveProfile, storeCode?: string) => {
      const prev = activeProfile;
      setActiveProfile(next);
      setProfileSaving(true);
      setProfileSwitchError("");
      try {
        const body: SaveProfileBody = { activeProfile: next };
        if (storeCode) body.storeCode = storeCode;
        await saveProfile(body);
        await onSuccess?.(next);
        setPendingProfileKey(null);
      } catch (err) {
        setActiveProfile(prev);
        const message = err instanceof Error ? err.message : "Could not switch profile.";
        setProfileSwitchError(message);
        throw err;
      } finally {
        setProfileSaving(false);
      }
    },
    [activeProfile, onSuccess, saveProfile, setActiveProfile],
  );

  const requestProfileSwitch = useCallback(
    (next: ActiveProfile) => {
      if (next === activeProfile || profileSaving) return;
      if (role === "TRAINER") {
        setProfileSwitchError("");
        setPendingProfileKey(next);
        return;
      }
      void applyProfileSwitch(next).catch(() => undefined);
    },
    [activeProfile, applyProfileSwitch, profileSaving, role],
  );

  const confirmPendingProfileSwitch = useCallback(
    async (storeCode: string) => {
      if (!pendingProfileKey) return;
      await applyProfileSwitch(pendingProfileKey, storeCode);
    },
    [applyProfileSwitch, pendingProfileKey],
  );

  const cancelPendingProfileSwitch = useCallback(() => {
    setPendingProfileKey(null);
    setProfileSwitchError("");
  }, []);

  const pendingProfileName =
    storeProfiles.find((profile) => profile.key === pendingProfileKey)?.name ??
    pendingProfileKey ??
    "";

  return {
    profileSaving,
    pendingProfileKey,
    pendingProfileName,
    profileSwitchError,
    requestProfileSwitch,
    confirmPendingProfileSwitch,
    cancelPendingProfileSwitch,
  };
}
