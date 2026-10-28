import { Directive, ElementRef, inject, input, OnInit } from '@angular/core';

/**
 * Reveals the host element with a fade-up as it scrolls into view.
 * Usage: <div appReveal> or <div [appReveal]="150"> (ms delay).
 * Falls back to immediately visible if IntersectionObserver is unavailable.
 */
@Directive({
  selector: '[appReveal]',
})
export class Reveal implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Optional stagger delay in milliseconds (bare `appReveal` = 0). */
  readonly delay = input(0, {
    alias: 'appReveal',
    transform: (value: unknown): number => Number(value) || 0,
  });

  ngOnInit(): void {
    const el = this.host.nativeElement;
    el.classList.add('reveal');
    if (this.delay()) {
      el.style.transitionDelay = `${this.delay()}ms`;
    }

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('reveal--in');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('reveal--in');
            observer.unobserve(el);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
  }
}
