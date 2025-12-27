"use client";

import { CreatorMembershipSettings, CustomMembershipManager } from "@/components/membership";

export function MembershipTab() {
  return (
    <div className="space-y-6">
      <CreatorMembershipSettings />
      <CustomMembershipManager />
    </div>
  );
}
