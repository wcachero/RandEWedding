import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AudioService } from '../../services/audio';

/**
 * A vinyl record that controls the shared background music.
 * Tapping toggles playback; the disc spins only while the audio is playing.
 * The whole control can be dragged anywhere; default corner position is unchanged.
 */
@Component({
  selector: 'app-music-disc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.transform]': 'hostTransform()',
    '[class.music-disc--dragging]': 'isDragging()',
  },
  template: `
    <div
      class="player"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerUp($event)">
      <button
        type="button"
        class="player__disc"
        [class.player__disc--spinning]="audio.playing()"
        [attr.aria-pressed]="audio.playing()"
        [attr.aria-label]="audio.playing() ? 'Pause music' : 'Play music'"
        (click)="onDiscClick($event)">
        <img src="images/vinyl-disc.png" alt="" width="56" height="56" draggable="false" />
      </button>

      <div class="player__label">
        <div class="player__marquee" [attr.aria-label]="labelText()">
          <span>{{ labelText() }}</span>
          <span aria-hidden="true">{{ labelText() }}</span>
        </div>
      </div>
    </div>
  `,
  styleUrl: './music-disc.scss',
})
export class MusicDisc {
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly audio = inject(AudioService);

  private readonly offsetX = signal(0);
  private readonly offsetY = signal(0);
  protected readonly isDragging = signal(false);

  private dragMoved = false;
  private pointerStart = { x: 0, y: 0 };
  private offsetStart = { x: 0, y: 0 };
  private rectStart = { left: 0, top: 0, width: 0, height: 0 };

  protected readonly hostTransform = computed(
    () => `translate3d(${this.offsetX()}px, ${this.offsetY()}px, 0)`,
  );

  protected readonly labelText = computed(() =>
    this.audio.playing()
      ? `Now Playing.. ${this.audio.trackTitle}`
      : 'Tap to play music',
  );

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    this.isDragging.set(true);
    this.dragMoved = false;
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.offsetStart = { x: this.offsetX(), y: this.offsetY() };
    const rect = this.host.nativeElement.getBoundingClientRect();
    this.rectStart = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.isDragging()) {
      return;
    }

    const dx = event.clientX - this.pointerStart.x;
    const dy = event.clientY - this.pointerStart.y;
    if (!this.dragMoved && Math.hypot(dx, dy) < 8) {
      return;
    }
    this.dragMoved = true;

    const pad = 8;
    const maxLeft = Math.max(pad, window.innerWidth - this.rectStart.width - pad);
    const maxTop = Math.max(pad, window.innerHeight - this.rectStart.height - pad);
    const nextLeft = Math.min(maxLeft, Math.max(pad, this.rectStart.left + dx));
    const nextTop = Math.min(maxTop, Math.max(pad, this.rectStart.top + dy));

    this.offsetX.set(this.offsetStart.x + (nextLeft - this.rectStart.left));
    this.offsetY.set(this.offsetStart.y + (nextTop - this.rectStart.top));
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.isDragging()) {
      return;
    }
    this.isDragging.set(false);
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }

  protected onDiscClick(event: MouseEvent): void {
    if (this.dragMoved) {
      event.preventDefault();
      event.stopPropagation();
      this.dragMoved = false;
      return;
    }
    void this.audio.toggle();
  }
}
