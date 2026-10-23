import React from 'react';
import { Image } from 'react-native';
import { Blobatar, isBlobatarUrl, blobatarSeed } from './Blobatar';

export interface AvatarProps {
  /** Stored avatar: a photo URI/data-URI, a `blobatar:<seed>` URL, or empty. */
  avatarUrl?: string | null;
  /** Seed used when there is no photo at all — typically the user's name/username. */
  seed?: string;
  /** Diameter in points. */
  size: number;
}

/** Stable blobatar seed for a user: same string, same character, everywhere. */
export const userAvatarSeed = (
  user?: { username?: string; fullName?: string; id?: string } | null
): string => (user?.username || user?.fullName || user?.id || 'kudi').trim() || 'kudi';

/**
 * Renders the user's picture with a generated Blobatar as the fallback:
 *  - photo URI   → the photo
 *  - blobatar:…  → the chosen generated character
 *  - empty       → a character seeded from the user's identity
 */
export const Avatar = ({ avatarUrl, seed = 'kudi', size }: AvatarProps) => {
  if (avatarUrl && !isBlobatarUrl(avatarUrl)) {
    return <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  const name = avatarUrl ? blobatarSeed(avatarUrl, seed) : seed;
  return <Blobatar name={name} size={size} />;
};
