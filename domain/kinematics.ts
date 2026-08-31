import { Entity } from '../types';
import { getDestinationPoint, distanceBetween, bearingBetween } from '../utils/geo';

const KNOTS_TO_M_S = 0.514444;

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;

const angleDifference = (current: number, target: number): number => {
  const diff = normalizeAngle(target - current);
  if (Math.abs(diff) < 0.1) return 0;
  return diff > 180 ? diff - 360 : diff;
};

export const stepEntity = (entity: Entity, dtSeconds: number): Entity => {
  if (!entity.speed && !entity.targetSpeed) return entity;

  let { lat, lon } = entity.position;
  let currentSpeed = entity.speed || 0;
  let currentHeading = entity.heading || 0;
  let targetHeading = entity.targetHeading ?? currentHeading;
  const targetSpeed = entity.targetSpeed ?? currentSpeed;
  const turnRate = entity.turnRate || 3.0;
  const acceleration = entity.acceleration || 5.0;

  let waypoints = entity.waypoints ? [...entity.waypoints] : undefined;
  if (waypoints && waypoints.length > 0) {
    const nextWp = waypoints[0];
    const distToWp = distanceBetween(lat, lon, nextWp.lat, nextWp.lon);

    if (distToWp < 200) {
      waypoints.shift();
      if (waypoints.length === 0) waypoints = undefined;
    } else {
      targetHeading = bearingBetween(lat, lon, nextWp.lat, nextWp.lon);
    }
  }

  if (entity.continuousTurn) {
    const change = turnRate * dtSeconds;
    currentHeading += (entity.continuousTurn === 'R' ? 1 : -1) * change;
    currentHeading = normalizeAngle(currentHeading);
    targetHeading = currentHeading;
  } else {
    const turnDiff = angleDifference(currentHeading, targetHeading);
    if (turnDiff !== 0) {
      const change = turnRate * dtSeconds;
      if (Math.abs(turnDiff) < change) {
        currentHeading = targetHeading;
      } else {
        currentHeading += Math.sign(turnDiff) * change;
      }
      currentHeading = normalizeAngle(currentHeading);
    }
  }

  if (Math.abs(currentSpeed - targetSpeed) > 0.1) {
    const speedDir = Math.sign(targetSpeed - currentSpeed);
    const speedChange = acceleration * dtSeconds;

    if (Math.abs(targetSpeed - currentSpeed) < speedChange) {
      currentSpeed = targetSpeed;
    } else {
      currentSpeed += speedDir * speedChange;
    }
    if (currentSpeed < 0) currentSpeed = 0;
  }

  if (currentSpeed > 0) {
    const distanceMeters = currentSpeed * KNOTS_TO_M_S * dtSeconds;
    const newPos = getDestinationPoint(lat, lon, distanceMeters, currentHeading);
    lat = newPos.lat;
    lon = newPos.lon;
  }

  return {
    ...entity,
    position: { lat, lon },
    heading: currentHeading,
    targetHeading,
    speed: currentSpeed,
    targetSpeed,
    waypoints,
  };
};
