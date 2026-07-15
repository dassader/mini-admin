export type VirtualDeviceListener = () => void;

export class VirtualDeviceEvents {
  private readonly listeners = new Set<VirtualDeviceListener>();

  subscribe(listener: VirtualDeviceListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  protected notifyListeners() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
