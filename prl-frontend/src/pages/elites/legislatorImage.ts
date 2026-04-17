/**
 * Shared legislator image utilities.
 *
 * Primary source: congress.gov (by bioguide ID).
 * Fallback: Twitter profile image stored in S3 (by bioguide ID).
 */

const TWITTER_IMAGE_BASE = '/elites/profiles/national/images/twitter';

export function getBioguideFromImageUrl(imageUrl?: string): string | null {
  if (!imageUrl) return null;
  const match = imageUrl.match(/\/([A-Z]\d{6})\.(?:jpg|png|webp)$/i);
  return match ? match[1].toUpperCase() : null;
}

export function getCongressImageUrl(bioguideId: string): string {
  return `https://www.congress.gov/img/member/${bioguideId.toLowerCase()}_200.jpg`;
}

export function getTwitterImageUrl(bioguideId: string): string {
  return `${TWITTER_IMAGE_BASE}/${bioguideId}.jpg`;
}

/**
 * onError handler for <img> elements that tries the Twitter fallback
 * before hiding the image and showing the initials placeholder.
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  const src = img.src;

  // If congress.gov failed, try the Twitter fallback
  if (src.includes('congress.gov')) {
    const match = src.match(/\/([a-z]\d{6})_200\.jpg$/i);
    if (match) {
      img.src = getTwitterImageUrl(match[1].toUpperCase());
      return;
    }
  }

  // Twitter also failed (or no bioguide) — hide image, show placeholder
  img.style.display = 'none';
  const sibling = img.nextElementSibling;
  if (sibling) sibling.classList.remove('hidden');
}
