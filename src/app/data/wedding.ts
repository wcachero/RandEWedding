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
  readonly landmark: string;
  readonly parking: string;
}

export interface DayBeat {
  readonly time: string;
  readonly title: string;
  readonly detail: string;
}

export interface WeddingRite {
  readonly name: string;
  readonly meaning: string;
}

export interface DressSwatch {
  readonly name: string;
  readonly color: string;
}

export interface DressSide {
  readonly label: string;
  readonly image: string;
}

export interface DressRow {
  readonly kicker: string;
  readonly title: string;
  readonly sides: readonly DressSide[];
}

export interface DressLook {
  readonly kicker: string;
  readonly title: string;
  readonly image: string;
  /** Full-width plate. Pair looks sit two across. */
  readonly wide?: boolean;
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
  readonly weather: string;
  readonly gifts: string;
  /** Optional monetary gift details shown in the Gifts section. */
  readonly monetaryGift: {
    readonly note: string;
    readonly bankName: string;
    readonly accountName: string;
    readonly accountNumber: string;
    readonly gcashName: string;
    readonly gcashNumber: string;
    /** Payload encoded into the mock QR (preview only). */
    readonly qrPayload: string;
  };
  readonly hashtags: readonly string[];
  readonly schedule: readonly DayBeat[];
  readonly rites: readonly WeddingRite[];
  readonly dressCode: {
    readonly title: string;
    readonly rows: readonly DressRow[];
    readonly sponsors: readonly DressLook[];
    readonly party: readonly DressLook[];
    readonly swatches: readonly DressSwatch[];
    readonly note: string;
  };
  readonly rsvp: {
    readonly note: string;
    /** Soft deadline shown on the invitation (e.g. November 15, 2026). */
    readonly deadline: string;
    readonly contacts: readonly { readonly name: string; readonly phone: string }[];
    readonly reservedNote: string;
    /** Warning modal copy after the guest taps Send RSVP. */
    readonly submitWarning: string;
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
  dateShort: '12.05.26',
  dateLong: { month: 'December', monthShort: 'Dec', day: '05', year: '2026', weekday: 'Saturday' },
  ceremonyTime: 'Ceremony',
  heroPhoto: 'images/hero.jpg',
  envelopePhoto: 'images/envelope.jpg',
  saveTheDatePhoto: 'images/moments/08.jpg',
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
    title: 'Nuestra Señora delos Remedios Parish',
    kicker: 'The Ceremony',
    time: '10:00am',
    venue: 'Nuestra Señora delos Remedios Parish',
    address: 'Brgy. Del Remedio, San Pablo City',
    mapQuery: 'Nuestra Señora delos Remedios Parish, Brgy. Del Remedio, San Pablo City, Laguna',
    photo: 'images/church.jpg',
    landmark: 'Brgy. Del Remedio, on the approach into San Pablo City',
    parking: 'Parking is available at the church grounds and along the approach road.',
  },
  reception: {
    title: "Don Alberto's Pavilion",
    kicker: 'The Reception',
    time: 'Lunch to follow',
    venue: "Don Alberto's Pavilion",
    address: 'Brgy. Sta. Maria Magdalena, San Pablo City',
    mapQuery: "Don Alberto's Pavilion, Sta. Maria Magdalena, San Pablo City, Laguna",
    photo: 'images/reception.jpg',
    landmark: 'Brgy. Sta. Maria Magdalena, San Pablo City',
    parking: 'Parking is available at the pavilion.',
  },
  weather:
    'December mornings in San Pablo are typically dry and mild. A light wrap is welcome in the church.',
  gifts:
    'Your presence is the gift we hope for. Should you wish to bless us further, a monetary gift would be warmly received at the reception.',
  monetaryGift: {
    note: 'Your presence is the gift we treasure most. If you wish to bless us further, you may send a monetary gift through the details below.',
    bankName: 'BDO Unibank',
    accountName: 'Edward Cachero / Rowelyn Cachero',
    accountNumber: '0042 7812 3456',
    gcashName: 'Rowelyn Cachero',
    gcashNumber: '0917 555 0101',
    qrPayload: 'MOCK-GIFT|BDO|004278123456|Edward & Rowie Wedding',
  },
  hashtags: [
    '#RandEWedding',
    '#EdwardAndRowie',
    '#RowieAndEdward',
    '#EdwardRowie2026',
    '#EandR1205',
  ],
  schedule: [
    {
      time: '9:30 AM',
      title: 'Guests seated',
      detail: 'Nuestra Señora delos Remedios Parish',
    },
    {
      time: '10:00 AM',
      title: 'Holy Mass',
      detail: 'The ceremony begins',
    },
    {
      time: 'After Mass',
      title: 'Photographs',
      detail: 'A few portraits with family and the entourage',
    },
    {
      time: 'Lunch',
      title: 'Reception',
      detail: "Don Alberto's Pavilion, San Pablo City",
    },
  ],
  rites: [
    { name: 'Candle', meaning: 'The light of faith' },
    { name: 'Veil', meaning: 'Clothed as one' },
    { name: 'Cord', meaning: 'The marriage bond' },
    { name: 'Arrhae', meaning: 'Coins of provision' },
  ],
  dressCode: {
    title: 'Semi-Formal Attire',
    rows: [
      {
        kicker: 'For Everyone',
        title: 'Guests',
        sides: [
          { label: 'Gentlemen', image: 'images/attire/guests-gentlemen.png' },
          { label: 'Ladies', image: 'images/attire/guests-ladies.png' },
        ],
      },
      {
        kicker: 'The Families',
        title: 'Parents',
        sides: [
          { label: 'Gentlemen', image: 'images/attire/parents-gentlemen.png' },
          { label: 'Ladies', image: 'images/attire/parents-ladies.png' },
        ],
      },
    ],
    sponsors: [
      { kicker: '', title: 'Ladies', image: 'images/attire/sponsors-ladies.png' },
      { kicker: '', title: 'Gentlemen', image: 'images/attire/sponsors-gentlemen.png' },
    ],
    party: [
      { kicker: '', title: 'Best Man', image: 'images/attire/best-man.png' },
      { kicker: '', title: 'Maid of Honor', image: 'images/attire/maid-of-honor.png' },
      { kicker: '', title: 'Groomsmen', image: 'images/attire/groomsmen.png', wide: true },
      { kicker: '', title: 'Bridesmaids', image: 'images/attire/bridesmaids.png', wide: true },
      { kicker: '', title: 'Junior Groomsmen', image: 'images/attire/groomsmen-kids.png', wide: true },
      { kicker: '', title: 'Flower Girls', image: 'images/attire/flower-girls.png', wide: true },
    ],
    swatches: [
      { name: 'Emerald Green', color: 'var(--swatch-emerald)' },
      { name: 'Beige', color: 'var(--swatch-beige)' },
      { name: 'Gold', color: 'var(--swatch-gold)' },
      { name: 'Dark Brown', color: 'var(--swatch-brown)' },
    ],
    note: 'Emerald, beige, gold, and dark brown. The wedding party wears one shared look each — champagne for the men, emerald for the women.',
  },
  rsvp: {
    note: 'Every seat is reserved with love and intention. Kindly confirm your attendance below.',
    deadline: 'November 15, 2026',
    contacts: [
      { name: 'Rowelyn', phone: '0917 555 0101' },
      { name: 'Edward', phone: '0918 555 0102' },
    ],
    reservedNote:
      'Only guests with confirmed RSVPs will be accommodated at the celebration. We respectfully ask that you refer to the number of reserved seats indicated in your invitation.',
    /** Shown in the modal after the guest taps Send RSVP. */
    submitWarning:
      'Please note that we can only accommodate guests who have confirmed through this RSVP. Seating is reserved accordingly, and we kindly ask that only confirmed guests attend.',
  },
  entourage: {
    parentsOfGroom: [
      'Mr. Eugenio C. Pandiño',
      'Mrs. Maria Luisita B. Pandiño',
    ],
    parentsOfBride: [
      'Mr. William M. Cachero',
      'Mrs. Rosie R. Cachero',
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
      { role: 'Bible Bearer', name: 'Adam Rey C. Lorenzo' },
      { role: 'Ring Bearer', name: 'Alwyn Rey C. Lorenzo' },
      { role: 'Coin Bearer', name: 'David Angelo B. Cachero' },
    ],
    flowerGirls: [
      'Ma. Madison B. Cachero',
      'Arya Xiela C. Pasague',
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
