import { useEffect, useState } from 'react';
import { AppHeader } from './components/dashboard/AppHeader';
import { BinarySensorCard } from './components/dashboard/BinarySensorCard';
import { ButtonCard } from './components/dashboard/ButtonCard';
import { ChipCard } from './components/dashboard/ChipCard';
import { ConnectScreen } from './components/dashboard/ConnectScreen';
import { ConnectionCard } from './components/dashboard/ConnectionCard';
import { CoordinatorCard } from './components/dashboard/CoordinatorCard';
import { EventsCard } from './components/dashboard/EventsCard';
import { FirmwareCard } from './components/dashboard/FirmwareCard';
import { NumericSensorCard } from './components/dashboard/NumericSensorCard';
import { TemperatureLightCard } from './components/dashboard/TemperatureLightCard';
import { TimerCard } from './components/dashboard/TimerCard';
import { TimerCreateCard } from './components/dashboard/TimerCreateCard';
import { useMiniBusLab } from './hardware/use-mini-bus-lab';

export function App() {
  const lab = useMiniBusLab();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (lab.connection !== 'connected') {
    return (
      <ConnectScreen
        connection={lab.connection}
        error={lab.connectionError}
        connect={lab.connect}
      />
    );
  }

  const lights = lab.entities.filter((entity) => entity.type === 0 && entity.subtype !== 35);
  const binarySensors = lab.entities.filter((entity) => entity.type === 1);
  const numericSensors = lab.entities.filter((entity) => entity.type === 2);
  const buttons = lab.entities.filter((entity) => entity.type === 3);

  return (
    <div className="app-shell">
      <AppHeader disconnect={lab.disconnect} />
      <main className="dashboard">
        <div className="primary-grid">
          <ConnectionCard port={lab.port} stats={lab.stats} now={now} />
          <CoordinatorCard
            network={lab.zigbeeNetwork}
            pairingEndsAt={lab.pairingEndsAt}
            now={now}
            setPairing={lab.setPairing}
            resetNetwork={lab.resetZigBeeNetwork}
          />
          <FirmwareCard
            boards={lab.boards}
            progress={lab.firmwareUpdate}
            update={lab.updateFirmware}
            clear={lab.clearFirmwareUpdate}
            activate={lab.activateFirmware}
          />
          {lab.boards.map((board) => (
            <ChipCard
              key={board.id}
              board={board}
              pingChip={lab.pingChip}
              rebootChip={lab.rebootChip}
            />
          ))}
        </div>

        <div className="entity-grid">
          {lights.map((entity) => (
            <TemperatureLightCard key={entity.id} entity={entity} setLight={lab.setLight} />
          ))}
          {binarySensors.map((entity) => (
            <BinarySensorCard key={entity.id} entity={entity} now={now} injectMotion={lab.injectMotion} />
          ))}
          {numericSensors.map((entity) => (
            <NumericSensorCard key={entity.id} entity={entity} now={now} />
          ))}
          {buttons.map((entity) => (
            <ButtonCard
              key={entity.id}
              entity={entity}
              now={now}
              injectButtonAction={lab.injectButtonAction}
            />
          ))}
        </div>

        <section className="dashboard-section" aria-labelledby="timers-title">
          <div className="section-heading">
            <h2 id="timers-title">Timers</h2>
            <span>{lab.timers.length} discovered</span>
          </div>
          <div className="entity-grid section-grid">
            <TimerCreateCard boards={lab.boards} startTimer={lab.startTimer} />
            {lab.timers.map((timer) => (
              <TimerCard
                key={timer.key}
                timer={timer}
                now={now}
                startTimer={lab.startTimer}
                cancelTimer={lab.cancelTimer}
              />
            ))}
          </div>
        </section>

        <EventsCard events={lab.events} getBusLog={lab.getBusLog} />
      </main>
    </div>
  );
}
