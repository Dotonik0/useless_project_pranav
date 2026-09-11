import type { RouteManeuver } from './routing';

export interface NavStep {
  index: number;
  instruction: string;
  maneuverType: string;
  modifier?: string;
  distance: number; // meters for this step
  location: [number, number]; // [lng, lat]
  roadName?: string;
  announced500m: boolean;
  announced200m: boolean;
  announced50m: boolean;
  completed: boolean;
}

export interface TurnUpdate {
  currentStep: NavStep | null;
  nextStep: NavStep | null;
  distanceToManeuver: number; // meters
  formattedDistanceToManeuver: string;
  announcementAlert?: '500M' | '200M' | '50M' | 'ARRIVAL';
  isArrived: boolean;
}

/**
 * Calculates distance between two points in meters using Haversine formula
 */
export function calculateMeters(p1: [number, number], p2: [number, number]): number {
  const [lng1, lat1] = p1;
  const [lng2, lat2] = p2;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371000 * c;
}

export function formatStepDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
}

export class TurnTracker {
  private steps: NavStep[] = [];
  private activeIndex: number = 0;

  constructor(maneuvers: RouteManeuver[] = []) {
    this.init(maneuvers);
  }

  public init(maneuvers: RouteManeuver[]): void {
    this.steps = maneuvers.map((m, idx) => ({
      index: idx,
      instruction: m.instruction,
      maneuverType: m.type,
      modifier: m.modifier,
      distance: m.distance,
      location: m.location,
      roadName: m.roadName || 'WAYNE TRANSIT CORRIDOR',
      announced500m: false,
      announced200m: false,
      announced50m: false,
      completed: false,
    }));
    this.activeIndex = 0;
  }

  public updatePosition(currentPos: [number, number]): TurnUpdate {
    if (this.steps.length === 0) {
      return {
        currentStep: null,
        nextStep: null,
        distanceToManeuver: 0,
        formattedDistanceToManeuver: '--',
        isArrived: false,
      };
    }

    if (this.activeIndex >= this.steps.length) {
      return {
        currentStep: null,
        nextStep: null,
        distanceToManeuver: 0,
        formattedDistanceToManeuver: '0 m',
        announcementAlert: 'ARRIVAL',
        isArrived: true,
      };
    }

    let current = this.steps[this.activeIndex];
    let dist = calculateMeters(currentPos, current.location);

    // If within turn proximity (less than 25m), mark complete and advance
    if (dist <= 25 && this.activeIndex < this.steps.length - 1) {
      current.completed = true;
      this.activeIndex++;
      current = this.steps[this.activeIndex];
      dist = calculateMeters(currentPos, current.location);
    }

    const next = this.activeIndex + 1 < this.steps.length ? this.steps[this.activeIndex + 1] : null;

    let alert: '500M' | '200M' | '50M' | 'ARRIVAL' | undefined = undefined;

    // Check arrival
    if (this.activeIndex === this.steps.length - 1 && dist <= 40) {
      alert = 'ARRIVAL';
      return {
        currentStep: current,
        nextStep: null,
        distanceToManeuver: dist,
        formattedDistanceToManeuver: formatStepDistance(dist),
        announcementAlert: alert,
        isArrived: true,
      };
    }

    // Threshold detection without duplicate triggers
    if (dist <= 500 && dist > 200 && !current.announced500m) {
      current.announced500m = true;
      alert = '500M';
    } else if (dist <= 200 && dist > 80 && !current.announced200m) {
      current.announced200m = true;
      alert = '200M';
    } else if (dist <= 80 && !current.announced50m) {
      current.announced50m = true;
      alert = '50M';
    }

    return {
      currentStep: current,
      nextStep: next,
      distanceToManeuver: dist,
      formattedDistanceToManeuver: formatStepDistance(dist),
      announcementAlert: alert,
      isArrived: false,
    };
  }

  public reset(): void {
    this.activeIndex = 0;
    this.steps.forEach((s) => {
      s.announced500m = false;
      s.announced200m = false;
      s.announced50m = false;
      s.completed = false;
    });
  }
}
