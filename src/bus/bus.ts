export type BusRawMessage<TPayload = unknown> = {
  destination: string;
  group: number;
  type: number;
  payload?: TPayload;
  createdAtMs: number;
};

export type BusSendInput<TPayload = unknown> = {
  destination: string;
  group?: number;
  groupId?: number;
  type?: number;
  typeId?: number;
  payload?: TPayload;
  createdAtMs?: number;
};

export type BusListener = (message: BusRawMessage) => void;

export class Bus {
  private readonly listeners = new Set<BusListener>();

  send<TPayload>(input: BusSendInput<TPayload>) {
    const group = input.group ?? input.groupId;
    const type = input.type ?? input.typeId;

    if (typeof group !== 'number' || typeof type !== 'number') {
      throw new Error('Bus message requires group/type or groupId/typeId.');
    }

    const message: BusRawMessage<TPayload> = {
      destination: input.destination,
      group,
      type,
      payload: input.payload,
      createdAtMs: input.createdAtMs ?? Date.now()
    };

    const rawLog = `[bus.raw] ${JSON.stringify(message)}`;

    console.log(rawLog, message);

    for (const listener of this.listeners) {
      listener(message);
    }

    return message;
  }

  listen(listener: BusListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}
