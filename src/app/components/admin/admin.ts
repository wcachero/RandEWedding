import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GuestRecord, RsvpApi } from '../../services/rsvp-api';

type GuestFilter = 'all' | 'awaiting' | 'accepted' | 'declined';

@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  private readonly api = inject(RsvpApi);
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly username = signal<string | null>(null);
  protected readonly tab = signal<'guests' | 'respondents'>('guests');
  protected readonly error = signal('');
  protected readonly notice = signal('');

  protected readonly loginUser = signal('');
  protected readonly loginPass = signal('');

  protected readonly guests = signal<GuestRecord[]>([]);
  protected readonly respondents = signal<GuestRecord[]>([]);

  protected readonly newName = signal('');
  protected readonly newCompanions = signal(0);
  protected readonly guestQuery = signal('');
  protected readonly guestFilter = signal<GuestFilter>('all');

  protected readonly stats = computed(() => {
    const list = this.guests();
    return {
      total: list.length,
      awaiting: list.filter((g) => g.joyfullyAccept == null).length,
      accepted: list.filter((g) => g.joyfullyAccept === true).length,
      declined: list.filter((g) => g.joyfullyAccept === false).length,
      companions: list.reduce((sum, g) => sum + Math.max(0, g.companionCount), 0),
    };
  });

  protected readonly filteredGuests = computed(() => {
    const q = this.guestQuery().trim().toLowerCase();
    const filter = this.guestFilter();
    return this.guests().filter((g) => {
      if (filter === 'awaiting' && g.joyfullyAccept != null) return false;
      if (filter === 'accepted' && g.joyfullyAccept !== true) return false;
      if (filter === 'declined' && g.joyfullyAccept !== false) return false;
      if (!q) return true;
      return g.name.toLowerCase().includes(q);
    });
  });

  ngOnInit(): void {
    this.api.adminMe().subscribe({
      next: (me) => {
        this.username.set(me.username);
        this.loading.set(false);
        this.refresh();
      },
      error: () => {
        this.username.set(null);
        this.loading.set(false);
      },
    });
  }

  protected login(event: Event): void {
    event.preventDefault();
    this.error.set('');
    this.busy.set(true);
    this.api.adminLogin(this.loginUser().trim(), this.loginPass()).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.username.set(res.username);
        this.loginPass.set('');
        this.refresh();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.error || 'Login failed');
      },
    });
  }

  protected logout(): void {
    this.api.adminLogout().subscribe({
      next: () => {
        this.username.set(null);
        this.guests.set([]);
        this.respondents.set([]);
      },
      error: () => this.username.set(null),
    });
  }

  protected setTab(tab: 'guests' | 'respondents'): void {
    this.tab.set(tab);
    this.error.set('');
    this.refresh();
  }

  protected setFilter(filter: GuestFilter): void {
    this.guestFilter.set(filter);
  }

  protected refresh(): void {
    if (!this.username()) return;
    this.error.set('');
    this.busy.set(true);
    this.api.listGuests().subscribe({
      next: (res) => {
        this.guests.set(res.guests);
        this.busy.set(false);
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.error || 'Failed to load guests');
      },
    });
    this.api.listRespondents().subscribe({
      next: (res) => this.respondents.set(res.respondents),
      error: () => undefined,
    });
  }

  protected addGuest(event: Event): void {
    event.preventDefault();
    const name = this.newName().trim();
    if (!name) return;
    this.busy.set(true);
    this.error.set('');
    this.api.createGuest(name, Math.max(0, Number(this.newCompanions()) || 0)).subscribe({
      next: () => {
        this.busy.set(false);
        this.newName.set('');
        this.newCompanions.set(0);
        this.flash('Guest added to the invite list');
        this.refresh();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.error || 'Could not add guest');
      },
    });
  }

  protected saveGuest(guest: GuestRecord, name: string, companionCount: string): void {
    const nextName = name.trim();
    if (!nextName) {
      this.error.set('Guest name cannot be empty');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .updateGuest(guest.id, {
        name: nextName,
        companionCount: Math.max(0, Number(companionCount) || 0),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.flash('Guest saved');
          this.refresh();
        },
        error: (err) => {
          this.busy.set(false);
          this.error.set(err?.error?.error || 'Update failed');
        },
      });
  }

  protected clearResponse(guest: GuestRecord): void {
    if (!confirm(`Clear RSVP for ${guest.name}? They will be able to reply again.`)) return;
    this.busy.set(true);
    this.api.updateGuest(guest.id, { clearResponse: true }).subscribe({
      next: () => {
        this.busy.set(false);
        this.flash('RSVP cleared');
        this.refresh();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.error || 'Clear failed');
      },
    });
  }

  protected removeGuest(guest: GuestRecord): void {
    if (!confirm(`Delete ${guest.name} from the guest list? This cannot be undone.`)) return;
    this.busy.set(true);
    this.api.deleteGuest(guest.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.flash('Guest deleted');
        this.refresh();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.error || 'Delete failed');
      },
    });
  }

  protected statusLabel(guest: GuestRecord): string {
    if (guest.joyfullyAccept === true) return 'Accepts';
    if (guest.joyfullyAccept === false) return 'Declines';
    return 'Awaiting';
  }

  protected statusClass(guest: GuestRecord): string {
    if (guest.joyfullyAccept === true) return 'is-yes';
    if (guest.joyfullyAccept === false) return 'is-no';
    return 'is-wait';
  }

  private flash(message: string): void {
    this.notice.set(message);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(''), 3200);
  }
}
