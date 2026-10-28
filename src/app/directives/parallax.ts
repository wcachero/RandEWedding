import { AfterViewInit, Directive, ElementRef, inject, input, NgZone, OnDestroy } from '@angular/core';

/**
 * Scroll-driven parallax that works on mobile too (mobile browsers ignore
 * `background-attachment: fixed`). Apply to an oversized background *layer*
 * inside a `position: relative; overflow: hidden` container; the layer is
 * translated vertically as the container moves through the viewport.
 *
 * Runs outside Angular and throttles with requestAnimationFrame for smoothness,
 * and does nothing when the user prefers reduced motion.
 */
@Directive({
  selector: '[appParallax]',
})
export class Parallax implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  /** Fraction of the container height the layer travels (0–~0.4). */
  readonly speed = input(0.18, {
    alias: 'appParallax',
    transform: (v: unknown): number => Number(v) || 0.18,
  });

  private ticking = false;
  private readonly onScroll = (): void => this.request();
  private viewport: VisualViewport | null = null;

  ngAfterViewInit(): void {
    if (this.prefersReduced() || typeof window === 'undefined') {
      return;
    }
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
      // iOS Safari updates more reliably on touch + visualViewport than window scroll alone.
      window.addEventListener('touchmove', this.onScroll, { passive: true });
      this.viewport = window.visualViewport ?? null;
      this.viewport?.addEventListener('scroll', this.onScroll);
      this.viewport?.addEventListener('resize', this.onScroll);
      this.update();
    });
  }

  ngOnDestroy(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
    window.removeEventListener('touchmove', this.onScroll);
    this.viewport?.removeEventListener('scroll', this.onScroll);
    this.viewport?.removeEventListener('resize', this.onScroll);
  }

  private request(): void {
    if (this.ticking) {
      return;
    }
    this.ticking = true;
    requestAnimationFrame(() => {
      this.update();
      this.ticking = false;
    });
  }

  private update(): void {
    const layer = this.host.nativeElement;
    const container = layer.parentElement ?? layer;
    const rect = container.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;

    // Skip work when the container is far off-screen.
    if (rect.bottom < -50 || rect.top > vh + 50) {
      return;
    }

    // Fraction of travel through the viewport: +1 (below) → 0 (centered) → -1 (above)
    const center = rect.top + rect.height / 2;
    const frac = (center - vh / 2) / (vh / 2 + rect.height / 2);
    const shift = -frac * (rect.height * this.speed());
    layer.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
  }

  private prefersReduced(): boolean {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
