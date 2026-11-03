import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GuestRecord, RsvpApi } from '../../services/rsvp-api';

@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  private readonly api = inject(RsvpApi);

  protected readonly loading = signal(true);
  protected readonly username = signal<string | null>(null);
  protected readonly tab = signal<'guests' | 'respondents'>('guests');
  protected readonly error = signal('');
  protected readonly notice = signal('');

  protected readonly loginUser = signal('admin000');
  protected readonly loginPass = signal('');

  protected readonly guests = signal<GuestRecord[]>([]);
  protected readonly respondents = signal<GuestRecord[]>([]);

  protected readonly newName = signal('');
  protected readonly newCompanions = signal(0);

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
    this.api.adminLogin(this.loginUser().trim(), this.loginPass()).subscribe({
      next: (res) => {
        this.username.set(res.username);
        this.loginPass.set('');
        this.refresh();
      },
      error: (err) => {
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
    this.refresh();
  }

  protected refresh(): void {
    if (!this.username()) return;
    this.notice.set('');
    this.api.listGuests().subscribe({
      next: (res) => this.guests.set(res.guests),
      error: (err) => this.error.set(err?.error?.error || 'Failed to load guests'),
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
    this.api.createGuest(name, Math.max(0, Number(this.newCompanions()) || 0)).subscribe({
      next: () => {
        this.newName.set('');
        this.newCompanions.set(0);
        this.notice.set('Guest added');
        this.refresh();
      },
      error: (err) => this.error.set(err?.error?.error || 'Could not add guest'),
    });
  }

  protected saveGuest(guest: GuestRecord, name: string, companionCount: string): void {
    this.api
      .updateGuest(guest.id, {
        name: name.trim(),
        companionCount: Math.max(0, Number(companionCount) || 0),
      })
      .subscribe({
        next: () => {
          this.notice.set('Guest updated');
          this.refresh();
        },
        error: (err) => this.error.set(err?.error?.error || 'Update failed'),
      });
  }

  protected clearResponse(guest: GuestRecord): void {
    if (!confirm(`Clear RSVP for ${guest.name}?`)) return;
    this.api.updateGuest(guest.id, { clearResponse: true }).subscribe({
      next: () => {
        this.notice.set('Response cleared');
        this.refresh();
      },
      error: (err) => this.error.set(err?.error?.error || 'Clear failed'),
    });
  }

  protected removeGuest(guest: GuestRecord): void {
    if (!confirm(`Delete ${guest.name} from the guest list?`)) return;
    this.api.deleteGuest(guest.id).subscribe({
      next: () => {
        this.notice.set('Guest deleted');
        this.refresh();
      },
      error: (err) => this.error.set(err?.error?.error || 'Delete failed'),
    });
  }

  protected statusLabel(guest: GuestRecord): string {
    if (guest.joyfullyAccept === true) return 'Joyfully accepts';
    if (guest.joyfullyAccept === false) return 'Declines';
    return 'Awaiting reply';
  }
}
