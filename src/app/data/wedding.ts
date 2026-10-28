/**
 * All wedding content lives here so the components stay presentational.
 */
export interface WeddingEvent {
  readonly title: string;
  readonly kicker: string;
  readonly time: string;
  readonly venue: string;
  readonly address: string;
  /** Location query used to build the Google Maps embed + link. */
  readonly mapQuery: string;
  /** Optional venue photo (path under /public). Shown only if the file loads. */
  readonly photo?: string;
}

export interface DressSwatch {
  readonly name: string;
  readonly color: string;
}

export interface DressLook {
  readonly kicker: string;
  readonly title: string;
  readonly image: string;
  /** How the source should sit inside its frame. */
  readonly fit?: 'board' | 'cover' | 'contain';
}

export interface Wedding {
  readonly groom: string;
  readonly bride: string;
  readonly monogram: string;
  /** ISO date used for the live countdown. */
  readonly dateIso: string;
  readonly dateShort: string;
  readonly dateLong: { readonly month: string; readonly monthShort: string; readonly day: string; readonly year: string; readonly weekday: string };
  readonly ceremonyTime: string;
  readonly heroPhoto: string;
  readonly envelopePhoto: string;
  readonly saveTheDatePhoto: string;
  readonly gallery: readonly string[];
  readonly ceremony: WeddingEvent;
  readonly reception: WeddingEvent;
  readonly dressCode: {
    readonly title: string;
    readonly boards: readonly DressLook[];
    readonly party: readonly DressLook[];
    readonly swatches: readonly DressSwatch[];
    readonly note: string;
  };
  readonly rsvp: {
    readonly url: string;
    readonly note: string;
    /** Soft deadline shown on the invitation (e.g. November 8, 2026). */
    readonly deadline: string;
    readonly contacts: readonly { readonly name: string; readonly phone: string }[];
    readonly reservedNote: string;
  };
  readonly entourage: {
    readonly parentsOfGroom: readonly string[];
    readonly parentsOfBride: readonly string[];
    readonly principalSponsors: readonly { readonly gentlemen: string; readonly ladies: string }[];
    readonly bestMan: string;
    readonly maidOfHonor: string;
    readonly secondarySponsors: readonly { readonly role: string; readonly pair: string }[];
    readonly bearers: readonly { readonly role: string; readonly name: string }[];
    readonly flowerGirls: readonly string[];
  };
  readonly socials: readonly { readonly label: string; readonly url: string; readonly icon: 'facebook' | 'instagram' | 'tiktok' | 'email' }[];
}

export const WEDDING: Wedding = {
  groom: 'Edward',
  bride: 'Rowie',
  monogram: 'E & R',
  dateIso: '2026-12-05T10:00:00+08:00',
  dateShort: '12.19.26',
  dateLong: { month: 'December', monthShort: 'Dec', day: '05', year: '2026', weekday: 'Saturday' },
  ceremonyTime: 'Ceremony',
  heroPhoto: 'images/hero.jpg',
  envelopePhoto: 'images/envelope.jpg',
  saveTheDatePhoto: 'images/save-the-date.jpg',
  gallery: [
    'images/moments/01.jpg',
    'images/moments/02.jpg',
    'images/moments/03.jpg',
    'images/moments/04.jpg',
    'images/moments/05.jpg',
    'images/moments/06.jpg',
    'images/moments/07.jpg',
    'images/moments/08.jpg',
    'images/moments/09.jpg',
    'images/moments/10.jpg',
    'images/moments/11.jpg',
    'images/moments/12.jpg',
  ],
  ceremony: {
    title: 'San Pablo Cathedral',
    kicker: 'The Ceremony',
    time: '8:30am',
    venue: 'San Pablo Cathedral',
    address: 'A. Mabini Avenue, San Pablo City, Laguna',
    mapQuery: 'San Pablo Cathedral, A. Mabini Avenue, San Pablo City, Laguna',
  },
  reception: {
    title: 'Casa San Pablo Events Hall',
    kicker: 'The Reception',
    time: 'Lunch to follow',
    venue: 'Casa San Pablo Events Hall',
    address: 'Brgy. San Rafael, San Pablo City, Laguna',
    mapQuery: 'San Pablo City, Laguna',
  },
  dressCode: {
    title: 'Semi-Formal Attire',
    boards: [
      { kicker: 'For Everyone', title: 'Guests', image: 'images/attire/guests.jpg', fit: 'board' },
      { kicker: 'The Families', title: 'Parents', image: 'images/attire/parents.jpg', fit: 'board' },
      { kicker: 'Ladies', title: 'Sponsors', image: 'images/attire/sponsors-ladies.jpg', fit: 'board' },
      { kicker: 'Gentlemen', title: 'Sponsors', image: 'images/attire/sponsors-gentlemen.jpg', fit: 'board' },
    ],
    party: [
      { kicker: 'One look', title: 'Best Man', image: 'images/attire/best-man.jpg', fit: 'cover' },
      { kicker: 'One look', title: 'Maid of Honor', image: 'images/attire/maid-of-honor.jpg', fit: 'cover' },
      { kicker: 'The party', title: 'Groomsmen', image: 'images/attire/groomsmen.jpg', fit: 'cover' },
      { kicker: 'The party', title: 'Bridesmaids', image: 'images/attire/bridesmaids.jpg', fit: 'cover' },
    ],
    swatches: [
      { name: 'Emerald Green', color: 'var(--swatch-emerald)' },
      { name: 'Beige', color: 'var(--swatch-beige)' },
      { name: 'Gold', color: 'var(--swatch-gold)' },
      { name: 'Soft Beige', color: 'var(--swatch-soft-beige)' },
      { name: 'Champagne', color: 'var(--swatch-champagne)' },
    ],
    note: 'Emerald, beige, gold, and champagne. The wedding party wears one shared look each — champagne for the men, emerald for the women.',
  },
  rsvp: {
    url: 'https://script.google.com/macros/s/AKfycbzJQmmnqci0N9stgHUoOX-v8p6mzRAyy82rrWXM1H-_45GBf2OdveebLXvxQTR9WKeJ/exec',
    note: 'Every seat is reserved with love and intention. Kindly confirm your attendance below.',
    deadline: 'November 8, 2026',
    contacts: [
      { name: 'Rowelyn', phone: '0917 555 0101' },
      { name: 'Edward', phone: '0918 555 0102' },
    ],
    reservedNote:
      'Only guests with confirmed RSVPs will be accommodated at the celebration. We respectfully ask that you refer to the number of reserved seats indicated in your invitation.',
  },
  entourage: {
    parentsOfGroom: [
      'Mr. Hiro Meow',
      'Mrs. Hana Meow',
    ],
    parentsOfBride: [
      'Mr. Kenji Meow',
      'Mrs. Kiko Meow',
    ],
    principalSponsors: [
      { gentlemen: 'Mr. Luna Meow', ladies: 'Mrs. Lila Meow' },
      { gentlemen: 'Mr. Nori Meow', ladies: 'Mrs. Nami Meow' },
      { gentlemen: 'Mr. Sora Meow', ladies: 'Mrs. Suki Meow' },
      { gentlemen: 'Mr. Taro Meow', ladies: 'Mrs. Tami Meow' },
    ],
    bestMan: 'Mr. Mio Meow',
    maidOfHonor: 'Ms. Miho the Meow',
    secondarySponsors: [
      { role: 'Candle', pair: 'Mr. Coco Meow & Ms. Cali Meow' },
      { role: 'Cord', pair: 'Mr. Pino Meow & Ms. Pika Meow' },
      { role: 'Veil', pair: 'Mr. Vito Meow & Ms. Vita Meow' },
    ],
    bearers: [
      { role: 'Ring Bearer', name: 'Mini Meow' },
      { role: 'Coin Bearer', name: 'Mochi Meow' },
      { role: 'Bible Bearer', name: 'Bean Meow' },
    ],
    flowerGirls: [
      'Mimi Meow',
      'Momo Meow',
    ],
  },
  socials: [
    { label: 'Facebook', url: 'https://facebook.com/wcachero', icon: 'facebook' },
    { label: 'Instagram', url: '#', icon: 'instagram' },   // add real link when available
    { label: 'TikTok', url: 'https://www.tiktok.com/@gw.moments', icon: 'tiktok' },
    { label: 'Email', url: 'mailto:hello@example.com', icon: 'email' },
  ],
};

/** Keeps faces in the short gallery tiles when face detection is unavailable. */
export const GALLERY_FOCUS: Readonly<Record<string, string>> = {
  'images/moments/01.jpg': '50% 36%',
  'images/moments/02.jpg': '50% 42%',
  'images/moments/03.jpg': '50% 34%',
  'images/moments/04.jpg': '48% 58%',
  'images/moments/05.jpg': '50% 32%',
  'images/moments/06.jpg': '50% 16%',
  'images/moments/07.jpg': '46% 42%',
  'images/moments/08.jpg': '50% 34%',
  'images/moments/09.jpg': '50% 32%',
  'images/moments/10.jpg': '50% 30%',
  'images/moments/11.jpg': '52% 40%',
  'images/moments/12.jpg': '50% 34%',
};
