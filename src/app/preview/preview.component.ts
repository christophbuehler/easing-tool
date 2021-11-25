import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { GraphService } from '../graph.service';
import { tap } from 'rxjs/operators';

@Component({
  selector: 'app-preview',
  templateUrl: './preview.component.html',
  styleUrls: ['./preview.component.scss'],
})
export class PreviewComponent implements AfterViewInit {
  @ViewChild('canvas', { read: ElementRef })
  private canvas!: ElementRef<HTMLCanvasElement>;
  private allPoints!: number[][][];
  private ctx!: CanvasRenderingContext2D;
  private scale = 2;
  private dim!: number[];

  constructor(private graph: GraphService) {
    graph.update
      .pipe(
        tap((points) => {
          this.allPoints = points;
        })
      )
      .subscribe();

    this.curve();
  }

  ngAfterViewInit(): void {
    const { scale } = this;
    const canvas = this.canvas.nativeElement;
    this.dim = [canvas.clientWidth, canvas.clientHeight];
    canvas.width = this.dim[0] * scale;
    canvas.height = this.dim[1] * scale;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  private time = 0;
  private curve() {
    const { allPoints } = this;
    const p = allPoints;
    if (allPoints) {
      function ease(t: number) {
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
      }
      this.time += 0.005;
      this.time = this.time % 1;
      this.drawBall(ease(this.time)[1]);
    }
    window.requestAnimationFrame(() => this.curve());
  }

  private drawBall(x: number) {
    const { ctx, scale, dim } = this;
    ctx.fillStyle = 'rgba(194, 194, 255, .1)';
    ctx.fillRect(0, 0, dim[0] * scale, dim[1] * scale);
    const y = dim[1] / 2;
    ctx.beginPath();
    const rad = 16;
    ctx.arc((x * dim[0] + dim[0] / 2) * scale, y * scale, rad, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#001188';
    ctx.fill();
  }
}
