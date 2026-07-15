# Mini Bus Lab

Локальное mobile-first React + TypeScript приложение для диагностики и управления Mini Hardware Bus и ZigBee-сетью прямо из Chrome. На компьютере используется Web Serial, на Android — WebUSB.

Рабочая версия: <https://dassader.github.io/mini-admin/>

## Что умеет

- запрашивает serial-устройство через системный Chrome picker;
- открывает порт как `115200 8N1`;
- выполняет discovery плат и периодический автоопрос;
- читает system status, bus adapters и состояние ZigBee coordinator;
- обнаруживает high-level `Light`, `BinarySensor` и `NumericSensor` entities;
- показывает RX/TX traffic, live event journal, CRC и parse errors;
- открывает и закрывает ZigBee pairing с обратным отсчётом;
- управляет warm/cold каналами каждого света;
- отправляет typed synthetic motion publication для проверки automation chain;
- фильтрует события, хранит вращающийся буфер из 350 записей и экспортирует его в JSON;
- собирается в один standalone `dist/index.html`.

## Запуск

```bash
npm install
npm run dev
```

Проект принудительно использует публичный npm registry через локальный `.npmrc`. Значения из пользовательского или корпоративного npm-конфига для registry не требуются.

Откройте `http://127.0.0.1:5173` в Chrome и нажмите «Подключить устройство».

Доступ к USB требует secure context (`localhost` или HTTPS). Один USB serial port может принадлежать только одному процессу. Если плата уже открыта `mini-service-bus-mcp`, сначала отключите transport в MCP, затем выбирайте устройство в браузере.

## Android

Для проводного подключения на телефоне нужны Chrome, поддержка USB Host/OTG, OTG-переходник при необходимости и USB-кабель с передачей данных. Откройте [опубликованную HTTPS-версию](https://dassader.github.io/mini-admin/), подключите плату, нажмите «Подключить устройство» и разрешите Chrome доступ к USB в системном окне Android.

На Android приложение использует Web Serial API polyfill поверх WebUSB и выбирает USB CDC ACM устройство Espressif `303A:1001`. Порт по-прежнему открывается как `115200 8N1`; формат, команды и байты протокола Mini Bus не изменялись.

## Проверенный hardware profile

- board `58:E6:C5:14:36:C0`;
- serial `/dev/cu.usbmodem1101`, `115200`;
- ZigBee channel `11`, PAN `0x3370`;
- 7 ZigBee devices;
- 11 high-level entities: 4 lights, button, 3 motion и 3 illuminance sensors.

Через MCP подтверждён automation flow: synthetic kitchen-left motion → чтение `25 lux` → adaptive mode → три светильника и group light на `15%` (`warmLevel=38`).

## Команды

```bash
npm run dev
npm run typecheck
npm run build
npm run preview
```

`npm run build` создаёт один файл `dist/index.html` без внешних runtime assets и копирует тестовый образ прошивки из `public/firmware.bin`.

## GitHub Pages

Каждый push в `main` запускает `.github/workflows/deploy-pages.yml`: зависимости устанавливаются из `registry.npmjs.org`, выполняются type-check и production-сборка, после чего `dist` публикуется в GitHub Pages.
