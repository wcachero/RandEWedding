import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WEDDING } from '../../data/wedding';

/**
 * Site footer — emerald and gold close, with florals, socials, and the GW Moments mark.
 */
@Component({
  selector: 'app-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="footer">
      <div class="footer__wash" aria-hidden="true"></div>
      <div class="footer__floral footer__floral--left" aria-hidden="true"></div>
      <div class="footer__floral footer__floral--right" aria-hidden="true"></div>

      <div class="footer__inner">
        <img class="footer__flourish" src="images/flourish.svg" alt="" />

        <p class="footer__kicker">With love</p>
        <p class="footer__message">
          Thank you for being part of our story. This digital invitation was crafted with love by
          <strong>GW Moments</strong> — for elegant, interactive invitations of your own, we'd be
          delighted to connect with you.
        </p>

        <ul class="footer__socials">
          @for (s of socials; track s.label) {
            <li>
              <a class="footer__social" [href]="s.url" [attr.aria-label]="s.label"
                 target="_blank" rel="noopener">
                @switch (s.icon) {
                  @case ('facebook') {
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path fill="currentColor" d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.75-1.6 1.5V12h2.7l-.43 2.9h-2.3v7A10 10 0 0 0 22 12Z"/>
                    </svg>
                  }
                  @case ('instagram') {
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path fill="currentColor" d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.4.36 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.8-.42 2.2-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.4.17-1 .36-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.25-2.2-.42a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.17-.4-.36-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.8.42-2.2.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.4-.17 1-.36 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.7.07-.9.04-1.4.2-1.7.32-.43.17-.74.37-1.06.7-.32.31-.52.62-.7 1.05-.12.3-.28.8-.32 1.7C3.25 8.5 3.24 8.9 3.24 12s0 3.5.07 4.7c.04.9.2 1.4.32 1.7.17.43.37.74.7 1.06.31.32.62.52 1.05.7.3.12.8.28 1.7.32 1.2.06 1.6.07 4.7.07s3.5 0 4.7-.07c.9-.04 1.4-.2 1.7-.32.43-.17.74-.37 1.06-.7.32-.31.52-.62.7-1.05.12-.3.28-.8.32-1.7.06-1.2.07-1.6.07-4.7s0-3.5-.07-4.7c-.04-.9-.2-1.4-.32-1.7a2.8 2.8 0 0 0-.7-1.06 2.8 2.8 0 0 0-1.05-.7c-.3-.12-.8-.28-1.7-.32C15.5 4 15.1 4 12 4Zm0 3.06A4.94 4.94 0 1 1 12 17a4.94 4.94 0 0 1 0-9.88Zm0 1.8a3.14 3.14 0 1 0 0 6.28 3.14 3.14 0 0 0 0-6.28Zm5.14-.9a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0Z"/>
                    </svg>
                  }
                  @case ('tiktok') {
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path fill="currentColor" d="M16.6 5.8a4.3 4.3 0 0 1-1-2.8h-3.1v11.9a2.4 2.4 0 1 1-2.4-2.4c.24 0 .47.03.7.1V9.4a5.5 5.5 0 0 0-.7-.05 5.5 5.5 0 1 0 5.5 5.5V8.7a7.3 7.3 0 0 0 4.2 1.34V6.94a4.3 4.3 0 0 1-3.2-1.14Z"/>
                    </svg>
                  }
                  @case ('email') {
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v.01L12 12l8-5.99V6H4Zm16 2.24-8 5.99-8-6V18h16V8.24Z"/>
                    </svg>
                  }
                }
              </a>
            </li>
          }
        </ul>

        <img class="footer__logo" src="images/gw-moments-logo.png" alt="GW Moments logo"
             width="72" height="74" />
        <p class="footer__brand">GW Moments</p>
        <p class="footer__tagline">Your Moment. Your Story. Your Way.</p>
        <p class="footer__copyright">&copy; 2026 GW Moments. All rights reserved.</p>
      </div>
    </footer>
  `,
  styleUrl: './site-footer.scss',
})
export class SiteFooter {
  protected readonly socials = WEDDING.socials;
}
