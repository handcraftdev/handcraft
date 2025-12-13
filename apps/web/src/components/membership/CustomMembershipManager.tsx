"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface CustomMembershipTier {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  benefits: string[];
  isActive: boolean;
}

interface CustomMembershipManagerProps {
  onSave?: () => void;
}

// Generate a simple unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function CustomMembershipManager({ onSave }: CustomMembershipManagerProps) {
  const { publicKey, signMessage } = useWallet();
  const queryClient = useQueryClient();

  const [tiers, setTiers] = useState<CustomMembershipTier[]>([]);
  const [editingTier, setEditingTier] = useState<CustomMembershipTier | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing custom memberships
  const { isLoading: isLoadingTiers } = useQuery({
    queryKey: ["customMemberships", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return [];
      const res = await fetch(`/api/memberships/custom?creator=${publicKey.toBase58()}`);
      if (!res.ok) return [];
      const data = await res.json();
      setTiers(data.tiers || []);
      return data.tiers || [];
    },
    enabled: !!publicKey,
  });

  // Save tiers mutation
  const saveTiers = useMutation({
    mutationFn: async (updatedTiers: CustomMembershipTier[]) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!signMessage) throw new Error("Wallet does not support signing");

      const creator = publicKey.toBase58();
      const timestamp = Date.now().toString();
      const message = `Update Custom Memberships\nCreator: ${creator}\nTimestamp: ${timestamp}`;
      const messageBytes = new TextEncoder().encode(message);

      // Sign the message
      const signatureBytes = await signMessage(messageBytes);
      const signature = Buffer.from(signatureBytes).toString("base64");

      const res = await fetch("/api/memberships/custom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creator,
          tiers: updatedTiers,
          signature,
          timestamp,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customMemberships"] });
      onSave?.();
    },
  });

  const handleAddTier = () => {
    setEditingTier({
      id: generateId(),
      name: "",
      description: "",
      monthlyPrice: 0.1,
      benefits: [""],
      isActive: true,
    });
    setIsAddingNew(true);
  };

  const handleEditTier = (tier: CustomMembershipTier) => {
    setEditingTier({ ...tier, benefits: [...tier.benefits] });
    setIsAddingNew(false);
  };

  const handleSaveTier = async () => {
    if (!editingTier) return;
    setError(null);

    // Validation
    if (!editingTier.name.trim()) {
      setError("Name is required");
      return;
    }
    if (editingTier.monthlyPrice <= 0) {
      setError("Price must be greater than 0");
      return;
    }

    // Filter out empty benefits
    const cleanedTier = {
      ...editingTier,
      name: editingTier.name.trim(),
      description: editingTier.description.trim(),
      benefits: editingTier.benefits.filter(b => b.trim()),
    };

    let updatedTiers: CustomMembershipTier[];
    if (isAddingNew) {
      updatedTiers = [...tiers, cleanedTier];
    } else {
      updatedTiers = tiers.map(t => t.id === cleanedTier.id ? cleanedTier : t);
    }

    try {
      await saveTiers.mutateAsync(updatedTiers);
      setTiers(updatedTiers);
      setEditingTier(null);
      setIsAddingNew(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    const updatedTiers = tiers.filter(t => t.id !== tierId);
    try {
      await saveTiers.mutateAsync(updatedTiers);
      setTiers(updatedTiers);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleActive = async (tierId: string) => {
    const updatedTiers = tiers.map(t =>
      t.id === tierId ? { ...t, isActive: !t.isActive } : t
    );
    try {
      await saveTiers.mutateAsync(updatedTiers);
      setTiers(updatedTiers);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addBenefit = () => {
    if (!editingTier) return;
    setEditingTier({
      ...editingTier,
      benefits: [...editingTier.benefits, ""],
    });
  };

  const updateBenefit = (index: number, value: string) => {
    if (!editingTier) return;
    const newBenefits = [...editingTier.benefits];
    newBenefits[index] = value;
    setEditingTier({ ...editingTier, benefits: newBenefits });
  };

  const removeBenefit = (index: number) => {
    if (!editingTier) return;
    setEditingTier({
      ...editingTier,
      benefits: editingTier.benefits.filter((_, i) => i !== index),
    });
  };

  if (!publicKey) {
    return (
      <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 p-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
        <p className="relative text-white/40 text-center">Connect wallet to manage custom memberships</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="relative p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-medium text-white/90">Custom Memberships</h2>
              <p className="text-sm text-white/40">Create tiers with custom perks (Discord, early access, etc.)</p>
            </div>
          </div>
          {!editingTier && (
            <button
              onClick={handleAddTier}
              className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 hover:border-orange-500/50 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 text-white/90"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Tier
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative p-5">
        {/* Editing Form */}
        {editingTier && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-5">
            <h3 className="font-medium text-white/90 mb-4">{isAddingNew ? "New Tier" : "Edit Tier"}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">Tier Name</label>
                <input
                  type="text"
                  value={editingTier.name}
                  onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                  placeholder="e.g., Bronze Supporter, VIP Access"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/90 focus:outline-none focus:border-orange-500/50 focus:bg-white/[0.07] transition-all duration-300 placeholder:text-white/20"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">Description</label>
                <textarea
                  value={editingTier.description}
                  onChange={(e) => setEditingTier({ ...editingTier, description: e.target.value })}
                  placeholder="Describe what this tier offers..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/90 focus:outline-none focus:border-orange-500/50 focus:bg-white/[0.07] transition-all duration-300 placeholder:text-white/20 resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">Monthly Price (SOL)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={editingTier.monthlyPrice}
                  onChange={(e) => setEditingTier({ ...editingTier, monthlyPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/90 focus:outline-none focus:border-orange-500/50 focus:bg-white/[0.07] transition-all duration-300 placeholder:text-white/20"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">Benefits</label>
                <div className="space-y-2">
                  {editingTier.benefits.map((benefit, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={benefit}
                        onChange={(e) => updateBenefit(index, e.target.value)}
                        placeholder="e.g., Discord access, Early updates"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white/90 text-sm focus:outline-none focus:border-orange-500/50 focus:bg-white/[0.07] transition-all duration-300 placeholder:text-white/20"
                      />
                      <button
                        onClick={() => removeBenefit(index)}
                        className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-xl transition-all duration-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addBenefit}
                    className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add benefit
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setEditingTier(null);
                    setIsAddingNew(false);
                    setError(null);
                  }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl font-medium transition-all duration-300 text-white/70 hover:text-white/90"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTier}
                  disabled={saveTiers.isPending}
                  className="flex-1 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 hover:border-orange-500/50 disabled:opacity-50 rounded-xl font-medium transition-all duration-300 text-white/90"
                >
                  {saveTiers.isPending ? "Saving..." : "Save Tier"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Existing Tiers List */}
        {isLoadingTiers ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-24 bg-white/5 rounded-xl"></div>
            ))}
          </div>
        ) : tiers.length === 0 && !editingTier ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white/90 mb-2">No custom tiers yet</h3>
            <p className="text-white/40 mb-4">Create tiers for external perks like Discord access, shoutouts, etc.</p>
            <button
              onClick={handleAddTier}
              className="px-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 hover:border-orange-500/50 rounded-xl text-sm font-medium transition-all duration-300 text-white/90"
            >
              Create Your First Tier
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`relative bg-white/5 rounded-xl p-4 border transition-all duration-300 ${
                  tier.isActive ? "border-white/10" : "border-white/5 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-white/90">{tier.name}</h4>
                      {!tier.isActive && (
                        <span className="px-2 py-0.5 bg-white/10 text-white/50 text-xs rounded-lg">Inactive</span>
                      )}
                    </div>
                    <p className="text-sm text-white/40 mb-2">{tier.description || "No description"}</p>
                    <p className="text-lg font-bold text-orange-400">{tier.monthlyPrice} SOL<span className="text-sm text-white/40 font-normal">/mo</span></p>
                    {tier.benefits.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {tier.benefits.slice(0, 3).map((benefit, i) => (
                          <li key={i} className="text-xs text-white/40 flex items-center gap-1">
                            <svg className="w-3 h-3 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {benefit}
                          </li>
                        ))}
                        {tier.benefits.length > 3 && (
                          <li className="text-xs text-white/30">+{tier.benefits.length - 3} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(tier.id)}
                      className={`p-2 rounded-xl transition-all duration-300 ${
                        tier.isActive
                          ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20"
                          : "bg-white/5 text-white/40 hover:bg-white/10 border border-white/10"
                      }`}
                      title={tier.isActive ? "Deactivate" : "Activate"}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {tier.isActive ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEditTier(tier)}
                      className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all duration-300"
                      title="Edit"
                    >
                      <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteTier(tier.id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-xl transition-all duration-300"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        {tiers.length > 0 && !editingTier && (
          <div className="mt-4 bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
            <p className="text-sm text-orange-300/80">
              Custom memberships are for external perks only (Discord roles, early access, etc.).
              They do not grant access to gated content on the platform.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
