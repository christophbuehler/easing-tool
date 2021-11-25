import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { GraphService } from '../graph.service';
import { Observable, combineLatest } from 'rxjs';
import { delay, first, map, shareReplay, startWith } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SubSink } from 'subsink';

export type Lang = 'js' | 'css' | 'ts' | 'python';
export type Code = { [lang in Lang]: string };

const DEFAULT_LANG = '';

@Component({
  selector: 'app-export',
  templateUrl: './export.component.html',
  styleUrls: ['./export.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportComponent implements OnInit, OnDestroy {
  langControl = new FormControl(DEFAULT_LANG);
  code!: Observable<Code>;
  visibleCode!: Observable<string>;
  subs = new SubSink();

  constructor(private snackBar: MatSnackBar, graph: GraphService) {
    this.code = graph.update.pipe(
      delay(0),
      map(
        (points) =>
          ({
            css: pointsToCSS(points),
            js: pointsToJS(points),
            ts: pointsToTS(points),
            python: pointsToPython(points),
          } as Code)
      )
    );
    this.visibleCode = combineLatest([
      this.langControl.valueChanges.pipe(startWith(DEFAULT_LANG)),
      this.code,
    ]).pipe(
      map(([lang, code]: [Lang, Code]) => code[lang]),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.subs.sink = this.visibleCode.subscribe();
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  close() {
    this.langControl.setValue('');
  }

  async copy() {
    const code = await this.visibleCode.pipe(first()).toPromise();
    await navigator.clipboard.writeText(code);
    this.snackBar.open('Happy animating! 👾', 'Donate', { duration: 4000 });
  }

  ngOnInit() {}
}

export function pointsToCSS(points: number[][][]): string {
  return `
    div.demo {
      transform: 
      animation-name: custom-easing;
    }
    @keyframes custom-easing {
      0%   { transform: translate(, 0); }
      25%  { background-color: yellow; }
      50%  { background-color: blue; }
      100% { background-color: green; }
    }
  `;
}

export function pointsToJS(points: number[][][]): string {
  const pointString = JSON.stringify(points);
  return `function ease(t) {
  const p = ${pointString};
  const [tP, cP] = p.find(
    ([tP], i) => t >= tP[0] &&
    (!p[i + 1] || p[i + 1][0][0] > t)
  );
  t = (t - tP[0]) / (tP[2] - tP[0])
  const pxy = (t, xy) =>
    Math.pow(1 - t, 3) * tP[xy] +
    3 * t * Math.pow(1 - t, 2) * cP[xy] +
    3 * Math.pow(t, 2) * (1 - t) * cP[2 + xy] +
    Math.pow(t, 3) * tP[2 + xy];
  return [pxy(t, 0), pxy(t, 1)];
}`;
}

export function pointsToTS(points: number[][][]): string {
  const pointString = JSON.stringify(points);
  return `function ease(t: number) {
  const p = ${pointString};
  const [tP, cP] = p.find(
    ([tP], i) => t >= tP[0] &&
    (!p[i + 1] || p[i + 1][0][0] > t)
  ) as number[][];
  t = (t - tP[0]) / (tP[2] - tP[0])
  const pxy = (t: number, xy: 0 | 1) =>
    Math.pow(1 - t, 3) * tP[xy] +
    3 * t * Math.pow(1 - t, 2) * cP[xy] +
    3 * Math.pow(t, 2) * (1 - t) * cP[2 + xy] +
    Math.pow(t, 3) * tP[2 + xy];
  return [pxy(t, 0), pxy(t, 1)];
}`;
}

export function pointsToPython(points: number[][][]): string {
  const pointString = JSON.stringify(points);
  return `def ease(t):
    p = ${pointString}
    tP, cP = next(
        item
        for i, item in enumerate(p)
        if t >= item[0][0] and (len(p) <= i+1 or p[i+1][0][0] > t)
    )
    t = (t - tP[0]) / (tP[2] - tP[0])
    def pxy(t, xy):
        return (1 - t)**3 * tP[xy] + 3 * t * (1 - t)**2 * cP[xy] + \\
        3 * t**2 * (1 - t) * cP[2 + xy] + t**3 * tP[2 + xy]
    return [pxy(t, 0), pxy(t, 1)];`;
}
