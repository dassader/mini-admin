import type { BusRawMessage } from './bus';

export type BusEntityId = number;

export const BUS_DESTINATION_BROADCAST = 'FF:FF:FF:FF:FF:FF';
export const BUS_DESTINATION_RESERVED = '00:00:00:00:00:00';
export const SIMULATOR_BOARD_ID = '00:00:00:00:00:01';

export function acceptsDestination(
  message: BusRawMessage,
  board = SIMULATOR_BOARD_ID
) {
  const destination = normalizeBoardId(message.destination);

  return (
    destination === BUS_DESTINATION_BROADCAST ||
    destination === normalizeBoardId(board)
  );
}

export function isValidEntityId(entityId: unknown): entityId is BusEntityId {
  return (
    typeof entityId === 'number' &&
    Number.isSafeInteger(entityId) &&
    entityId >= 0
  );
}

export function normalizeBoardId(board: string) {
  return board.toUpperCase();
}
