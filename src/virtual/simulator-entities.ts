import { kitchenEntityIds } from '../automations/kitchen-entities';

export const simulatorEntityIds = {
  ...kitchenEntityIds,
  motionSensor: kitchenEntityIds.kitchenLeftMotionSensor,
  lightSensor: kitchenEntityIds.kitchenLeftLightSensor,
  light: kitchenEntityIds.ambientLightGroup,
  button: kitchenEntityIds.masterButton
} as const;
