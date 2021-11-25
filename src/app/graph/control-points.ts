export type Node = [
  x: number,
  y: number,
  controlPoints: (ControlPoint | undefined)[]
];

export interface ControlPoint {
  pos?: number[];
  smooth?: boolean;
}

export interface ProjectedControlPoint extends ControlPoint {
  projectedPos: number[];
}

/**
 * Smoothen control points.
 * @param node
 * @returns
 */
export function smoothen(node: Node): boolean {
  const cps = node[2];
  if (cps.length === 0)
    throw new Error('Every node should have at least one control point.');
  if (cps[0]?.smooth) throw new Error('First control point cannot be smooth.');
  if (!cps[1]?.smooth) return false; // no smoothening required
  if (!cps[0]) throw new Error('First control point required for smoothening.');

  // Mirror the first control point along the y axis.
  cps[1].pos = mirror(cps[0].pos!, node as number[]);
  return true;
}

export function updateControlPointPos(
  cp: ControlPoint,
  newPos: number[],
  nodes?: Node[]
): boolean {
  if (!cp.smooth && nodes) {
    cp.pos = newPos;
    return restrainControlPoint(cp, nodes);
  }
  if (!nodes)
    throw new Error('Nodes required to update pos of smooth control point.');
  const node = nodes.find((node) => node[2].indexOf(cp) !== -1)!;
  node[2][0]!.pos = mirror(newPos, node as number[]);
  return restrainControlPoint(node[2][0]!, nodes);
}

export function restrainControlPoint(
  cp: ControlPoint,
  nodes: (Node | undefined)[],
): boolean {
  const node = nodes.find((node) => node && node[2].indexOf(cp) !== -1)!;
  const nodeI = nodes.indexOf(node);
  const isLeft = node[2][0] === cp;

  const bounds = (isLeft
    ? [nodes[nodeI - 1], node[0]]
    : [node[0], nodes[nodeI + 1]]) as number[];

  const restrained = restrain(cp.pos![0], bounds);
  if (restrained === void 0) return false;
  cp.pos![0] = restrained;
  return true;
}

export const restrain = (num: number, bounds: number[]): number | undefined =>
  num <= bounds[0] ? bounds[0] : num >= bounds[1] ? bounds[1] : void 0;

export const mirror = ([x, y]: number[], [mX, mY]: number[]) => [
  mX * 2 - x,
  mY * 2 - y,
];
