import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GraphService {
  update: Observable<any>;

  private updateSub = new Subject<any>();

  constructor() {
    this.update = this.updateSub.asObservable();
  }

  setAllPoints(allPoints: number[][][]) {
    this.updateSub.next(allPoints);
  }
}
