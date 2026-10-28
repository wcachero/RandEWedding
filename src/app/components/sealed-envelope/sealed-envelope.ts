import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/**
 * Stage 1 — the sealed envelope.
 * An emerald envelope with a gold wax seal and the ER monogram.
 * Emits `open` when the user taps / activates it.
 */
@Component({
  selector: 'app-sealed-envelope',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="stage">
      <p class="stage__hint">Tap the envelope to open</p>
      <button
        type="button"
        class="envelope"
        aria-label="Open the envelope"
        (click)="open.emit()">
        <svg class="envelope__art" viewBox="0 0 500 360" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="sealedBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#1a6b54" />
              <stop offset="52%" stop-color="#145c48" />
              <stop offset="100%" stop-color="#0e3d32" />
            </linearGradient>
            <linearGradient id="sealedFlap" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#248066" />
              <stop offset="100%" stop-color="#145c48" />
            </linearGradient>
            <radialGradient id="sealFill" cx="38%" cy="30%" r="72%">
              <stop offset="0%" stop-color="#e8d5a0" />
              <stop offset="55%" stop-color="#c9a227" />
              <stop offset="100%" stop-color="#8d6a18" />
            </radialGradient>
          </defs>

          <!-- Body -->
          <rect x="14" y="46" width="472" height="286" rx="16" fill="url(#sealedBody)" stroke="#c9a227" stroke-width="2" />
          <!-- Lower pocket fold lines -->
          <path d="M14 332 L250 200 L486 332" fill="none" stroke="#c9a84c" stroke-width="2" opacity="0.85" />
          <!-- Closed flap -->
          <path d="M14 52 Q14 46 26 46 L474 46 Q486 46 486 52 L250 214 Z" fill="url(#sealedFlap)" stroke="#c9a227" stroke-width="1.5" />
          <path d="M14 52 L250 214 L486 52" fill="none" stroke="#c9a84c" stroke-width="1.5" opacity="0.8" />

          <!-- Gold wax seal with ER monogram -->
          <g transform="translate(250 208)">
            <circle r="58" fill="url(#sealFill)" stroke="#e8d5a0" stroke-width="2.2" />
            <circle r="51" fill="none" stroke="#f3e9c8" stroke-width="1.4" opacity="0.9" />
            <text text-anchor="middle" font-family="'Great Vibes', cursive" fill="#0e3d32">
              <tspan x="0" y="10" font-size="36">E &amp; R</tspan>
            </text>
          </g>
        </svg>
      </button>
    </section>
  `,
  styleUrl: './sealed-envelope.scss',
})
export class SealedEnvelope {
  readonly open = output<void>();
}
