export type GpsStatus = 'IDLE' | 'ACQUIRING' | 'TRACKING' | 'DENIED' | 'UNAVAILABLE';

export interface GpsTelemetry {
  coords: [number, number]; // [lng, lat]
  heading: number | null; // degrees
  speed: number | null; // meters per second
  speedKmH: number; // km/h
  accuracy: number | null; // meters
  status: GpsStatus;
  errorMessage?: string;
}

export type GpsCallback = (telemetry: GpsTelemetry) => void;

class GpsManager {
  private watchId: number | null = null;
  private listeners: Set<GpsCallback> = new Set();
  private currentTelemetry: GpsTelemetry = {
    coords: [-74.006, 40.7128], // Default Batcave
    heading: null,
    speed: null,
    speedKmH: 0,
    accuracy: null,
    status: 'IDLE',
  };

  public getTelemetry(): GpsTelemetry {
    return { ...this.currentTelemetry };
  }

  public subscribe(callback: GpsCallback): () => void {
    this.listeners.add(callback);
    callback(this.currentTelemetry);

    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(): void {
    const data = { ...this.currentTelemetry };
    this.listeners.forEach((listener) => listener(data));
  }

  public startTracking(): void {
    if (!navigator.geolocation) {
      this.currentTelemetry = {
        ...this.currentTelemetry,
        status: 'UNAVAILABLE',
        errorMessage: 'GEOLOCATION API NOT AVAILABLE ON THIS DEVICE',
      };
      this.notify();
      return;
    }

    if (this.watchId !== null) return; // already tracking

    this.currentTelemetry = {
      ...this.currentTelemetry,
      status: 'ACQUIRING',
    };
    this.notify();

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude, latitude, heading, speed, accuracy } = position.coords;
        const speedVal = speed !== null && speed >= 0 ? speed : 0;
        const speedKmH = Math.round(speedVal * 3.6);

        this.currentTelemetry = {
          coords: [longitude, latitude],
          heading: heading !== null ? Math.round(heading) : null,
          speed: speedVal,
          speedKmH,
          accuracy: accuracy !== null ? Math.round(accuracy) : null,
          status: 'TRACKING',
          errorMessage: undefined,
        };
        this.notify();
      },
      (error) => {
        let status: GpsStatus = 'UNAVAILABLE';
        let msg = 'UNABLE TO ACCESS POSITION TELEMETRY';

        if (error.code === error.PERMISSION_DENIED) {
          status = 'DENIED';
          msg = 'LOCATION ACCESS DENIED. USING FIXED BATCAVE BEACON.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          status = 'UNAVAILABLE';
          msg = 'SATELLITE POSITION UNAVAILABLE';
        }

        this.currentTelemetry = {
          ...this.currentTelemetry,
          status,
          errorMessage: msg,
        };
        this.notify();
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 1000,
      }
    );
  }

  public stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.currentTelemetry = {
      ...this.currentTelemetry,
      status: 'IDLE',
    };
    this.notify();
  }

  public updateSimulatedPosition(coords: [number, number], speedKmH: number = 42, heading: number = 90): void {
    this.currentTelemetry = {
      coords,
      heading,
      speed: speedKmH / 3.6,
      speedKmH,
      accuracy: 5,
      status: 'TRACKING',
      errorMessage: undefined,
    };
    this.notify();
  }
}

export const gpsManager = new GpsManager();
