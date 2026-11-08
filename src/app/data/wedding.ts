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
  /** Optional external reference (e.g. similar dress shopping link). */
  readonly referenceUrl?: string;
  readonly referenceLabel?: string;
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
  /** Optional WebP twin of heroPhoto for faster social/mobile loads. */
  readonly heroPhotoWebp?: string;
  readonly envelopePhoto: string;
  /** Optional WebP twin of envelopePhoto for faster first paint. */
  readonly envelopePhotoWebp?: string;
  readonly saveTheDatePhoto: string;
  readonly gallery: readonly string[];
  readonly ceremony: WeddingEvent;
  readonly reception: WeddingEvent;
  readonly weather: string;
  readonly gifts: string;
  /** Optional monetary gift details shown in the Gifts section. */
  readonly monetaryGift: {
    readonly note: string;
    readonly gcashName: string;
    /** Public path to the GCash QR image. */
    readonly qrImage: string;
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
    readonly contacts: readonly {
      readonly name: string;
      readonly label: string;
      readonly url: string;
    }[];
    readonly reservedNote: string;
    /** Adult-only celebration note shown near RSVP. */
    readonly adultsOnlyNote: string;
    /** Named-guests-only note shown near RSVP. */
    readonly namedGuestsNote: string;
    /** Warning modal copy after the guest taps Send RSVP. */
    readonly submitWarning: string;
  };
  readonly entourage: {
    readonly parentsOfGroom: readonly string[];
    readonly parentsOfBride: readonly string[];
    readonly principalSponsors: readonly { readonly gentlemen: string; readonly ladies: string }[];
    readonly bestMan: string;
    readonly maidOfHonor: string;
    readonly secondarySponsors: readonly {
      readonly role: string;
      /** Primary pair (top row, two columns). */
      readonly primary: { readonly left: string; readonly right: string };
      /** Optional second pair (bottom row, two columns). */
      readonly secondary?: { readonly left: string; readonly right: string };
    }[];
    readonly bridalParty: readonly { readonly groomsman: string; readonly bridesmaid: string }[];
    readonly bearers: readonly { readonly role: string; readonly name: string }[];
    readonly flowerGirls: readonly string[];
    readonly littleGroom: string;
    readonly littleBride: string;
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
  heroPhotoWebp: 'images/hero.webp',
  envelopePhoto: 'images/envelope.jpg',
  envelopePhotoWebp: 'images/envelope.webp',
  saveTheDatePhoto: 'images/moments/08.jpg',
  gallery: [
    'images/moments/01.jpg',
    'images/moments/02.jpg',
    'images/moments/03.jpg',
    'images/moments/04.jpg',
    'images/moments/05.jpg',
    'images/moments/06.jpg',
    'images/moments/07.jpg',
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
    note: 'Your presence is the gift we treasure most. If you wish to bless us further, you may send a monetary gift through GCash.',
    gcashName: 'Rowelyn Cachero',
    qrImage: 'images/gcash-qr.jpg',
  },
  hashtags: ['#EDWARDmazingDayWithROWIE'],
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
  rites: [],
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
      { kicker: '', title: 'Little Groom', image: 'images/attire/little-groom.png' },
      { kicker: '', title: 'Little Bride', image: 'images/attire/little-bride.png' },
      { kicker: '', title: 'Junior Groomsmen', image: 'images/attire/groomsmen-kids.png', wide: true },
      {
        kicker: '',
        title: 'Flower Girls',
        image: 'images/attire/flower-girls.png',
        wide: true,
        referenceUrl:
          'https://www.lazada.com.ph/products/3-10-years-kids-christmas-party-dresses-for-girls-appliques-flower-elegant-wedding-dress-with-bow-children-birthday-prom-gown-i4409241929-s24807809565.html',
        referenceLabel: 'View dress reference',
      },
    ],
    swatches: [
      { name: 'Emerald Green', color: 'var(--swatch-emerald)' },
      { name: 'Beige', color: 'var(--swatch-beige)' },
      { name: 'Gold', color: 'var(--swatch-gold)' },
      { name: 'Dark Brown', color: 'var(--swatch-brown)' },
    ],
    note: 'Emerald, beige, gold, and dark brown. Gentlemen in champagne, ladies in emerald — one shared look for each role.',
  },
  rsvp: {
    note: 'Every seat is reserved with love and intention. Kindly confirm your attendance below.',
    deadline: 'November 20, 2026',
    contacts: [
      { name: 'Rowie', label: 'Messenger', url: 'https://m.me/rowelyn.cachero' },
      { name: 'Edward', label: 'Messenger', url: 'https://m.me/edward.pandino' },
    ],
    reservedNote:
      'Only guests with confirmed RSVPs will be accommodated at the celebration. We respectfully ask that you refer to the number of reserved seats indicated in your invitation.',
    adultsOnlyNote:
      'While we love your little ones, we have chosen an adult-only guest list to allow all our guests to relax and celebrate. We hope you understand!',
    namedGuestsNote:
      'We are keeping our celebration small and intimate, so we can only accommodate the guests named directly on each invitation. Thank you for understanding!',
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
      { gentlemen: 'Mr. Marlon B. Cabance', ladies: 'Mrs. Anicia C. Santos' },
      { gentlemen: 'Mr. Almario M. Sandoval', ladies: 'Mrs. Anicia R. Sandoval' },
      { gentlemen: 'Mr. Arcadio E. Sarmiento', ladies: 'Mrs. Aurora E. Sarmiento' },
      { gentlemen: 'Mr. Edgar B. Briones', ladies: 'Mrs. Susan S. Briones' },
      { gentlemen: 'Mr. Evaristo A. Capuno', ladies: 'Mrs. Rowena B. Capuno' },
      { gentlemen: 'Mr. Nicasio D. Buenaobra', ladies: 'Mrs. Herminia A. Buenaobra' },
    ],
    bestMan: 'Mr. Allen A. Mangubat',
    maidOfHonor: 'Mrs. Analyn M. Matibag',
    // Invitation print order: Candle → Veil → Cord
    secondarySponsors: [
      {
        role: 'Candle',
        primary: {
          left: 'Annalyn R. Cachero',
          right: 'Kelvin Zendrix A. Punzalan',
        },
      },
      {
        role: 'Veil',
        primary: {
          left: 'Jennifer C. Salarioza',
          right: 'John Paul P. Aguilar',
        },
        secondary: {
          left: 'Mary Joy R. Cachero',
          right: 'Jheo Aldhi P. Derequito',
        },
      },
      {
        role: 'Cord',
        primary: {
          left: 'Mary Joy L. Develos',
          right: 'Marc Joseph C. Cabance',
        },
        secondary: {
          left: 'Louise Jasmin A. Tacla',
          right: 'Marcreiner Louise P. Dela Rea',
        },
      },
    ],
    bridalParty: [
      {
        groomsman: 'Timothy Clark P. De Castro',
        bridesmaid: 'Mileah Victoria P. Dela Rea',
      },
    ],
    // Invitation print order: Ring → Coin → Bible
    bearers: [
      { role: 'Ring Bearer', name: 'Alwyn Ray C. Lorenzo' },
      { role: 'Coin Bearer', name: 'David Angelo B. Cachero' },
      { role: 'Bible Bearer', name: 'Adam Ray C. Lorenzo' },
    ],
    flowerGirls: [
      'Ma. Madison B. Cachero',
      'Arya Xiela C. Pasague',
    ],
    littleGroom: 'Primo A. Austria',
    littleBride: 'Aliyah Rose C. Lorenzo',
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
  'images/moments/09.jpg': '50% 32%',
  'images/moments/10.jpg': '50% 30%',
  'images/moments/11.jpg': '52% 40%',
  'images/moments/12.jpg': '50% 34%',
};
