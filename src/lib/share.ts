// Builds per-network share deep links. Pure (no DOM): the caller supplies the
// message + URL and decides how to open the result. Networks that cannot accept
// a pre-filled message via URL (Instagram, TikTok) are flagged `copyFirst` so
// the caller can copy the text to the clipboard before opening the app/site.

export type ShareNetwork =
  | 'whatsapp'
  | 'x'
  | 'threads'
  | 'facebook'
  | 'messenger'
  | 'instagram'
  | 'tiktok';

/** Display order for the discreet share bar. */
export const SHARE_NETWORKS: readonly ShareNetwork[] = [
  'whatsapp',
  'x',
  'threads',
  'facebook',
  'messenger',
  'instagram',
  'tiktok',
];

/** Human-readable brand label (same in every locale). */
export const SHARE_LABELS: Record<ShareNetwork, string> = {
  whatsapp: 'WhatsApp',
  x: 'X',
  threads: 'Threads',
  facebook: 'Facebook',
  messenger: 'Messenger',
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

export interface ShareTarget {
  network: ShareNetwork;
  /** URL to open in a new tab (or a native app via custom scheme). */
  href: string;
  /** When true the network has no text intent — copy the message to the
   *  clipboard first so the user can paste it after the app opens. */
  copyFirst: boolean;
}

export function buildShareTarget(
  network: ShareNetwork,
  message: string,
  url: string,
): ShareTarget {
  const text = encodeURIComponent(message);
  const link = encodeURIComponent(url);
  const textAndLink = encodeURIComponent(`${message} ${url}`);
  switch (network) {
    case 'whatsapp':
      return { network, href: `https://wa.me/?text=${textAndLink}`, copyFirst: false };
    case 'x':
      return {
        network,
        href: `https://twitter.com/intent/tweet?text=${text}&url=${link}`,
        copyFirst: false,
      };
    case 'threads':
      return {
        network,
        href: `https://www.threads.net/intent/post?text=${textAndLink}`,
        copyFirst: false,
      };
    case 'facebook':
      return {
        network,
        href: `https://www.facebook.com/sharer/sharer.php?u=${link}&quote=${text}`,
        copyFirst: false,
      };
    case 'messenger':
      // No app id available: use the native Messenger share scheme (mobile).
      return { network, href: `fb-messenger://share/?link=${link}`, copyFirst: false };
    case 'instagram':
      return { network, href: 'https://www.instagram.com/', copyFirst: true };
    case 'tiktok':
      return { network, href: 'https://www.tiktok.com/', copyFirst: true };
  }
}
