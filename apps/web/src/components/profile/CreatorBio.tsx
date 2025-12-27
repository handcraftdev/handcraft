"use client";

import { SocialLinkIcon, getPlatformDisplayName } from "./SocialLinkIcon";
import type { CreatorSocialLink } from "@/lib/supabase";

interface CreatorBioProps {
  bio: string | null | undefined;
  tagline: string | null | undefined;
  socialLinks: CreatorSocialLink[];
  isEditable?: boolean;
  onEditBio?: () => void;
  onEditLinks?: () => void;
}

export function CreatorBio({
  bio,
  tagline,
  socialLinks,
  isEditable = false,
  onEditBio,
  onEditLinks,
}: CreatorBioProps) {
  const hasBio = bio || tagline;
  const hasLinks = socialLinks.length > 0;

  if (!hasBio && !hasLinks && !isEditable) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Tagline */}
      {tagline && (
        <p className="text-lg text-white/70 font-medium">{tagline}</p>
      )}

      {/* Bio */}
      {bio && (
        <div className="relative group">
          <p className="text-white/50 text-sm leading-relaxed whitespace-pre-wrap">
            {bio}
          </p>
          {isEditable && onEditBio && (
            <button
              onClick={onEditBio}
              className="absolute top-0 right-0 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-lg transition-all duration-300"
            >
              <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Empty state for editable */}
      {!hasBio && isEditable && (
        <button
          onClick={onEditBio}
          className="text-white/30 text-sm hover:text-white/50 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add a bio to tell visitors about yourself
        </button>
      )}

      {/* Social Links */}
      {(hasLinks || isEditable) && (
        <div className="flex flex-wrap items-center gap-3">
          {socialLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-300 group"
              title={link.display_name || getPlatformDisplayName(link.platform)}
            >
              <SocialLinkIcon
                platform={link.platform}
                className="w-4 h-4 text-white/50 group-hover:text-white/80 transition-colors"
              />
              <span className="text-sm text-white/60 group-hover:text-white/90 transition-colors">
                {link.display_name || getPlatformDisplayName(link.platform)}
              </span>
            </a>
          ))}

          {/* Edit links button */}
          {isEditable && onEditLinks && (
            <button
              onClick={onEditLinks}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-300 text-white/40 hover:text-white/60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-sm">
                {hasLinks ? "Edit links" : "Add links"}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
