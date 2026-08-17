export type SafetyRouteInput = {
  id: number;
  distance: number;
  duration: number;
  potholeCount: number;
};

export type SafetyRouteResult =
  SafetyRouteInput & {
    potholeRisk: number;
    distanceRisk: number;
    timeRisk: number;
    riskScore: number;
    safetyScore: number;
  };

function normalize(
  value: number,
  min: number,
  max: number
): number {
  if (max === min) {
    return 0;
  }

  return ((value - min) / (max - min)) * 100;
}

export function calculateSafetyScores(
  routes: SafetyRouteInput[]
): SafetyRouteResult[] {
  if (!routes.length) {
    return [];
  }

  const potholes = routes.map(
    (route) => route.potholeCount
  );

  const distances = routes.map(
    (route) => route.distance
  );

  const durations = routes.map(
    (route) => route.duration
  );

  const minPotholes = Math.min(...potholes);
  const maxPotholes = Math.max(...potholes);

  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);

  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  return routes.map((route) => {
    const potholeRisk = normalize(
      route.potholeCount,
      minPotholes,
      maxPotholes
    );

    const distanceRisk = normalize(
      route.distance,
      minDistance,
      maxDistance
    );

    const timeRisk = normalize(
      route.duration,
      minDuration,
      maxDuration
    );

    const riskScore =
      potholeRisk * 0.50 +
      distanceRisk * 0.30 +
      timeRisk * 0.20;

    const safetyScore = Math.max(
      0,
      Math.min(100, 100 - riskScore)
    );

    return {
      ...route,
      potholeRisk: Number(
        potholeRisk.toFixed(2)
      ),
      distanceRisk: Number(
        distanceRisk.toFixed(2)
      ),
      timeRisk: Number(
        timeRisk.toFixed(2)
      ),
      riskScore: Number(
        riskScore.toFixed(2)
      ),
      safetyScore: Number(
        safetyScore.toFixed(2)
      ),
    };
  });
}