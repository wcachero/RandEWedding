import { Injectable, signal } from '@angular/core';

/**
 * Single shared background-music player for the whole experience.
 * Kept in a service so playback can start on the envelope tap and be
 * controlled from the vinyl disc, while surviving stage changes.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private audio?: HTMLAudioElement;
  readonly playing = signal(false);

  /** Shown in the disc label while music is playing. */
  readonly trackTitle = 'You Are The Reason';

  private ensure(): HTMLAudioElement {
    if (!this.audio) {
      const el = new Audio('audio/you-are-the-reason.mp3');
      el.loop = true;
      el.preload = 'auto';
      el.addEventListener('play', () => this.playing.set(true));
      el.addEventListener('pause', () => this.playing.set(false));
      el.addEventListener('ended', () => this.playing.set(false));
      this.audio = el;
    }
    return this.audio;
  }

  /** Start playback. Safe to call from a user-gesture handler (e.g. envelope tap). */
  async play(): Promise<void> {
    try {
      await this.ensure().play();
    } catch {
      // Autoplay blocked — leave paused; the disc can start it on tap.
      this.playing.set(false);
    }
  }

  pause(): void {
    this.audio?.pause();
  }

  async toggle(): Promise<void> {
    if (this.ensure().paused) {
      await this.play();
    } else {
      this.pause();
    }
  }
}
