import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import QRCode from 'qrcode';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { GALLERY_FOCUS, WEDDING, WeddingEvent } from '../../data/wedding';
import { readGuestInvite } from '../../data/invite-guest';
import { Reveal } from '../../directives/reveal';
import { Parallax } from '../../directives/parallax';
import { GuestSearchHit, RsvpApi } from '../../services/rsvp-api';

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  passed: boolean;
}

interface EventView extends WeddingEvent {
  readonly mapEmbed: SafeResourceUrl;
  readonly mapLink: string;
}

/**
 * The full-width wedding invitation shown after the envelope is opened.
 * Presentational content comes from the WEDDING data model; this class drives
 * the live countdown, the map URLs and the photo lightbox.
 */
@Component({
  selector: 'app-wedding-invitation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Reveal, Parallax],
  templateUrl: './wedding-invitation.html',
  styleUrl: './wedding-invitation.scss',
})
export class WeddingInvitation {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly rsvpApi = inject(RsvpApi);
  protected readonly wedding = WEDDING;

  /** Same mark as `.nav__logo`, burned into the centre of the QR at a scan-safe size. */

  protected readonly ceremony = this.toEventView(WEDDING.ceremony);
  protected readonly reception = this.toEventView(WEDDING.reception);

  /** RSVP form — guest-list search + submit. */
  protected readonly rsvpQuery = signal('');
  protected readonly rsvpHits = signal<GuestSearchHit[]>([]);
  protected readonly rsvpSearching = signal(false);
  protected readonly rsvpSuggestOpen = signal(false);
  protected readonly rsvpSelectedId = signal<number | null>(null);
  protected readonly rsvpSelectedName = signal('');
  protected readonly rsvpAttend = signal<'yes' | 'no' | null>(null);
  protected readonly rsvpMessage = signal('');
  protected readonly rsvpCompanionSlots = signal<string[]>([]);
  protected readonly rsvpError = signal('');
  protected readonly rsvpSubmitting = signal(false);
  protected readonly rsvpSent = signal(false);
  protected readonly rsvpWarningOpen = signal(false);
  private readonly rsvpSearch$ = new Subject<string>();

  /** Guest personalization from the invite link (?to=&seats=). */
  protected readonly guestName = signal('');
  protected readonly reservedSeats = signal<number | null>(null);
  protected readonly hashtagCopied = signal('');
  protected readonly giftQrDataUrl = signal<string | null>(null);
  protected readonly giftQrDownloading = signal(false);
  protected readonly giftAccountCopied = signal(false);
  private giftAccountCopiedTimer: ReturnType<typeof setTimeout> | null = null;

  /** Current time, ticked every second to drive the countdown. */
  private readonly now = signal(Date.now());

  protected readonly countdown = computed<Countdown>(() => {
    const diff = new Date(this.wedding.dateIso).getTime() - this.now();
    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true };
    }
    const s = Math.floor(diff / 1000);
    return {
      days: Math.floor(s / 86400),
      hours: Math.floor((s % 86400) / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60,
      passed: false,
    };
  });

  /** Mobile nav (hamburger) open state. */
  protected readonly menuOpen = signal(false);

  /** True while the guest is scrolling down — bar slides away until idle or scroll-up. */
  protected readonly navHidden = signal(false);

  /** 0–1 reading progress, painted as the gold line under the nav. */
  protected readonly scrollProgress = signal(0);

  /** Section id currently in view, used to mark the nav link. */
  protected readonly activeSection = signal('top');

  /** Whether the full metro tile album is expanded. */
  protected readonly galleryExpanded = signal(false);
  private readonly galleryPreviewCount = 8;

  protected readonly gallerySlides = computed(() => {
    const all = this.wedding.gallery;
    if (this.galleryExpanded()) {
      return all;
    }
    return all.slice(0, this.galleryPreviewCount);
  });

  protected readonly galleryHasMore = computed(
    () => !this.galleryExpanded() && this.wedding.gallery.length > this.galleryPreviewCount,
  );

  protected readonly galleryCanCollapse = computed(() => this.galleryExpanded());

  /** Per-photo object-position, filled when faces can be detected. */
  private readonly galleryFocus = signal<ReadonlyMap<string, string>>(new Map());

  /** Photos whose tile image has finished loading (or failed). */
  private readonly galleryLoaded = signal<ReadonlySet<string>>(new Set());

  protected galleryImageReady(photo: string): boolean {
    return this.galleryLoaded().has(photo);
  }

  protected galleryObjectPosition(photo: string): string {
    return this.galleryFocus().get(photo) ?? GALLERY_FOCUS[photo] ?? 'center 32%';
  }

  protected onGalleryImageLoad(photo: string, event: Event): void {
    this.markGalleryLoaded(photo);
    void this.focusGalleryPerson(photo, event.target as HTMLImageElement);
  }

  protected onGalleryImageError(photo: string): void {
    this.markGalleryLoaded(photo);
  }

  private markGalleryLoaded(photo: string): void {
    if (this.galleryLoaded().has(photo)) {
      return;
    }
    this.galleryLoaded.update((set) => new Set(set).add(photo));
  }

  /** Mark tiles already in browser cache so skeletons clear immediately. */
  private hydrateGalleryImageStates(): void {
    const imgs = this.host.nativeElement.querySelectorAll(
      '.gallery__tile img',
    ) as NodeListOf<HTMLImageElement>;
    imgs.forEach((img) => {
      if (!img.complete || img.naturalWidth <= 0) {
        return;
      }
      const photo = img.getAttribute('src');
      if (photo) {
        this.markGalleryLoaded(photo);
      }
    });
  }

  private async focusGalleryPerson(photo: string, img: HTMLImageElement): Promise<void> {
    if (this.galleryFocus().has(photo)) {
      return;
    }
    const FaceDetectorCtor = (
      window as Window & {
        FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
          detect(image: HTMLImageElement): Promise<readonly { boundingBox: DOMRectReadOnly }[]>;
        };
      }
    ).FaceDetector;
    if (!FaceDetectorCtor) {
      return;
    }
    try {
      const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 4 });
      const faces = await detector.detect(img);
      if (!faces.length || !img.naturalWidth || !img.naturalHeight) {
        return;
      }

      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const face of faces) {
        const box = face.boundingBox;
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.width);
        maxY = Math.max(maxY, box.y + box.height);
      }

      const cx = (((minX + maxX) / 2) / img.naturalWidth) * 100;
      // Bias a little above face center so hairline/forehead stays in frame.
      const cy = Math.max(8, (((minY + maxY) / 2) / img.naturalHeight) * 100 - 6);
      const position = `${cx.toFixed(1)}% ${cy.toFixed(1)}%`;
      this.galleryFocus.update((map) => new Map(map).set(photo, position));
    } catch {
      /* Keep the CSS person-biased fallback. */
    }
  }

  protected expandGallery(): void {
    this.galleryExpanded.set(true);
    afterNextRender(() => this.hydrateGalleryImageStates(), { injector: this.injector });
  }

  protected collapseGallery(): void {
    this.galleryExpanded.set(false);
  }

  private pointerX = 0;
  private pointerY = 0;
  private skipLightboxClose = false;

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
  }

  protected openGalleryPhoto(photo: string): void {
    this.openLightbox(photo);
  }

  protected readonly lightboxCanBrowse = computed(() => {
    const photo = this.lightboxPhoto();
    return !!photo && this.wedding.gallery.includes(photo) && this.wedding.gallery.length > 1;
  });

  protected lightboxPrev(): void {
    const i = this.wedding.gallery.indexOf(this.lightboxPhoto() ?? '');
    if (i < 0) {
      return;
    }
    const n = this.wedding.gallery.length;
    this.resetLightboxZoom();
    this.lightboxPhoto.set(this.wedding.gallery[(i - 1 + n) % n]);
  }

  protected lightboxNext(): void {
    const i = this.wedding.gallery.indexOf(this.lightboxPhoto() ?? '');
    if (i < 0) {
      return;
    }
    const n = this.wedding.gallery.length;
    this.resetLightboxZoom();
    this.lightboxPhoto.set(this.wedding.gallery[(i + 1) % n]);
  }

  protected onLightboxPointerUp(event: PointerEvent): void {
    if (this.lightboxZoom() > 1) {
      return;
    }
    if (!this.lightboxCanBrowse()) {
      return;
    }
    const dir = this.swipeDirection(event);
    if (!dir) {
      return;
    }
    this.skipLightboxClose = true;
    if (dir === 'left') {
      this.lightboxNext();
    } else {
      this.lightboxPrev();
    }
  }

  protected onLightboxBackdropClick(): void {
    if (this.skipLightboxClose) {
      this.skipLightboxClose = false;
      return;
    }
    this.closeLightbox();
  }

  private swipeDirection(event: PointerEvent): 'left' | 'right' | null {
    const dx = event.clientX - this.pointerX;
    const dy = event.clientY - this.pointerY;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.15) {
      return null;
    }
    return dx < 0 ? 'left' : 'right';
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKey(event: KeyboardEvent): void {
    if (!this.lightboxPhoto()) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      this.lightboxPrev();
    } else if (event.key === 'ArrowRight') {
      this.lightboxNext();
    } else if (event.key === 'Escape') {
      this.closeLightbox();
    }
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => {
      if (!open) {
        this.navHidden.set(false);
      }
      return !open;
    });
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected downloadFromMenu(): void {
    this.closeMenu();
    void this.downloadInvitationImage();
  }

  /** Public URL of this invitation, resolved in the browser. */
  protected readonly shareUrl = signal('');

  /** Data-URL of the generated QR code (null until rendered in the browser). */
  protected readonly qrDataUrl = signal<string | null>(null);

  /** Whether the enlarged QR modal is open. */
  protected readonly qrOpen = signal(false);

  /** Rolling hint under the Share tile ("Tap to share" → "Link copied!"). */
  protected readonly shareHint = signal('Tap to share');

  /** Whether the share chooser is open, and whether the link was just copied. */
  protected readonly shareOpen = signal(false);
  protected readonly copied = signal(false);
  /** True when the browser exposes the native share sheet. */
  protected readonly canNativeShare = signal(false);

  /** Social share links, built from the resolved page URL. */
  protected readonly messengerShareUrl = computed(() => {
    const link = encodeURIComponent(this.shareUrl());
    return `fb-messenger://share/?link=${link}`;
  });
  protected readonly waShareUrl = computed(
    () => `https://wa.me/?text=${encodeURIComponent("You're invited! " + this.shareUrl())}`,
  );

  /** Venue map currently open in the modal, or null when closed. */
  protected readonly activeMap = signal<{
    name: string;
    embed: SafeResourceUrl;
    link: string;
  } | null>(null);

  /** Photo currently open in the lightbox, or null when closed. */
  protected readonly lightboxPhoto = signal<string | null>(null);

  protected readonly lightboxZoom = signal(1);
  private readonly lightboxPan = signal({ x: 0, y: 0 });
  private lightboxPanning = false;
  private lightboxPanStart = { x: 0, y: 0, panX: 0, panY: 0 };
  private lightboxDidPan = false;

  protected readonly lightboxImageTransform = computed(() => {
    const z = this.lightboxZoom();
    const { x, y } = this.lightboxPan();
    return `translate(${x}px, ${y}px) scale(${z})`;
  });

  protected toggleLightboxZoom(event?: Event): void {
    event?.stopPropagation();
    if (this.lightboxZoom() > 1) {
      this.resetLightboxZoom();
    } else {
      this.lightboxZoom.set(2.5);
    }
  }

  protected onLightboxImageTap(event: MouseEvent): void {
    event.stopPropagation();
    if (this.skipLightboxClose) {
      this.skipLightboxClose = false;
      return;
    }
    if (this.lightboxDidPan) {
      this.lightboxDidPan = false;
      return;
    }
    this.toggleLightboxZoom();
  }

  protected onLightboxImagePointerDown(event: PointerEvent): void {
    if (this.lightboxZoom() > 1) {
      event.stopPropagation();
      this.lightboxPanning = true;
      const pan = this.lightboxPan();
      this.lightboxPanStart = {
        x: event.clientX,
        y: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      return;
    }
    this.onPointerDown(event);
  }

  protected onLightboxImagePointerMove(event: PointerEvent): void {
    if (!this.lightboxPanning) {
      return;
    }
    event.stopPropagation();
    const dx = event.clientX - this.lightboxPanStart.x;
    const dy = event.clientY - this.lightboxPanStart.y;
    if (Math.hypot(dx, dy) > 8) {
      this.lightboxDidPan = true;
    }
    this.lightboxPan.set({
      x: this.lightboxPanStart.panX + dx,
      y: this.lightboxPanStart.panY + dy,
    });
  }

  protected onLightboxImagePointerUp(event: PointerEvent): void {
    if (this.lightboxPanning) {
      this.lightboxPanning = false;
      try {
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      return;
    }
    this.onLightboxPointerUp(event);
  }

  private resetLightboxZoom(): void {
    this.lightboxZoom.set(1);
    this.lightboxPan.set({ x: 0, y: 0 });
    this.lightboxPanning = false;
  }

  /** Venue photos that failed to load, so their <img> can be hidden. */
  protected readonly failedPhotos = signal<ReadonlySet<string>>(new Set());

  protected onPhotoError(photo: string): void {
    this.failedPhotos.update((set) => new Set(set).add(photo));
  }

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(id));

    this.rsvpSearch$
      .pipe(
        debounceTime(280),
        distinctUntilChanged(),
        tap((q) => {
          if (q.trim().length < 1) {
            this.rsvpHits.set([]);
            this.rsvpSearching.set(false);
          } else {
            this.rsvpSearching.set(true);
          }
        }),
        switchMap((q) => {
          const query = q.trim();
          if (query.length < 1) return of({ guests: [] as GuestSearchHit[] });
          return this.rsvpApi.searchGuests(query).pipe(
            catchError(() => of({ guests: [] as GuestSearchHit[] })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.rsvpHits.set(res.guests);
        this.rsvpSearching.set(false);
      });

    // Resolve the live URL and render the QR code only in the browser
    // (window is unavailable during prerendering).
    afterNextRender(() => {
      this.setupAutoHideNav();
      this.hydrateGalleryImageStates();
      this.setupRsvpDeadlineNotice();

      const url = `${window.location.origin}/`;
      this.shareUrl.set(url);
      this.canNativeShare.set(typeof navigator !== 'undefined' && !!navigator.share);
      this.buildBrandedQrDataUrl(url)
        .then((data) => this.qrDataUrl.set(data))
        .catch(() => this.qrDataUrl.set(null));

      QRCode.toDataURL(this.wedding.monetaryGift.qrPayload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 280,
        color: { dark: '#0e3d32', light: '#fbfaf6' },
      })
        .then((data) => this.giftQrDataUrl.set(data))
        .catch(() => this.giftQrDataUrl.set(null));

      // Opened from Messenger's "Open in Chrome" so a real tap can save the file.
      const guest = readGuestInvite(window.location.search);
      this.guestName.set(guest.name);
      this.reservedSeats.set(guest.seats);

      const save = new URLSearchParams(window.location.search).get('save');
      if ((save === 'invite' || save === 'qr') && !this.isRestrictedInAppBrowser()) {
        this.chromeSaveKind.set(save);
        const clean = new URL(window.location.href);
        clean.searchParams.delete('save');
        history.replaceState({}, '', `${clean.pathname}${clean.search}${clean.hash}`);
        void this.prepareChromeSave(save);
      }
    });
  }

  protected onRsvpQuery(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.rsvpQuery.set(value);
    this.rsvpSuggestOpen.set(true);
    if (this.rsvpSelectedId()) {
      this.rsvpSelectedId.set(null);
      this.rsvpSelectedName.set('');
      this.rsvpAttend.set(null);
      this.rsvpCompanionSlots.set([]);
      this.rsvpSent.set(false);
    }
    this.rsvpSearch$.next(value);
  }

  protected selectRsvpGuest(hit: GuestSearchHit, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    this.rsvpSelectedId.set(hit.id);
    this.rsvpSelectedName.set(hit.name);
    this.rsvpQuery.set(hit.name);
    this.rsvpHits.set([]);
    this.rsvpSuggestOpen.set(false);
    this.rsvpError.set('');
    this.rsvpSent.set(false);
    this.rsvpCompanionSlots.set(Array.from({ length: Math.max(0, hit.companionCount) }, () => ''));
    if (hit.responded && hit.joyfullyAccept != null) {
      this.rsvpAttend.set(hit.joyfullyAccept ? 'yes' : 'no');
    } else {
      this.rsvpAttend.set(null);
    }

    queueMicrotask(() => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      this.focusRsvpReply();
      window.setTimeout(() => this.focusRsvpReply(), 160);
      window.setTimeout(() => this.focusRsvpReply(), 360);
    });

    this.rsvpApi.getGuest(hit.id).subscribe({
      next: ({ guest }) => {
        this.rsvpMessage.set(guest.message || '');
        if (guest.joyfullyAccept != null) {
          this.rsvpAttend.set(guest.joyfullyAccept ? 'yes' : 'no');
        }
        const slots = Array.from({ length: Math.max(0, guest.companionCount) }, (_, i) =>
          guest.companions[i]?.name || '',
        );
        this.rsvpCompanionSlots.set(slots);
        this.focusRsvpReply();
      },
      error: () => undefined,
    });
  }

  /** Keep the RSVP reply controls in view after a guest is chosen (esp. mobile). */
  private focusRsvpReply(): void {
    if (typeof document === 'undefined') return;
    document.getElementById('rsvp-reply')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }

  protected clearRsvpSelection(): void {
    this.rsvpSelectedId.set(null);
    this.rsvpSelectedName.set('');
    this.rsvpAttend.set(null);
    this.rsvpMessage.set('');
    this.rsvpCompanionSlots.set([]);
    this.rsvpError.set('');
    this.rsvpSent.set(false);
    this.rsvpSuggestOpen.set(true);
    this.rsvpSearch$.next(this.rsvpQuery());
  }

  protected setRsvpAttend(value: 'yes' | 'no'): void {
    this.rsvpAttend.set(value);
  }

  protected onRsvpMessage(event: Event): void {
    this.rsvpMessage.set((event.target as HTMLTextAreaElement).value);
  }

  protected onCompanionName(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.rsvpCompanionSlots.update((slots) => {
      const next = slots.slice();
      next[index] = value;
      return next;
    });
  }

  protected submitRsvp(event: Event): void {
    event.preventDefault();
    const guestId = this.rsvpSelectedId();
    const attend = this.rsvpAttend();
    if (!guestId || !attend) {
      this.rsvpError.set('Please choose your name and attendance.');
      return;
    }
    this.rsvpError.set('');
    this.rsvpWarningOpen.set(true);
  }

  protected dismissRsvpWarning(): void {
    if (this.rsvpSubmitting()) return;
    this.rsvpWarningOpen.set(false);
  }

  protected confirmRsvpWarning(): void {
    const guestId = this.rsvpSelectedId();
    const attend = this.rsvpAttend();
    if (!guestId || !attend) {
      this.rsvpWarningOpen.set(false);
      this.rsvpError.set('Please choose your name and attendance.');
      return;
    }
    this.rsvpSubmitting.set(true);
    this.rsvpError.set('');
    this.rsvpApi
      .submitRsvp({
        guestId,
        joyfullyAccept: attend === 'yes',
        message: this.rsvpMessage().trim() || undefined,
        companions: this.rsvpCompanionSlots().map((name) => ({ name: name.trim() || null })),
      })
      .subscribe({
        next: () => {
          this.rsvpSubmitting.set(false);
          this.rsvpWarningOpen.set(false);
          this.rsvpSent.set(true);
        },
        error: (err) => {
          this.rsvpSubmitting.set(false);
          this.rsvpWarningOpen.set(false);
          this.rsvpError.set(err?.error?.error || 'Could not send your RSVP. Please try again.');
        },
      });
  }

  protected resetRsvp(): void {
    this.rsvpSent.set(false);
    this.rsvpWarningOpen.set(false);
  }

  /** Bottom-of-page RSVP deadline warning — shown once per visit. */
  protected readonly rsvpDeadlineOpen = signal(false);
  private static readonly RSVP_NOTICE_KEY = 'gk-rsvp-deadline-seen';
  private rsvpNoticeScrollY = 0;
  /** True only while this notice is holding overflow. Closing must not move scroll. */
  private rsvpNoticeScrollFrozen = false;

  protected dismissRsvpDeadline(): void {
    this.rsvpDeadlineOpen.set(false);
    this.releaseRsvpNoticeScroll();
    try {
      sessionStorage.setItem(WeddingInvitation.RSVP_NOTICE_KEY, '1');
    } catch {
      /* private mode / blocked storage */
    }
  }

  protected goToRsvpFromNotice(): void {
    this.dismissRsvpDeadline();
    queueMicrotask(() => {
      document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /** Open the deadline notice the first time the guest reaches the invitation end. */
  private setupRsvpDeadlineNotice(): void {
    try {
      if (sessionStorage.getItem(WeddingInvitation.RSVP_NOTICE_KEY) === '1') {
        return;
      }
    } catch {
      /* continue without persistence */
    }

    const end = this.host.nativeElement.querySelector('.invite__end') as HTMLElement | null;
    if (!end || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) {
          return;
        }
        this.rsvpDeadlineOpen.set(true);
        this.freezeRsvpNoticeScroll();
        observer.disconnect();
      },
      { root: null, threshold: 0.35 },
    );

    observer.observe(end);
    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      if (this.rsvpDeadlineOpen()) {
        this.releaseRsvpNoticeScroll();
      }
    });
  }

  /**
   * Block background scrolling while the notice is open.
   * Do not toggle overflow or position: those change scroll height and move the page on close.
   */
  private freezeRsvpNoticeScroll(): void {
    if (this.rsvpNoticeScrollFrozen) {
      return;
    }
    this.rsvpNoticeScrollFrozen = true;
    window.addEventListener('wheel', this.blockRsvpNoticeScroll, { passive: false });
    window.addEventListener('touchmove', this.blockRsvpNoticeScroll, { passive: false });
    window.addEventListener('keydown', this.blockRsvpNoticeKeys);
  }

  private releaseRsvpNoticeScroll(): void {
    if (!this.rsvpNoticeScrollFrozen) {
      return;
    }
    this.rsvpNoticeScrollFrozen = false;
    window.removeEventListener('wheel', this.blockRsvpNoticeScroll);
    window.removeEventListener('touchmove', this.blockRsvpNoticeScroll);
    window.removeEventListener('keydown', this.blockRsvpNoticeKeys);
  }

  private readonly blockRsvpNoticeScroll = (event: Event): void => {
    event.preventDefault();
  };

  private readonly blockRsvpNoticeKeys = (event: KeyboardEvent): void => {
    if ([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
    }
  };

  /** Freeze page scroll while the RSVP notice overlay is open (incl. iOS). */
  private lockBackgroundScroll(): void {
    this.rsvpNoticeScrollY = window.scrollY;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${this.rsvpNoticeScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }

  private unlockBackgroundScroll(): void {
    const body = document.body;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overflow = '';
    document.documentElement.style.overflow = '';
    window.scrollTo({ top: this.rsvpNoticeScrollY, left: 0, behavior: 'auto' });
  }

  /** QR with a compact E&R monogram drawn in the centre (high error correction). */
  private async buildBrandedQrDataUrl(url: string): Promise<string> {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    const qrData = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 640,
      color: { dark: '#0e3d32', light: '#ffffff' },
    });
    return this.compositeQrMonogram(qrData);
  }

  private compositeQrMonogram(qrDataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const qr = new Image();
      qr.onload = () => {
        const size = qr.width;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(qrDataUrl);
          return;
        }
        ctx.drawImage(qr, 0, 0);

        const cx = size / 2;
        const cy = size / 2;
        const badgeR = size * 0.1;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, badgeR + 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, badgeR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0e3d32';
        ctx.font = '700 36px Cinzel, Georgia, serif';
        ctx.fillText('E & R', cx, cy + 1);

        resolve(canvas.toDataURL('image/png'));
      };
      qr.onerror = () => resolve(qrDataUrl);
      qr.src = qrDataUrl;
    });
  }

  protected openQr(): void {
    this.qrOpen.set(true);
  }

  protected closeQr(): void {
    this.qrOpen.set(false);
  }

  /** True while the themed QR card PNG is being composed for download. */
  protected readonly qrDownloading = signal(false);

  /** True while the invitation keepake image is being composed. */
  protected readonly inviteDownloading = signal(false);

  /** Preview shown when in-app browsers (Messenger, etc.) block direct downloads. */
  protected readonly invitePreviewUrl = signal<string | null>(null);
  protected readonly invitePreviewBlobUrl = signal<string | null>(null);
  protected readonly invitePreviewFilename = signal('wedding-invitation.jpg');
  /** Android Messenger blocks <a download> and long-press save. */
  protected readonly invitePreviewIsMessenger = signal(false);
  /** Set when Messenger rejects the share sheet so we point guests to Chrome. */
  protected readonly inviteSaveBlocked = signal(false);
  /** Chrome opened with ?save= so one tap can download outside Messenger. */
  protected readonly chromeSaveKind = signal<'invite' | 'qr' | null>(null);
  /** True while any full-screen overlay is open so chrome can step aside. */
  protected readonly overlayOpen = computed(
    () => this.qrOpen() || !!this.lightboxPhoto() || !!this.activeMap() || !!this.chromeSaveKind(),
  );
  protected readonly chromeSaveReady = signal(false);
  private chromeSaveDataUrl: string | null = null;
  private chromeSaveFilename = '';
  private invitePreviewFile: File | null = null;

  protected async downloadInvitationImage(): Promise<void> {
    if (this.inviteDownloading()) {
      return;
    }
    this.inviteDownloading.set(true);
    try {
      // Slightly smaller JPEG helps Android Messenger share/download succeed.
      const dataUrl = await this.buildInvitationKeepsake('image/jpeg', 0.82);
      const filename = `${this.wedding.groom.toLowerCase()}-${this.wedding.bride.toLowerCase()}-wedding-invitation.jpg`;
      await this.saveOrShareImage(
        dataUrl,
        filename,
        `${this.wedding.groom} & ${this.wedding.bride} Wedding Invitation`,
      );
    } catch {
      /* keep the page usable if canvas/fonts fail */
    } finally {
      this.inviteDownloading.set(false);
    }
  }

  protected closeInvitePreview(): void {
    this.revokePreviewBlob();
    this.invitePreviewUrl.set(null);
    this.inviteSaveBlocked.set(false);
    this.invitePreviewIsMessenger.set(false);
    this.unlockBackgroundScroll();
  }

  /**
   * Called from a fresh tap. The file is already built, so share() stays
   * inside the user gesture — required for Android Messenger's share sheet.
   */
  protected saveInvitePreview(): void {
    const file = this.invitePreviewFile;
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };
    if (!file || !nav.share) {
      this.inviteSaveBlocked.set(true);
      return;
    }
    const title = this.invitePreviewShareTitle();
    void nav
      .share({ files: [file], title, text: title })
      .then(() => this.closeInvitePreview())
      .catch((err: Error) => {
        if (err?.name === 'AbortError') {
          return;
        }
        this.inviteSaveBlocked.set(true);
      });
  }

  /** Leave Messenger and reopen this page in Chrome, where downloads work. */
  protected openSaveInChrome(): void {
    const kind = this.invitePreviewFilename().includes('-qr') ? 'qr' : 'invite';
    const url = new URL(window.location.href);
    url.searchParams.set('save', kind);
    url.hash = '';
    const httpsUrl = url.toString();
    if (!/^https:/i.test(httpsUrl)) {
      this.inviteSaveBlocked.set(true);
      return;
    }
    const withoutScheme = httpsUrl.replace(/^https:\/\//, '');
    window.location.href =
      `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;` +
      `S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`;
  }

  /** One tap in Chrome (after the Messenger handoff) actually saves the file. */
  protected confirmChromeSave(): void {
    const dataUrl = this.chromeSaveDataUrl;
    const filename = this.chromeSaveFilename;
    if (!dataUrl || !filename) {
      return;
    }
    // Must run synchronously in this tap — Chrome blocks downloads after an await.
    this.triggerDataUrlDownload(dataUrl, filename);
    this.chromeSaveKind.set(null);
    this.chromeSaveReady.set(false);
  }

  private async prepareChromeSave(kind: 'invite' | 'qr'): Promise<void> {
    try {
      if (kind === 'qr') {
        let qr = this.qrDataUrl();
        for (let i = 0; i < 30 && !qr; i++) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          qr = this.qrDataUrl();
        }
        if (!qr) {
          return;
        }
        this.chromeSaveDataUrl = await this.buildDownloadableQrCard(qr);
        this.chromeSaveFilename = `${this.wedding.groom.toLowerCase()}-${this.wedding.bride.toLowerCase()}-wedding-invitation-qr.jpg`;
      } else {
        this.chromeSaveDataUrl = await this.buildInvitationKeepsake('image/jpeg', 0.82);
        this.chromeSaveFilename = `${this.wedding.groom.toLowerCase()}-${this.wedding.bride.toLowerCase()}-wedding-invitation.jpg`;
      }
      this.chromeSaveReady.set(true);
    } catch {
      this.chromeSaveReady.set(false);
    }
  }

  /**
   * Save/share an image in a way that works on desktop, iOS, Android, and
   * in-app browsers like Messenger (where `<a download>` is often ignored).
   */
  private async saveOrShareImage(
    dataUrl: string,
    filename: string,
    title: string,
  ): Promise<void> {
    const restricted = this.isRestrictedInAppBrowser();

    // Messenger Android ignores <a download> and drops the gesture during canvas
    // work. Show the image first; Save / Open in Chrome run on a new tap.
    if (this.isAndroidMessenger()) {
      await this.openImagePreview(dataUrl, filename);
      return;
    }

    const shared = await this.tryNativeImageShare(dataUrl, filename, title, {
      skipCanShareCheck: restricted,
    });
    if (shared) {
      return;
    }

    if (!restricted) {
      this.triggerDataUrlDownload(dataUrl, filename);
      return;
    }

    await this.openImagePreview(dataUrl, filename);
  }

  private async openImagePreview(dataUrl: string, filename: string): Promise<void> {
    this.revokePreviewBlob();
    const file = await this.dataUrlToFile(dataUrl, filename);
    this.invitePreviewFile = file;
    this.invitePreviewBlobUrl.set(URL.createObjectURL(file));
    this.invitePreviewFilename.set(filename);
    this.invitePreviewIsMessenger.set(this.isAndroidMessenger());
    this.inviteSaveBlocked.set(false);
    this.invitePreviewUrl.set(dataUrl);
    this.lockBackgroundScroll();
  }

  private revokePreviewBlob(): void {
    const url = this.invitePreviewBlobUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.invitePreviewBlobUrl.set(null);
    this.invitePreviewFile = null;
  }

  private invitePreviewShareTitle(): string {
    const who = `${this.wedding.groom} & ${this.wedding.bride}`;
    return this.invitePreviewFilename().includes('-qr') ? `${who} Wedding QR` : `${who} Wedding Invitation`;
  }

  private isAndroidMessenger(): boolean {
    const ua = navigator.userAgent || '';
    // Messenger's Android webview reports FB_IAB / FBAV (sometimes "Orca"), not "Messenger".
    return /Android/i.test(ua) && /FBAN|FBAV|FB_IAB|FB4A|Messenger|Orca/i.test(ua);
  }

  private async tryNativeImageShare(
    dataUrl: string,
    filename: string,
    title: string,
    opts: { skipCanShareCheck?: boolean } = {},
  ): Promise<boolean> {
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data: ShareData) => boolean;
    };
    if (!nav.share) {
      return false;
    }

    try {
      const file = await this.dataUrlToFile(dataUrl, filename);
      const fileShare: ShareData = { files: [file], title, text: title };
      if (!opts.skipCanShareCheck && nav.canShare && !nav.canShare(fileShare)) {
        return false;
      }
      await nav.share(fileShare);
      return true;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return true; // user cancelled — treat as handled
      }
    }

    return false;
  }

  private triggerDataUrlDownload(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.rel = 'noopener';
    // Some Android WebViews need the node in the DOM + a real click.
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private isRestrictedInAppBrowser(): boolean {
    const ua = navigator.userAgent || '';
    return /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Line\/|Twitter|TikTok|BytedanceWebview|MicroMessenger/i.test(
      ua,
    );
  }

  private async dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const type =
      blob.type ||
      (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')
        ? 'image/jpeg'
        : 'image/png');
    return new File([blob], filename, { type });
  }

  /** Classic wedding invitation artwork including details + entourage. */
  private async buildInvitationKeepsake(
    mimeType: 'image/png' | 'image/jpeg' = 'image/jpeg',
    quality = 0.88,
  ): Promise<string> {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const width = 1080;
    const height = 3200;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas unavailable');
    }

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#f4ead8');
    bg.addColorStop(0.35, '#fbf6ec');
    bg.addColorStop(1, '#ead9c4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width / 2, 380, 20, width / 2, 520, width * 0.55);
    glow.addColorStop(0, 'rgba(14, 61, 50, 0.26)');
    glow.addColorStop(1, 'rgba(14, 61, 50, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const inset = 40;
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.95)';
    ctx.lineWidth = 3;
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(inset + 14, inset + 14, width - (inset + 14) * 2, height - (inset + 14) * 2);

    // Full corner florals (drawn large so sprays are not clipped)
    try {
      const [floralTr, floralBl] = await Promise.all([
        this.loadImage('images/entourage-floral-tr.png'),
        this.loadImage('images/entourage-floral-bl.png'),
      ]);
      const floralW = 280;
      ctx.drawImage(
        floralTr,
        width - floralW - 8,
        8,
        floralW,
        floralW * (floralTr.height / floralTr.width),
      );
      const blH = floralW * (floralBl.height / floralBl.width);
      ctx.drawImage(floralBl, 8, height - blH - 8, floralW, blH);
    } catch {
      /* florals unavailable */
    }

    ctx.textAlign = 'center';
    let y = 150;

    ctx.fillStyle = '#b8943a';
    ctx.font = '600 20px Cinzel, serif';
    this.fillSpacedText(ctx, 'TOGETHER WITH THEIR FAMILIES', width / 2, y, 5);
    // Bottom padding under the kicker before the names
    y += 110;

    ctx.fillStyle = '#0e3d32';
    ctx.font = '400 82px "Great Vibes", cursive';
    ctx.fillText(this.wedding.groom, width / 2, y);
    y += 50;
    ctx.font = '400 46px "Great Vibes", cursive';
    ctx.fillStyle = '#c9a227';
    ctx.fillText('&', width / 2, y);
    y += 56;
    ctx.fillStyle = '#0e3d32';
    ctx.font = '400 82px "Great Vibes", cursive';
    ctx.fillText(this.wedding.bride, width / 2, y);
    y += 36;

    this.drawGoldRule(ctx, width / 2, y, 220);
    y += 42;

    ctx.fillStyle = '#0e3d32';
    ctx.font = 'italic 500 26px "Cormorant Garamond", serif';
    ctx.fillText('joyfully invite you to celebrate their wedding', width / 2, y);
    y += 48;

    const { weekday, monthShort, day, year } = this.wedding.dateLong;
    ctx.fillStyle = '#b8943a';
    ctx.font = '600 20px Cinzel, serif';
    this.fillSpacedText(ctx, weekday.toUpperCase(), width / 2, y, 6);
    y += 42;

    ctx.fillStyle = '#1a322c';
    ctx.font = '600 48px "Cormorant Garamond", serif';
    ctx.fillText(`${day} ${monthShort} ${year}`, width / 2, y);
    y += 40;

    ctx.fillStyle = '#4d635b';
    ctx.font = 'italic 500 28px "Cormorant Garamond", serif';
    ctx.fillText(this.wedding.ceremony.time, width / 2, y);
    y += 44;

    this.drawGoldRule(ctx, width / 2, y, 150);
    y += 40;

    ctx.fillStyle = '#b8943a';
    ctx.font = '600 18px Cinzel, serif';
    this.fillSpacedText(ctx, 'CEREMONY', width / 2, y, 5);
    y += 30;
    ctx.fillStyle = '#1a322c';
    ctx.font = '600 28px "Cormorant Garamond", serif';
    y = this.fillWrappedText(ctx, this.wedding.ceremony.venue, width / 2, y, width - 200, 32);
    y += 2;
    ctx.fillStyle = '#4d635b';
    ctx.font = '400 22px "Cormorant Garamond", serif';
    y = this.fillWrappedText(ctx, this.wedding.ceremony.address, width / 2, y, width - 220, 28);
    y += 28;

    ctx.fillStyle = '#b8943a';
    ctx.font = '600 18px Cinzel, serif';
    this.fillSpacedText(ctx, 'RECEPTION', width / 2, y, 5);
    y += 30;
    ctx.fillStyle = '#1a322c';
    ctx.font = '600 26px "Cormorant Garamond", serif';
    y = this.fillWrappedText(ctx, this.wedding.reception.venue, width / 2, y, width - 200, 30);
    y += 2;
    ctx.fillStyle = '#4d635b';
    ctx.font = '400 22px "Cormorant Garamond", serif';
    y = this.fillWrappedText(ctx, this.wedding.reception.address, width / 2, y, width - 220, 28);
    y += 6;
    ctx.font = 'italic 400 20px "Cormorant Garamond", serif';
    y = this.fillWrappedText(ctx, this.wedding.reception.time, width / 2, y, width - 220, 26);
    y += 28;

    this.drawGoldRule(ctx, width / 2, y, 130);
    y += 36;

    ctx.fillStyle = '#b8943a';
    ctx.font = '600 18px Cinzel, serif';
    this.fillSpacedText(ctx, 'ATTIRE', width / 2, y, 5);
    y += 30;
    ctx.fillStyle = '#1a322c';
    ctx.font = '500 26px "Cormorant Garamond", serif';
    ctx.fillText(this.wedding.dressCode.title, width / 2, y);
    y += 36;
    y = this.drawAttirePalette(ctx, width / 2, y, this.wedding.dressCode.swatches);
    y += 28;

    ctx.fillStyle = '#b8943a';
    ctx.font = '600 18px Cinzel, serif';
    ctx.fillText(`RSVP by ${this.wedding.rsvp.deadline}`, width / 2, y);
    y += 36;

    this.drawGoldRule(ctx, width / 2, y, 180);
    y += 44;

    // Entourage
    ctx.fillStyle = '#b8943a';
    ctx.font = '600 20px Cinzel, serif';
    this.fillSpacedText(ctx, 'THE ENTOURAGE', width / 2, y, 6);
    y += 40;
    y = this.drawInviteEntourage(ctx, width, y);
    y += 28;

    const qr = this.qrDataUrl();
    if (qr) {
      try {
        const qrImg = await this.loadImage(qr);
        const qrSize = 120;
        const qrX = (width - qrSize) / 2;
        const qrY = Math.min(y + 4, height - qrSize - 90);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
        ctx.strokeStyle = 'rgba(201, 162, 39, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
        y = qrY + qrSize + 28;
      } catch {
        y += 12;
      }
    }

    ctx.fillStyle = '#b8943a';
    ctx.font = '600 20px Cinzel, serif';
    ctx.fillText(this.wedding.monogram, width / 2, Math.min(y + 2, height - 70));

    // Crop unused bottom canvas so the download is not overly tall
    const usedH = Math.min(height, Math.ceil(Math.max(y + 60, 1800)));
    if (usedH < height) {
      const cropped = document.createElement('canvas');
      cropped.width = width;
      cropped.height = usedH;
      const cctx = cropped.getContext('2d');
      if (cctx) {
        cctx.drawImage(canvas, 0, 0, width, usedH, 0, 0, width, usedH);
        // redraw bottom floral on cropped canvas edge
        try {
          const floralBl = await this.loadImage('images/entourage-floral-bl.png');
          const floralW = 280;
          const blH = floralW * (floralBl.height / floralBl.width);
          cctx.drawImage(floralBl, 8, usedH - blH - 8, floralW, blH);
          // restore gold frame bottom edge over floral slightly
          cctx.strokeStyle = 'rgba(201, 162, 39, 0.95)';
          cctx.lineWidth = 3;
          cctx.strokeRect(inset, inset, width - inset * 2, usedH - inset * 2);
        } catch {
          /* ignore */
        }
        return mimeType === 'image/jpeg'
          ? cropped.toDataURL(mimeType, quality)
          : cropped.toDataURL(mimeType);
      }
    }

    return mimeType === 'image/jpeg'
      ? canvas.toDataURL(mimeType, quality)
      : canvas.toDataURL(mimeType);
  }

  /** Compact entourage block for the downloadable invitation image. */
  private drawInviteEntourage(ctx: CanvasRenderingContext2D, width: number, startY: number): number {
    const e = this.wedding.entourage;
    let y = startY;
    const colGap = 40;
    const colW = (width - 220 - colGap) / 2;
    const leftX = 110 + colW / 2;
    const rightX = width - 110 - colW / 2;

    const role = (label: string, x: number, yy: number): number => {
      ctx.fillStyle = '#b8943a';
      ctx.font = '600 15px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText(label.toUpperCase(), x, yy);
      return yy + 22;
    };
    const name = (text: string, x: number, yy: number): number => {
      ctx.fillStyle = '#1a322c';
      ctx.font = '500 20px "Cormorant Garamond", serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, x, yy);
      return yy + 24;
    };

    // Parents — two columns
    let yL = role('Parents of the Groom', leftX, y);
    for (const n of e.parentsOfGroom) {
      yL = name(n, leftX, yL);
    }
    let yR = role('Parents of the Bride', rightX, y);
    for (const n of e.parentsOfBride) {
      yR = name(n, rightX, yR);
    }
    y = Math.max(yL, yR) + 18;

    // Best man / Maid of honor
    yL = role('Best Man', leftX, y);
    yL = name(e.bestMan, leftX, yL);
    yR = role('Maid of Honor', rightX, y);
    yR = name(e.maidOfHonor, rightX, yR);
    y = Math.max(yL, yR) + 20;

    // Principal sponsors
    ctx.fillStyle = '#b8943a';
    ctx.font = '600 15px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRINCIPAL SPONSORS', width / 2, y);
    y += 26;
    for (const pair of e.principalSponsors) {
      ctx.fillStyle = '#1a322c';
      ctx.font = '500 19px "Cormorant Garamond", serif';
      ctx.textAlign = 'center';
      ctx.fillText(pair.gentlemen, leftX, y);
      ctx.fillText(pair.ladies, rightX, y);
      y += 24;
    }
    y += 14;

    // Secondary sponsors
    const secondaryCols = e.secondarySponsors;
    const secW = (width - 200) / Math.max(secondaryCols.length, 1);
    let secBottom = y;
    secondaryCols.forEach((s, i) => {
      const x = 100 + secW * i + secW / 2;
      let yy = role(s.role, x, y);
      for (const n of s.pair.split(' & ')) {
        yy = name(n, x, yy);
      }
      secBottom = Math.max(secBottom, yy);
    });
    y = secBottom + 18;

    // Bearers
    const bearerW = (width - 200) / Math.max(e.bearers.length, 1);
    let bearerBottom = y;
    e.bearers.forEach((b, i) => {
      const x = 100 + bearerW * i + bearerW / 2;
      let yy = role(b.role, x, y);
      yy = name(b.name, x, yy);
      bearerBottom = Math.max(bearerBottom, yy);
    });
    y = bearerBottom + 16;

    // Flower girls
    if (e.flowerGirls.length) {
      ctx.fillStyle = '#b8943a';
      ctx.font = '600 15px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText('FLOWER GIRL', width / 2, y);
      y += 24;
      const fgW = (width - 260) / Math.max(e.flowerGirls.length, 1);
      e.flowerGirls.forEach((n, i) => {
        const x = 130 + fgW * i + fgW / 2;
        name(n, x, y);
      });
      y += 28;
    }

    ctx.textAlign = 'center';
    return y;
  }

  /** Resolve dress swatch CSS variables to hex for canvas drawing. */
  private resolveSwatchColor(color: string): string {
    const map: Record<string, string> = {
      'var(--swatch-emerald)': '#115e4a',
      'var(--swatch-beige)': '#d7c4a8',
      'var(--swatch-gold)': '#c9a227',
      'var(--swatch-brown)': '#4a2f1c',
      'var(--swatch-soft-beige)': '#ead9c4',
      'var(--swatch-champagne)': '#f3e6c4',
    };
    return map[color] ?? color;
  }

  private drawAttirePalette(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    swatches: readonly { readonly name: string; readonly color: string }[],
  ): number {
    const count = swatches.length;
    if (!count) {
      return y;
    }

    const circleR = 22;
    const gap = 96;
    const totalW = (count - 1) * gap;
    const startX = cx - totalW / 2;
    const prevAlign = ctx.textAlign;

    swatches.forEach((swatch, i) => {
      const x = startX + i * gap;
      ctx.beginPath();
      ctx.arc(x, y, circleR, 0, Math.PI * 2);
      ctx.fillStyle = this.resolveSwatchColor(swatch.color);
      ctx.fill();
      ctx.strokeStyle = 'rgba(141, 106, 24, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#4d635b';
      ctx.font = '500 13px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText(swatch.name, x, y + circleR + 22);
    });

    ctx.textAlign = prevAlign;
    return y + circleR + 34;
  }

  private fillWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ): number {
    const words = text.split(/\s+/);
    let line = '';
    let cursorY = y;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        ctx.fillText(line, x, cursorY);
        cursorY += lineHeight;
        line = word;
      } else {
        line = next;
      }
    }
    if (line) {
      ctx.fillText(line, x, cursorY);
      cursorY += lineHeight;
    }
    return cursorY;
  }

  /** Build a themed invitation card (header + QR) and download it as PNG. */
  protected async downloadQr(): Promise<void> {
    const qr = this.qrDataUrl();
    if (!qr || this.qrDownloading()) {
      return;
    }

    this.qrDownloading.set(true);
    try {
      const dataUrl = await this.buildDownloadableQrCard(qr);
      const filename = `${this.wedding.groom.toLowerCase()}-${this.wedding.bride.toLowerCase()}-wedding-invitation-qr.jpg`;
      await this.saveOrShareImage(
        dataUrl,
        filename,
        `${this.wedding.groom} & ${this.wedding.bride} Wedding QR`,
      );
    } catch {
      /* keep modal usable if canvas/fonts fail */
    } finally {
      this.qrDownloading.set(false);
    }
  }

  /** Cream card with gold frame, names header, and branded QR — wedding palette. */
  private async buildDownloadableQrCard(qrDataUrl: string): Promise<string> {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const qrImg = await this.loadImage(qrDataUrl);
    const width = 1080;
    const height = 1480;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas unavailable');
    }

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#f4ead8');
    bg.addColorStop(0.45, '#fbf6ec');
    bg.addColorStop(1, '#ead9c4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Soft emerald glow behind the card
    const glow = ctx.createRadialGradient(width / 2, height * 0.28, 40, width / 2, height * 0.35, width * 0.55);
    glow.addColorStop(0, 'rgba(14, 61, 50, 0.28)');
    glow.addColorStop(1, 'rgba(14, 61, 50, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // Outer gold frame
    const inset = 48;
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.95)';
    ctx.lineWidth = 3;
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(inset + 14, inset + 14, width - (inset + 14) * 2, height - (inset + 14) * 2);

    // Header
    const names = `${this.wedding.groom} & ${this.wedding.bride}`;
    ctx.fillStyle = '#0e3d32';
    ctx.textAlign = 'center';
    ctx.font = '400 92px "Great Vibes", cursive';
    ctx.fillText(names, width / 2, 220);

    // Gold rule under names
    this.drawGoldRule(ctx, width / 2, 268, 280);

    ctx.fillStyle = '#b8943a';
    ctx.font = '600 28px Cinzel, serif';
    this.fillSpacedText(ctx, 'WEDDING INVITATION', width / 2, 330, 8);

    ctx.fillStyle = '#4d635b';
    ctx.font = '500 26px "Cormorant Garamond", serif';
    const { month, day, year } = this.wedding.dateLong;
    ctx.fillText(`${month} ${day}, ${year}`, width / 2, 380);

    // QR panel
    const qrSize = 640;
    const qrX = (width - qrSize) / 2;
    const qrY = 460;
    const panelX = qrX - 28;
    const panelY = qrY - 28;
    const panelSize = qrSize + 56;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(14, 61, 50, 0.12)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    this.roundRectPath(ctx, panelX, panelY, panelSize, panelSize, 18);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = 'rgba(201, 162, 39, 0.65)';
    ctx.lineWidth = 2;
    this.roundRectPath(ctx, panelX, panelY, panelSize, panelSize, 18);
    ctx.stroke();

    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // Footer
    this.drawGoldRule(ctx, width / 2, 1200, 200);
    ctx.fillStyle = '#4d635b';
    ctx.font = '500 30px "Cormorant Garamond", serif';
    ctx.fillText('Scan to open our invitation', width / 2, 1260);

    ctx.fillStyle = '#b8943a';
    ctx.font = '600 20px Cinzel, serif';
    ctx.fillText(this.wedding.monogram, width / 2, 1320);

    return canvas.toDataURL('image/jpeg', 0.92);
  }

  private drawGoldRule(ctx: CanvasRenderingContext2D, cx: number, y: number, halfWidth: number): void {
    const grad = ctx.createLinearGradient(cx - halfWidth, y, cx + halfWidth, y);
    grad.addColorStop(0, 'rgba(201, 162, 39, 0)');
    grad.addColorStop(0.5, 'rgba(201, 162, 39, 0.9)');
    grad.addColorStop(1, 'rgba(201, 162, 39, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - halfWidth, y);
    ctx.lineTo(cx + halfWidth, y);
    ctx.stroke();

    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.moveTo(cx, y - 5);
    ctx.lineTo(cx + 5, y);
    ctx.lineTo(cx, y + 5);
    ctx.lineTo(cx - 5, y);
    ctx.closePath();
    ctx.fill();
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = src;
    });
  }

  private roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  private fillSpacedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    letterGap: number,
  ): void {
    const chars = [...text];
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total =
      widths.reduce((sum, w) => sum + w, 0) + letterGap * Math.max(0, chars.length - 1);
    let cursor = x - total / 2;
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cursor + widths[i] / 2, y);
      cursor += widths[i] + letterGap;
    }
  }

  protected openShare(): void {
    this.copied.set(false);
    this.shareOpen.set(true);
  }

  protected closeShare(): void {
    this.shareOpen.set(false);
  }

  /** Close the chooser after the browser has followed the share link. */
  protected pickShare(): void {
    setTimeout(() => this.shareOpen.set(false), 600);
  }

  /** Copy a wedding hashtag for guests posting photos. */
  protected async copyHashtag(tag: string): Promise<void> {
    const ok = await this.copyLink(tag);
    this.hashtagCopied.set(ok ? tag : '');
    if (ok) {
      window.setTimeout(() => {
        if (this.hashtagCopied() === tag) {
          this.hashtagCopied.set('');
        }
      }, 1800);
    }
  }

  /** Download the monetary-gift QR with bank details. */
  protected async downloadGiftQr(): Promise<void> {
    const qr = this.giftQrDataUrl();
    if (!qr || this.giftQrDownloading()) {
      return;
    }

    this.giftQrDownloading.set(true);
    try {
      const dataUrl = await this.buildDownloadableGiftQrCard(qr);
      const filename = `${this.wedding.groom.toLowerCase()}-${this.wedding.bride.toLowerCase()}-gift-qr.jpg`;
      await this.saveOrShareImage(
        dataUrl,
        filename,
        `${this.wedding.groom} & ${this.wedding.bride} Gift QR`,
      );
    } catch {
      /* keep the gifts section usable if canvas/fonts fail */
    } finally {
      this.giftQrDownloading.set(false);
    }
  }

  /** Cream card with gift QR, GCash, and bank account details. */
  private async buildDownloadableGiftQrCard(qrDataUrl: string): Promise<string> {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const qrImg = await this.loadImage(qrDataUrl);
    const gift = this.wedding.monetaryGift;
    const width = 1080;
    const height = 1480;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas unavailable');
    }

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#f4ead8');
    bg.addColorStop(0.45, '#fbf6ec');
    bg.addColorStop(1, '#ead9c4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width / 2, height * 0.28, 40, width / 2, height * 0.35, width * 0.55);
    glow.addColorStop(0, 'rgba(14, 61, 50, 0.28)');
    glow.addColorStop(1, 'rgba(14, 61, 50, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const inset = 48;
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.95)';
    ctx.lineWidth = 3;
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(inset + 14, inset + 14, width - (inset + 14) * 2, height - (inset + 14) * 2);

    ctx.fillStyle = '#0e3d32';
    ctx.textAlign = 'center';
    ctx.font = '400 88px "Great Vibes", cursive';
    ctx.fillText(`${this.wedding.groom} & ${this.wedding.bride}`, width / 2, 210);

    this.drawGoldRule(ctx, width / 2, 255, 260);

    ctx.fillStyle = '#b8943a';
    ctx.font = '600 26px Cinzel, serif';
    this.fillSpacedText(ctx, 'MONETARY GIFT', width / 2, 310, 8);

    const qrSize = 520;
    const qrX = (width - qrSize) / 2;
    const qrY = 360;
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36);
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36);
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    let y = qrY + qrSize + 78;
    ctx.fillStyle = '#8d6a18';
    ctx.font = '600 22px Cinzel, serif';
    this.fillSpacedText(ctx, 'GCASH', width / 2, y, 6);
    y += 42;
    ctx.fillStyle = '#0e3d32';
    ctx.font = '500 34px "Cormorant Garamond", serif';
    ctx.fillText(gift.gcashName, width / 2, y);
    y += 40;
    ctx.fillText(gift.gcashNumber, width / 2, y);

    y += 58;
    this.drawGoldRule(ctx, width / 2, y, 180);
    y += 52;

    ctx.fillStyle = '#8d6a18';
    ctx.font = '600 22px Cinzel, serif';
    this.fillSpacedText(ctx, 'BANK TRANSFER', width / 2, y, 6);
    y += 44;
    ctx.fillStyle = '#0e3d32';
    ctx.font = '500 32px "Cormorant Garamond", serif';
    ctx.fillText(gift.bankName, width / 2, y);
    y += 40;
    ctx.fillText(gift.accountName, width / 2, y);
    y += 44;
    ctx.font = '600 38px "Cormorant Garamond", serif';
    ctx.fillText(gift.accountNumber, width / 2, y);

    y += 58;
    ctx.fillStyle = '#4d635b';
    ctx.font = 'italic 24px "Cormorant Garamond", serif';
    ctx.fillText('Mock QR · Preview only', width / 2, y);

    return canvas.toDataURL('image/jpeg', 0.92);
  }

  /** Copy the mock bank account number for monetary gifts. */
  protected async copyGiftAccount(): Promise<void> {
    const digits = this.wedding.monetaryGift.accountNumber.replace(/\s+/g, '');
    const ok = await this.copyLink(digits);
    if (this.giftAccountCopiedTimer) {
      clearTimeout(this.giftAccountCopiedTimer);
      this.giftAccountCopiedTimer = null;
    }
    this.giftAccountCopied.set(ok);
    if (ok) {
      this.giftAccountCopiedTimer = setTimeout(() => {
        this.giftAccountCopied.set(false);
        this.giftAccountCopiedTimer = null;
      }, 1800);
    }
  }

  /** Copy the invitation link and reflect it in the chooser. */
  protected async copyShareLink(): Promise<void> {
    const ok = await this.copyLink(this.shareUrl() || window.location.href);
    this.copied.set(ok);
  }

  /** Share via the native share sheet (mobile), falling back to clipboard copy. */
  protected async shareSite(): Promise<void> {
    const url = this.shareUrl() || window.location.href;
    const shareData = {
      title: `${this.wedding.groom} & ${this.wedding.bride} — Wedding Invitation`,
      text: "You're invited! Join us as we celebrate our wedding.",
      url,
    };
    const nav = window.navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data: ShareData) => boolean;
    };

    // 1) Native share sheet, when available and willing to accept the data.
    if (nav.share && (!nav.canShare || nav.canShare(shareData))) {
      try {
        await nav.share(shareData);
        this.shareHint.set('Thanks for sharing!');
        return;
      } catch (err) {
        // User cancelled — stop quietly. Any other error → fall back to copy.
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    // 2) Copy the link (async clipboard, then legacy execCommand as a fallback).
    const copied = await this.copyLink(url);
    this.shareHint.set(copied ? 'Link copied!' : url);
  }

  /** Copy text to the clipboard, with a legacy fallback for older webviews. */
  private async copyLink(text: string): Promise<boolean> {
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to the legacy path
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }

  /**
   * Hide the sticky bar while scrolling down, reveal it on scroll-up,
   * and always bring it back after 5s without further scroll.
   */
  private setupAutoHideNav(): void {
    const IDLE_MS = 5000;
    const DELTA = 8;
    let lastY = window.scrollY;
    let idleId: ReturnType<typeof setTimeout> | null = null;

    const showNav = () => this.navHidden.set(false);
    const sectionIds = ['details', 'venue', 'day', 'attire', 'entourage', 'moments', 'gifts', 'rsvp'];
    let lastTab = '';

    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      lastY = y;

      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      if (Math.abs(progress - this.scrollProgress()) > 0.004) {
        this.scrollProgress.set(progress);
      }

      const marker = y + 140;
      let section = 'top';
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= marker) section = id;
      }
      if (section !== this.activeSection()) {
        this.activeSection.set(section);
      }

      const tabHref =
        section === 'details' ? '#details'
        : section === 'moments' ? '#moments'
        : section === 'rsvp' ? '#rsvp'
        : section === 'venue' || section === 'day' || section === 'attire' || section === 'entourage' ? '#venue'
        : '#top';
      if (tabHref !== lastTab) {
        lastTab = tabHref;
        document.querySelectorAll<HTMLAnchorElement>('.tabbar__item').forEach((link) => {
          link.classList.toggle('is-active', link.getAttribute('href') === tabHref);
        });
      }

      if (idleId !== null) {
        clearTimeout(idleId);
      }
      idleId = setTimeout(showNav, IDLE_MS);

      if (this.menuOpen()) {
        showNav();
        return;
      }

      if (y < 12) {
        showNav();
        return;
      }

      if (delta > DELTA) {
        this.navHidden.set(true);
      } else if (delta < -DELTA) {
        showNav();
      }
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      if (idleId !== null) {
        clearTimeout(idleId);
      }
    });
  }

  private toEventView(event: WeddingEvent): EventView {
    const q = encodeURIComponent(event.mapQuery);
    return {
      ...event,
      mapEmbed: this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://maps.google.com/maps?q=${q}&z=15&hl=en&t=&ie=UTF8&iwloc=B&output=embed`,
      ),
      mapLink: `https://www.google.com/maps/search/?api=1&query=${q}`,
    };
  }

  protected openMap(event: EventView): void {
    this.activeMap.set({
      name: event.venue,
      embed: event.mapEmbed,
      link: event.mapLink,
    });
  }

  protected closeMap(): void {
    this.activeMap.set(null);
  }

  protected openLightbox(photo: string): void {
    this.resetLightboxZoom();
    this.lightboxPhoto.set(photo);
  }

  protected closeLightbox(): void {
    this.resetLightboxZoom();
    this.lightboxPhoto.set(null);
  }

  protected pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  /** Whether the "Add to Calendar" chooser is open. */
  protected readonly calOpen = signal(false);

  protected openCal(): void {
    this.calOpen.set(true);
  }

  protected closeCal(): void {
    this.calOpen.set(false);
  }

  /**
   * Close the chooser *after* the browser has followed the calendar link.
   * Closing synchronously removes the <a> from the DOM and cancels navigation.
   */
  protected pickCal(): void {
    setTimeout(() => this.calOpen.set(false), 600);
  }

  /**
   * Google Calendar "add event" link. A plain https navigation, so it works
   * inside in-app browsers (Messenger, Instagram) where file downloads do not.
   */
  protected readonly googleCalUrl = (() => {
    const start = new Date(WEDDING.dateIso);
    const end = new Date(start.getTime() + 5 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${WEDDING.groom} & ${WEDDING.bride} Wedding`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: `Join us as we celebrate the wedding of ${WEDDING.groom} & ${WEDDING.bride}. Ceremony at ${WEDDING.ceremony.venue}.`,
      location: WEDDING.ceremony.address,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  })();
}
