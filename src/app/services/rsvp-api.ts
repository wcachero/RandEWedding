import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface GuestCompanion {
  id?: number;
  name: string | null;
  dateAdded?: string;
  dateUpdated?: string;
}

export interface GuestRecord {
  id: number;
  name: string;
  joyfullyAccept: boolean | null;
  message: string | null;
  companionCount: number;
  dateResponded: string | null;
  dateAdded: string;
  dateUpdated: string;
  companions: GuestCompanion[];
  responded?: boolean;
}

export interface GuestSearchHit {
  id: number;
  name: string;
  companionCount: number;
  responded: boolean;
  joyfullyAccept: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class RsvpApi {
  private readonly http = inject(HttpClient);

  searchGuests(q: string): Observable<{ guests: GuestSearchHit[] }> {
    const params = new HttpParams().set('q', q);
    return this.http.get<{ guests: GuestSearchHit[] }>('/api/guests/search', { params });
  }

  getGuest(id: number): Observable<{ guest: GuestRecord }> {
    return this.http.get<{ guest: GuestRecord }>(`/api/guests/${id}`);
  }

  submitRsvp(payload: {
    guestId: number;
    joyfullyAccept: boolean;
    message?: string;
    companions?: Array<{ name?: string | null }>;
  }): Observable<{ ok: boolean; guest: GuestRecord }> {
    return this.http.post<{ ok: boolean; guest: GuestRecord }>('/api/rsvp', payload);
  }

  adminLogin(username: string, password: string): Observable<{ ok: boolean; username: string }> {
    return this.http.post<{ ok: boolean; username: string }>(
      '/api/admin/login',
      { username, password },
      { withCredentials: true },
    );
  }

  adminLogout(): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>('/api/admin/logout', {}, { withCredentials: true });
  }

  adminMe(): Observable<{ username: string }> {
    return this.http.get<{ username: string }>('/api/admin/me', { withCredentials: true });
  }

  listGuests(): Observable<{ guests: GuestRecord[] }> {
    return this.http.get<{ guests: GuestRecord[] }>('/api/admin/guests', { withCredentials: true });
  }

  createGuest(name: string, companionCount: number): Observable<{ guest: GuestRecord }> {
    return this.http.post<{ guest: GuestRecord }>(
      '/api/admin/guests',
      { name, companionCount },
      { withCredentials: true },
    );
  }

  updateGuest(
    id: number,
    body: {
      name?: string;
      companionCount?: number;
      joyfullyAccept?: boolean | null;
      message?: string | null;
      clearResponse?: boolean;
    },
  ): Observable<{ guest: GuestRecord }> {
    return this.http.put<{ guest: GuestRecord }>(`/api/admin/guests/${id}`, body, {
      withCredentials: true,
    });
  }

  deleteGuest(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`/api/admin/guests/${id}`, { withCredentials: true });
  }

  listRespondents(): Observable<{ respondents: GuestRecord[] }> {
    return this.http.get<{ respondents: GuestRecord[] }>('/api/admin/respondents', {
      withCredentials: true,
    });
  }
}
