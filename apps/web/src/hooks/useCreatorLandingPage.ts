import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback } from "react";
import type {
  CreatorProfileSettings,
  CreatorSocialLink,
  CreatorAnnouncement,
  CreatorFeaturedContent,
} from "@/lib/supabase";

// ============================================================================
// READ HOOKS
// ============================================================================

/**
 * Hook for fetching creator profile settings (banner, bio, tagline)
 */
export function useCreatorProfileSettings(creatorAddress: string | undefined) {
  return useQuery({
    queryKey: ["creatorProfileSettings", creatorAddress],
    queryFn: async (): Promise<CreatorProfileSettings | null> => {
      const res = await fetch(
        `/api/creator/profile-settings?creator=${creatorAddress}`
      );
      if (!res.ok) throw new Error("Failed to fetch profile settings");
      const { data } = await res.json();
      return data;
    },
    enabled: Boolean(creatorAddress),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for fetching creator social links
 */
export function useCreatorSocialLinks(creatorAddress: string | undefined) {
  return useQuery({
    queryKey: ["creatorSocialLinks", creatorAddress],
    queryFn: async (): Promise<CreatorSocialLink[]> => {
      const res = await fetch(
        `/api/creator/social-links?creator=${creatorAddress}`
      );
      if (!res.ok) throw new Error("Failed to fetch social links");
      const { data } = await res.json();
      return data || [];
    },
    enabled: Boolean(creatorAddress),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook for fetching active creator announcements
 */
export function useCreatorAnnouncements(creatorAddress: string | undefined) {
  return useQuery({
    queryKey: ["creatorAnnouncements", creatorAddress],
    queryFn: async (): Promise<CreatorAnnouncement[]> => {
      const res = await fetch(
        `/api/creator/announcements?creator=${creatorAddress}`
      );
      if (!res.ok) throw new Error("Failed to fetch announcements");
      const { data } = await res.json();
      return data || [];
    },
    enabled: Boolean(creatorAddress),
    staleTime: 1000 * 60 * 2, // 2 minutes (announcements can change)
  });
}

/**
 * Hook for fetching featured content
 */
export function useCreatorFeaturedContent(creatorAddress: string | undefined) {
  return useQuery({
    queryKey: ["creatorFeaturedContent", creatorAddress],
    queryFn: async (): Promise<CreatorFeaturedContent[]> => {
      const res = await fetch(
        `/api/creator/featured-content?creator=${creatorAddress}`
      );
      if (!res.ok) throw new Error("Failed to fetch featured content");
      const { data } = await res.json();
      return data || [];
    },
    enabled: Boolean(creatorAddress),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Combined hook for all landing page data
 */
export function useCreatorLandingPage(creatorAddress: string | undefined) {
  const profileSettings = useCreatorProfileSettings(creatorAddress);
  const socialLinks = useCreatorSocialLinks(creatorAddress);
  const announcements = useCreatorAnnouncements(creatorAddress);
  const featuredContent = useCreatorFeaturedContent(creatorAddress);

  return {
    profileSettings,
    socialLinks,
    announcements,
    featuredContent,
    isLoading:
      profileSettings.isLoading ||
      socialLinks.isLoading ||
      announcements.isLoading ||
      featuredContent.isLoading,
    isError:
      profileSettings.isError ||
      socialLinks.isError ||
      announcements.isError ||
      featuredContent.isError,
  };
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Hook for signing messages with wallet
 */
function useSignMessage() {
  const { publicKey, signMessage } = useWallet();

  return useCallback(
    async (action: string): Promise<{ signature: string; timestamp: string }> => {
      if (!publicKey || !signMessage) {
        throw new Error("Wallet not connected");
      }

      const timestamp = Date.now().toString();
      const message = `${action}\nCreator: ${publicKey.toBase58()}\nTimestamp: ${timestamp}`;
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = Buffer.from(signatureBytes).toString("base64");

      return { signature, timestamp };
    },
    [publicKey, signMessage]
  );
}

/**
 * Hook for updating profile settings
 */
export function useUpdateProfileSettings() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const signMessageFn = useSignMessage();

  return useMutation({
    mutationFn: async (settings: {
      banner_cid?: string | null;
      banner_url?: string | null;
      bio?: string | null;
      tagline?: string | null;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const { signature, timestamp } = await signMessageFn("Update Creator Profile");

      const res = await fetch("/api/creator/profile-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator: publicKey.toBase58(),
          signature,
          timestamp,
          ...settings,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update profile settings");
      }

      return res.json();
    },
    onSuccess: () => {
      if (publicKey) {
        queryClient.invalidateQueries({
          queryKey: ["creatorProfileSettings", publicKey.toBase58()],
        });
      }
    },
  });
}

/**
 * Hook for updating social links
 */
export function useUpdateSocialLinks() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const signMessageFn = useSignMessage();

  return useMutation({
    mutationFn: async (
      links: Array<{
        platform: string;
        url: string;
        display_name?: string | null;
      }>
    ) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const { signature, timestamp } = await signMessageFn("Update Social Links");

      const res = await fetch("/api/creator/social-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator: publicKey.toBase58(),
          signature,
          timestamp,
          links,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update social links");
      }

      return res.json();
    },
    onSuccess: () => {
      if (publicKey) {
        queryClient.invalidateQueries({
          queryKey: ["creatorSocialLinks", publicKey.toBase58()],
        });
      }
    },
  });
}

/**
 * Hook for creating announcements
 */
export function useCreateAnnouncement() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const signMessageFn = useSignMessage();

  return useMutation({
    mutationFn: async (announcement: {
      title: string;
      content: string;
      link_url?: string | null;
      link_text?: string | null;
      is_pinned?: boolean;
      expires_at?: string | null;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const { signature, timestamp } = await signMessageFn("Create Announcement");

      const res = await fetch("/api/creator/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator: publicKey.toBase58(),
          signature,
          timestamp,
          ...announcement,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create announcement");
      }

      return res.json();
    },
    onSuccess: () => {
      if (publicKey) {
        queryClient.invalidateQueries({
          queryKey: ["creatorAnnouncements", publicKey.toBase58()],
        });
      }
    },
  });
}

/**
 * Hook for deleting announcements
 */
export function useDeleteAnnouncement() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const signMessageFn = useSignMessage();

  return useMutation({
    mutationFn: async (announcementId: number) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const { signature, timestamp } = await signMessageFn("Delete Announcement");

      const res = await fetch("/api/creator/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator: publicKey.toBase58(),
          signature,
          timestamp,
          announcement_id: announcementId,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete announcement");
      }

      return res.json();
    },
    onSuccess: () => {
      if (publicKey) {
        queryClient.invalidateQueries({
          queryKey: ["creatorAnnouncements", publicKey.toBase58()],
        });
      }
    },
  });
}

/**
 * Hook for updating featured content
 */
export function useUpdateFeaturedContent() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const signMessageFn = useSignMessage();

  return useMutation({
    mutationFn: async (
      featured: Array<{
        content_type: "content" | "bundle";
        content_cid: string;
        custom_title?: string | null;
        custom_description?: string | null;
      }>
    ) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const { signature, timestamp } = await signMessageFn("Update Featured Content");

      const res = await fetch("/api/creator/featured-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator: publicKey.toBase58(),
          signature,
          timestamp,
          featured,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update featured content");
      }

      return res.json();
    },
    onSuccess: () => {
      if (publicKey) {
        queryClient.invalidateQueries({
          queryKey: ["creatorFeaturedContent", publicKey.toBase58()],
        });
      }
    },
  });
}

/**
 * Combined mutations hook
 */
export function useCreatorLandingPageMutations() {
  const updateProfileSettings = useUpdateProfileSettings();
  const updateSocialLinks = useUpdateSocialLinks();
  const createAnnouncement = useCreateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();
  const updateFeaturedContent = useUpdateFeaturedContent();

  return {
    updateProfileSettings,
    updateSocialLinks,
    createAnnouncement,
    deleteAnnouncement,
    updateFeaturedContent,
    isUpdating:
      updateProfileSettings.isPending ||
      updateSocialLinks.isPending ||
      createAnnouncement.isPending ||
      deleteAnnouncement.isPending ||
      updateFeaturedContent.isPending,
  };
}
