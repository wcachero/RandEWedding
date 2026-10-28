import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LetterExperience } from './components/letter-experience/letter-experience';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LetterExperience],
  template: `<app-letter-experience />`,
})
export class App {}
