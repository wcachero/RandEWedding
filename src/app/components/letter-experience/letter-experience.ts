import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SealedEnvelope } from '../sealed-envelope/sealed-envelope';
import { OpenEnvelope } from '../open-envelope/open-envelope';
import { WeddingInvitation } from '../wedding-invitation/wedding-invitation';
import { SiteFooter } from '../site-footer/site-footer';
import { MusicDisc } from '../music-disc/music-disc';
import { AudioService } from '../../services/audio';
import { WEDDING } from '../../data/wedding';

/** The stages of the experience, in order of reveal. */
type Stage = 'sealed' | 'open' | 'reading';

const STAGE_ORDER: readonly Stage[] = ['sealed', 'open', 'reading'];

/**
 * Orchestrates the three-stage reveal:
 *   sealed envelope  →  open envelope  →  the wedding invitation.
 * Owns the stage state, starts the music on the first tap, swaps the
 * presentational child components, and exposes a back control.
 */
@Component({
  selector: 'app-letter-experience',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SealedEnvelope, OpenEnvelope, WeddingInvitation, SiteFooter, MusicDisc],
  template: `
    <div class="scene" [attr.data-stage]="stage()">
      @if (stage() !== 'reading') {
        <div class="scene__stage-bg" aria-hidden="true">
          <img class="scene__stage-bg-photo" [src]="envelopePhoto" alt="" />
          <div class="scene__stage-bg-scrim"></div>
        </div>
      }

      @if (showBack()) {
        <button type="button" class="back" aria-label="Go back to the previous step" (click)="goBack()">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2"
                  stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>Back</span>
        </button>
      }

      <div class="scene__content">
        @if (stage() === 'reading') {
          <app-wedding-invitation />
        } @else {
          <h1 class="scene__invite">
            <img class="scene__invite-rings" src="images/wedding-rings.png" alt="" />
            <span class="scene__invite-line">You're</span>
            <span class="scene__invite-line">Invited</span>
            <span class="scene__invite-kicker">December 19, 2026</span>
          </h1>
          <div class="scene__fg">
            @switch (stage()) {
              @case ('sealed') {
                <app-sealed-envelope (open)="openEnvelope()" />
              }
              @case ('open') {
                <app-open-envelope (read)="openInvitation()" />
              }
            }
          </div>
        }
      </div>

      @if (stage() !== 'sealed') {
        <div class="scene__music">
          <app-music-disc />
        </div>
      }

      @if (stage() === 'reading') {
        <app-site-footer class="scene__footer" />

        <p class="overscroll-hint" aria-hidden="true">Keep pulling up to return to the beginning &#8635;</p>

        <nav class="tabbar" aria-label="Quick navigation">
          <a class="tabbar__item" href="#top">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
                    stroke-linejoin="round" d="M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5"/>
            </svg>
            <span>Home</span>
          </a>
          <a class="tabbar__item" href="#details">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
                    stroke-linejoin="round" d="M4 6h.01M4 12h.01M4 18h.01M8 6h12M8 12h12M8 18h12"/>
            </svg>
            <span>Details</span>
          </a>
          <a class="tabbar__item" href="#venue">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
                    stroke-linejoin="round" d="M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z"/>
              <circle cx="12" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/>
            </svg>
            <span>Location</span>
          </a>
          <a class="tabbar__item" href="#gallery">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
                    stroke-linejoin="round" d="M4 5h16v14H4zM4 15l4.5-4.5L14 16M14 13l2.5-2.5L20 14M9.5 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>
            </svg>
            <span>Gallery</span>
          </a>
          <a class="tabbar__item" href="#rsvp">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
                    stroke-linejoin="round" d="M20.8 8.6a4.6 4.6 0 0 0-8.8-1.9 4.6 4.6 0 0 0-8.8 1.9c0 4.2 5.2 7.9 8.8 10 3.6-2.1 8.8-5.8 8.8-10Z"/>
            </svg>
            <span>RSVP</span>
          </a>
        </nav>
      }
    </div>
  `,
  styleUrl: './letter-experience.scss',
})
export class LetterExperience {
  protected readonly envelopePhoto = WEDDING.envelopePhoto;
  private readonly audio = inject(AudioService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly stage = signal<Stage>('sealed');

  /** The floating back control is only useful on the opened-envelope step. */
  protected readonly showBack = computed(() => this.stage() === 'open');

  constructor() {
    afterNextRender(() => {
      this.setupOverscrollReturn();
      // Chrome handoff from Messenger: skip the envelope and land on the invitation.
      const save = new URLSearchParams(window.location.search).get('save');
      if (save === 'invite' || save === 'qr') {
        this.stage.set('reading');
      }
    });
  }

  /**
   * When the guest is already at the very bottom of the invitation and keeps
   * pulling/scrolling further, return them to the sealed envelope.
   */
  private setupOverscrollReturn(): void {
    const THRESHOLD = 320; // extra px past the bottom before we return
    let acc = 0;
    let lastTouchY = 0;

    const atBottom = () =>
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 2;

    const bump = (delta: number) => {
      if (this.stage() !== 'reading') return;
      if (delta > 0 && atBottom()) {
        acc += delta;
        if (acc > THRESHOLD) {
          acc = 0;
          this.restart();
        }
      } else if (delta < 0) {
        acc = 0;
      }
    };

    const onWheel = (e: WheelEvent) => bump(e.deltaY);
    const onTouchStart = (e: TouchEvent) => {
      lastTouchY = e.touches[0]?.clientY ?? 0;
      acc = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      bump(lastTouchY - y); // swipe up (content moves up) => positive
      lastTouchY = y;
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    });
  }

  /** Tapping the envelope opens it and starts the music (runs inside the user gesture). */
  protected openEnvelope(): void {
    this.stage.set('open');
    void this.audio.play();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  protected openInvitation(): void {
    this.stage.set('reading');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  protected goBack(): void {
    const index = STAGE_ORDER.indexOf(this.stage());
    if (index > 0) {
      this.stage.set(STAGE_ORDER[index - 1]);
    }
  }

  /** Return to the very beginning — the sealed envelope — and stop the music. */
  protected restart(): void {
    this.audio.pause();
    this.stage.set('sealed');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}
