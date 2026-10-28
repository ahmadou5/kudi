import { AnimatedBlobatar } from '@blobatar/react-native/animated';
import { happy } from 'blobatar/expression';

/**
 * Avatar URLs can encode a generated blobatar instead of a photo:
 * `blobatar:<seed>`. The seed is any string (username, name, id) and the
 * same seed always renders the same character.
 */
const BLOBATAR_PREFIX = 'blobatar:';

export const isBlobatarUrl = (url?: string | null): boolean => !!url && url.startsWith(BLOBATAR_PREFIX);

export const toBlobatarUrl = (seed: string): string => `${BLOBATAR_PREFIX}${seed}`;

export const blobatarSeed = (url: string, fallback = 'kudi'): string => {
  const seed = url.slice(BLOBATAR_PREFIX.length);
  return seed || fallback;
};

interface BlobatarProps {
  name: string;
  size?: number;
  background?: 'squircle' | 'circle' | 'square';
}

export const Blobatar = ({ name, size = 48, background = 'circle' }: BlobatarProps) => (
  <AnimatedBlobatar name={name} size={size} background={background} expression={happy} animate />
);
