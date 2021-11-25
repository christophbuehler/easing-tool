import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { GraphService } from '../graph.service';
import { ControlPoint, ProjectedControlPoint, smoothen, Node, updateControlPointPos } from './control-points';

@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss'],
})
export class GraphComponent implements AfterViewInit {
  @ViewChild('canvas', { read: ElementRef })
  private canvas!: ElementRef<HTMLCanvasElement>;

  constructor(private graph: GraphService) {}

  ngAfterViewInit(): void {
    const nodes: Node[] = [
      [
        0,
        0,
        [
          void 0,
          {
            pos: [0.1, 0.5],
          },
        ],
      ],
      [
        0.4,
        0,
        [
          {
            pos: [0.2, -1],
          },
          {
            smooth: true,
          }
        ],
      ],
      [
        1,
        1,
        [
          {
            pos: [0.7, -1],
          },
        ],
      ],
    ];
    new BezierCanvas(
      this.canvas!.nativeElement,
      nodes,
      (allPoints: number[][][]) => {
        this.graph.setAllPoints(allPoints);
      }
    );
  }
}

class BezierCanvas {
  private ctx: CanvasRenderingContext2D;
  private dim!: [number, number];
  private scale = 2;
  private bounds!: [min: number, max: number];
  private maxY = 8;
  private colors = {
    curve: '#424eff',
  };
  private yToPos = (y: number) => {
    const { dim } = this;
    const range = this.bounds[1] - this.bounds[0];
    const newY = (dim[1] / range) * (y - this.bounds[0]);
    return dim[1] - newY;
  };
  private posToY = (y: number) => {
    const { dim, bounds } = this;
    const range = bounds[1] - bounds[0];
    return Math.max(
      Math.min((dim[1] - y) / (dim[1] / range) + bounds[0], this.maxY),
      -this.maxY
    );
  };
  private xToPos = (x: number) => {
    const { dim } = this;
    const pad = 16;
    return x * (dim[0] - pad * 2) + pad;
  };
  private posToX = (x: number) => {
    const { dim } = this;
    const pad = 16;
    return (x - pad) / (dim[0] - pad * 2);
  };

  private pointerWidth = 12;
  private dragCp?: ControlPoint;
  private hoverCp?: ControlPoint;
  private dragNode?: Node;
  private hoverNode?: Node;
  private activeNode?: Node;

  /**
   * Project control points onto canvas.
   * @param node 
   * @returns 
   */
  private projectControlPoints(
    node: Node,
  ) {
    smoothen(node);
    const cps = node[2].filter(Boolean) as ProjectedControlPoint[];
    cps
      .forEach(cp => cp.projectedPos = [
        this.xToPos(cp.pos![0]),
        this.yToPos(cp.pos![1]),
      ]);
  }

  private realPosToCpPos = (
    mPos: number[],
  ): number[] => [
    this.posToX(mPos[0]),
    this.posToY(mPos[1]),
  ];

  constructor(
    private canvas: HTMLCanvasElement,
    private nodes: Node[],
    private update: (allPoints: number[][][]) => any
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.init();
    this.paint();
    this.update(this.getCurveDef());

    const ontop = (mPos: number[], pos: number[], rad: number) => {
      const dX = mPos[0] - pos[0];
      const dY = mPos[1] - pos[1];
      return Math.sqrt(dX * dX + dY * dY) <= rad;
    };

    let moved = false;
    let mDownPos: number[] | void;

    const dist = (a: number[], b: number[]) => {
      const x = a[0] - b[0];
      const y = a[1] - b[1];
      return Math.sqrt(x * x + y * y);
    };

    const subtract = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1]];

    document.addEventListener('mousemove', (ev) => {
      const pagePos = [ev.pageX, ev.pageY];
      const mPos = subtract(pagePos, [canvas.offsetLeft, canvas.offsetTop]);

      if (!moved && mDownPos && dist(pagePos, mDownPos) > 4) {
        moved = true;
        if (this.dragNode && this.activeNode !== this.dragNode)
          this.activeNode = void 0;
      }

      (() => {
        const { nodes, pointerWidth } = this;

        // drag cp
        if (this.dragCp) {
          const newPos = this.realPosToCpPos(mPos);
          updateControlPointPos(this.dragCp, newPos, this.nodes);
          this.update(this.getCurveDef());
          return;
        }

        // drag node
        if (this.dragNode) {
          this.dragNode[0] = this.posToX(mPos[0]);
          this.dragNode[1] = this.posToY(mPos[1]);
          const idx = this.nodes.indexOf(this.dragNode);
          if (idx === 0) {
            this.dragNode[0] = 0;
          } else if (idx === this.nodes.length - 1) {
            this.dragNode[0] = 1;
          }

          const snap = 0.1;
          this.dragNode[1] = ~~((this.dragNode[1] + snap / 2) / snap) * snap;
          this.update(this.getCurveDef());
          return;
        }

        nodes.forEach(this.projectControlPoints.bind(this));

        const cps = nodes.map(([,,c]) => c).flat()
          .filter(Boolean) as ProjectedControlPoint[];

        this.hoverCp = cps
          .find(({ projectedPos }) =>
            ontop(mPos, projectedPos, pointerWidth / 2)
          );

        if (this.hoverCp) return;

        // hover node
        this.hoverNode = nodes.find(([x, y]) =>
          ontop(mPos, [this.xToPos(x), this.yToPos(y)], pointerWidth / 2)
        );
      })();
      this.setBounds();
      this.paint();
    });

    document.addEventListener('click', () => {
      if (!moved && (!this.hoverCp || this.hoverNode)) {
        this.activeNode = this.hoverNode;
      }
      mDownPos = void 0;
      moved = false;
      this.setBounds();
      this.dragCp = this.dragNode = void 0;
      this.paint();
    });

    canvas.addEventListener('mouseout', () => {
      this.hoverCp = this.hoverNode = void 0;
      moved = false;
      this.setBounds();
      this.paint();
    });

    canvas.addEventListener('mousedown', (ev) => {
      mDownPos = [ev.pageX, ev.pageY];
      moved = false;
      this.dragCp = this.hoverCp;
      this.dragNode = this.hoverNode;
      this.paint();
    });
  }

  private init() {
    const { canvas } = this;
    this.dim = [canvas.clientWidth, canvas.clientHeight];
    canvas.width = this.dim[0] * this.scale;
    canvas.height = this.dim[1] * this.scale;
    this.setBounds();
  }

  private paint() {
    const { nodes } = this;
    this.clear();
    this.paintScale();

    nodes.forEach((node, i) => {
      const nextNode = nodes[i + 1];
      if (nextNode) {
        this.paintCurve(node, nextNode);
      }
      this.paintControlPoints(node);
      this.paintNode(node);
    });
  }

  private setBounds() {
    const pad = 0.4;
    const { nodes } = this;
    const allYs = nodes
      .map(([, y, cps]) =>
        (cps
          .filter((cp) => !!cp && !cp.smooth) as ControlPoint[])
          .map(({ pos }) => pos![1])
          .concat([y])
      )
      .flat();
    const bounds = allYs.reduce(
      ([min, max], y) => [Math.min(min, y), Math.max(max, y)],
      [-1, 1]
    ) as [number, number];
    this.bounds = [bounds[0] - pad, bounds[1] + pad];
  }

  private clear() {
    const { ctx, dim, scale } = this;
    ctx.clearRect(0, 0, dim[0] * scale, dim[1] * scale);
  }

  private paintCurve(node: Node, nextNode: Node) {
    const { ctx, yToPos, xToPos, scale, colors } = this;
    const tP = node.slice(0, 2).concat(nextNode.slice(0, 2)) as number[];

    // Control points around node
    // c0? <- node -> c1  c2 <- nextNode -> c3?
    this.projectControlPoints(node);
    this.projectControlPoints(nextNode);

    const cps = ([
      node[2],
      nextNode[2],
    
    // [ c1, c2 ]
    ].flat().slice(1, 3) as ProjectedControlPoint[])
    
    // [ [ x, y ] ]
    .map(({ projectedPos }) => projectedPos);

    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(xToPos(tP[0]) * scale, yToPos(tP[1]) * scale);
    ctx.bezierCurveTo(
      cps[0][0] * scale,
      cps[0][1] * scale,
      cps[1][0] * scale,
      cps[1][1] * scale,
      xToPos(tP[2]) * scale,
      yToPos(tP[3]) * scale
    );

    ctx.strokeStyle = colors.curve;
    ctx.stroke();
    ctx.closePath();
  }

  private paintControlPoints(node: Node) {
    const { scale, ctx } = this;
    this.projectControlPoints(node);
    const cps = node[2].filter(Boolean) as ProjectedControlPoint[];

    cps.forEach((cp, i) => {
      const { projectedPos } = cp;

      ctx.beginPath();
      ctx.strokeStyle = '#333';
      ctx.moveTo(
        this.xToPos(node[0]) * scale,
        this.yToPos(node[1]) * this.scale
      );
      ctx.lineTo(projectedPos[0] * scale, projectedPos[1] * scale);
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.closePath();

      ctx.beginPath();
      ctx.fillStyle =
        this.dragCp === cp
          ? 'white'
          : this.hoverCp === cp
          ? 'yellow'
          : 'blue';
      ctx.arc(projectedPos[0] * scale, projectedPos[1] * scale, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '20px Roboto';
      
      const toFixed = (v1: number[], digits = 1) => [v1[0].toFixed(digits), v1[1].toFixed(digits)];

      if (cp) {
        const [x, y] = toFixed(cp.pos!);
        ctx.fillText(`${i} [${x}, ${y}]`, projectedPos[0] * scale + 12, projectedPos[1] * scale);
      }
    });
  }

  private paintNode(node: Node) {
    const { scale, ctx, dim } = this;
    const p = [this.xToPos(node[0]), this.yToPos(node[1])];
    ctx.fillStyle =
      this.activeNode === node
        ? 'orange'
        : this.hoverNode === node
        ? 'green'
        : 'white';
    ctx.beginPath();
    ctx.arc(p[0] * scale, p[1] * scale, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }

  private paintScale() {
    const { dim, scale, yToPos, xToPos, ctx, bounds } = this;
    const drawXLine = (y: number, color: string) => {
      ctx.beginPath();
      ctx.moveTo(0, y * scale + 0.5);
      ctx.lineTo(dim[0] * scale, y * scale + 0.5);
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    const drawYLine = (x: number, color: string) => {
      ctx.beginPath();
      ctx.moveTo(x * scale + 0.5, 0);
      ctx.lineTo(x * scale + 0.5, dim[1] * scale);
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    };

    const step = 0.4;
    for (let i = ~~(bounds[0] / step) * step; i <= bounds[1]; i += step) {
      drawXLine(yToPos(i), '#323242');
    }

    for (let i = 0; i <= 1; i += 0.1) {
      drawYLine(xToPos(i), '#323242');
    }
  }

  public getCurveDef(): any {
    const { nodes } = this;
    const round = (x: number) => ~~(x * 1000) / 1000;
    const allPoints = nodes
      .filter((_, i) => i !== nodes.length - 1)
      .map((node, i) => {
        const nextNode = nodes[i + 1];
        const tP = node.slice(0, 2).concat(nextNode.slice(0, 2)) as number[];
        this.projectControlPoints(node);
        const cP = (node[2]
          .filter(Boolean) as ProjectedControlPoint[])
          .map(({ projectedPos }) => projectedPos)
          .flat();
        return [tP.map(round), cP.map(round)];
      });
    return allPoints;
  }
}

export function bezier(t: number, tP: number[], cP: number[]): number[] {
  const pxy = (t: number, xy: number) =>
    Math.pow(1 - t, 3) * tP[xy] +
    3 * t * Math.pow(1 - t, 2) * cP[xy] +
    3 * Math.pow(t, 2) * (1 - t) * cP[2 + xy] +
    Math.pow(t, 3) * tP[2 + xy];
  return [pxy(t, 0), pxy(t, 1)];
}
