import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WEDDING } from '../../data/wedding';

/** Slim footer: copyright on the left, official hashtag on the right. */
@Component({
  selector: 'app-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="footer">
      <div class="footer__row">
        <p class="footer__copyright">&copy; 2026</p>
        <p class="footer__hashtag">{{ hashtag }}</p>
      </div>
    </footer>
  `,
  styleUrl: './site-footer.scss',
})
export class SiteFooter {
  protected readonly hashtag = WEDDING.hashtags[0];
}
