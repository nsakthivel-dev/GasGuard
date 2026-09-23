# GasGuard - Smart Gas Leak Detection & Safety Monitoring System

> **Safety Notice & Disclaimer**: Sensor values are indicative and depend on proper calibration, ambient ventilation, and sensor operating conditions. This application does not guarantee detection, prevention, or absolute safety. Always adhere to standard gas safety protocols and immediately evacuate and contact emergency authorities if you suspect a gas leak.

A production-ready, mobile-first Progressive Web App (PWA) that connects directly to an **Arduino Uno + Gas Sensor** (via the browser's Web Serial API) and is architected to seamlessly transition to **ESP32 / Wi-Fi** without modifying the dashboard UI.

---

## 1. Features

- 📱 **Mobile-First Progressive Web App (PWA)**:
  - Bottom navigation bar tailored for mobile touch ergonomics (>= 44px touch targets).
  - Standalone home screen experience with custom PWA install banner and iOS Safari guide.
  - Offline-capable service worker pre-caching.
- 🔌 **Hardware Abstraction Layer (`GasDevice`)**:
  - `ArduinoUnoSerialDevice`: Direct USB connection via the browser's native Web Serial API (`navigator.serial`).
  - Automatic reconnection using previously authorized ports (`serial.getPorts()`).
  - `ESP32WifiDevice`: Extensible WebSocket/HTTP driver ready for future wireless IoT nodes.
- 🚨 **Multi-Tier Safety & Alert Engine**:
  - Configurable Warning (`400 ADC`) and Danger (`700 ADC`) thresholds.
  - Hysteresis and cooldown timers to eliminate false fluttering and repeated alert spam.
  - Dual-tone emergency siren synthesizer using the browser's Web Audio API (no external MP3/audio files needed).
  - Web Vibration API haptic pulses (`[500, 250, 500, 500]`).
  - High-priority full-screen emergency overlay with **[ ACKNOWLEDGE ALERT ]** button and actionable evacuation steps.
- 📈 **Telemetry & History Graph**:
  - Interactive responsive timeline chart with time filters (`Live`, `1h`, `6h`, `24h`, `7d`, `30d`).
  - Tap/hover tooltip displaying gas ADC value, timestamp, temperature, and humidity.
  - Statistical summaries (Min, Max, Baseline Average, Elevated reading count).
- ☁️ **Cloud Database & Offline Resilience**:
  - Supabase PostgreSQL persistence for devices, telemetry, alerts, and settings.
  - IndexedDB offline queue that buffers telemetry when offline and auto-syncs upon reconnection.
  - Telemetry sampling and rate-limiting to prevent cloud database bloat.
  - Full local-only fallback mode if Supabase credentials are not configured.

---

## 2. Architecture & Data Flow

```text
Hardware Layer (Arduino Uno USB Serial / ESP32 Wi-Fi)
      ↓
Hardware Abstraction Interface (GasDevice)
      ↓
Sensor Service & Sampling Aggregator (Line reader, JSON parser, buffer)
      ↓
Safety/Alert Engine (Threshold state machine, Web Audio siren, vibration)
      ↓
Application State (React Context / LocalStorage)
      ↓
UI Layer (Mobile-first Bottom Nav / Desktop Responsive Dashboard)
      ↓
Cloud Persistence (Supabase Client + IndexedDB Offline Sync Queue)
```

---

## 3. Project Structure

```text
Gas/
├── arduino/
│   └── gas_leak_detector.ino       # Production Arduino C++ sketch
├── public/
│   ├── favicon.svg                 # App SVG icon
│   ├── gas-icon-192.png            # PWA 192x192 icon
│   ├── gas-icon-512.png            # PWA 512x512 icon
│   └── apple-touch-icon.png        # iOS home screen icon
├── src/
│   ├── components/
│   │   ├── AlarmOverlay.tsx        # High-priority full-screen emergency alert modal
│   │   ├── AlertsView.tsx          # Incident logs and multi-dimensional filters
│   │   ├── DeviceView.tsx          # USB Web Serial connection and hardware switcher
│   │   ├── HistoryView.tsx         # Responsive SVG telemetry chart & statistics
│   │   ├── HomeView.tsx            # Live safety card, metric tiles, safety notice
│   │   ├── InstallPrompt.tsx       # PWA home screen installation banner
│   │   ├── Navigation.tsx          # Mobile bottom bar & desktop left rail
│   │   └── SettingsView.tsx        # Threshold sliders, sirens, Supabase config, CSV export
│   ├── hardware/
│   │   ├── ArduinoUnoSerialDevice.ts # Web Serial driver with newline JSON reader
│   │   ├── ESP32WifiDevice.ts        # Extensible Wi-Fi WebSocket driver
│   │   ├── GasDevice.ts              # Core hardware abstraction interface
│   │   ├── index.ts                  # Module exports
│   │   └── webSerialTypes.ts         # TypeScript definitions for navigator.serial
│   ├── lib/
│   │   ├── offlineSync.ts          # IndexedDB offline queue & rate sampling
│   │   └── supabase.ts             # Supabase client and query helpers
│   ├── services/
│   │   ├── AlertEngine.ts          # Safety state machine & threshold evaluator
│   │   ├── audioAlarm.ts           # Web Audio API emergency synthesizer
│   │   ├── notificationService.ts  # Vibration and browser push notification service
│   │   └── SensorService.ts        # Coordinator between hardware, alerts, and UI
│   ├── types/
│   │   └── index.ts                # TypeScript types (SensorReading, AlertRecord, etc.)
│   ├── App.tsx                     # Main layout & state orchestrator
│   ├── index.css                   # Tailwind CSS styling & custom scrollbars
│   └── main.tsx                    # React application entry point
├── supabase_schema.sql             # PostgreSQL tables, indexes, and RLS policies
├── vercel.json                     # Vercel deployment and SPA routing rules
├── vite.config.ts                  # Vite + VitePWA service worker configuration
├── tailwind.config.js              # Tailwind theme, colors, and keyframe animations
└── package.json                    # Dependencies and build scripts
```

---

## 4. Hardware Wiring & Arduino Setup

### Required Components
- Arduino Uno / Nano / Mega
- MQ-2 / MQ-5 / MQ-135 Combustible Gas Sensor
- USB cable (USB-A to USB-B or Type-C adapter)
- Optional: Green LED (Pin 13), Red LED (Pin 12), Active Buzzer (Pin 8)

### Wiring Diagram
| MQ-2 Gas Sensor Pin | Arduino Uno Pin |
|---|---|
| **VCC** | **5V** |
| **GND** | **GND** |
| **AOUT** | **A0 (Analog In)** |

### Flashing the Arduino Sketch
1. Open [`arduino/gas_leak_detector.ino`](file:///c:/Users/nsakt/Downloads/Gas/arduino/gas_leak_detector.ino) in the Arduino IDE.
2. Select Board: **Arduino Uno** and your USB Port.
3. Click **Upload**.
4. The onboard LED will illuminate. Open the Serial Monitor at **9600 baud** to confirm newline-delimited JSON output.

### Arduino Telemetry Protocol
The Arduino continuously transmits newline-delimited JSON at 9600 baud:
```json
{"gas":420,"timestamp":12345}
```
*Optional Temperature/Humidity support:*
```json
{"gas":420,"temperature":26.8,"humidity":59.2,"timestamp":12345}
```

---

## 5. Web Serial Connection Flow

### First Time Setup
1. Open GasGuard in a Web Serial-capable browser (Google Chrome, Microsoft Edge, Opera, or Chrome for Android with USB-OTG adapter).
2. Go to the **Device** tab and click **Connect Device**.
3. A browser security dialog will appear listing available USB serial devices.
4. Select your **Arduino Uno (COM port / /dev/ttyUSB*)** and click **Connect**.
5. Once authorized, GasGuard opens the serial port and streams live telemetry to the dashboard.

### Returning User
GasGuard checks `navigator.serial.getPorts()` for previously authorized devices and reconnects automatically without showing permission prompts every session.

---

## 6. Cloud Database Setup (Supabase)

1. Create a free project at [Supabase](https://supabase.com).
2. Navigate to the **SQL Editor** tab in your Supabase dashboard.
3. Open [`supabase_schema.sql`](file:///c:/Users/nsakt/Downloads/Gas/supabase_schema.sql) and paste the contents into the editor, then click **Run**.
4. Retrieve your **Project URL** and **Anon Public Key** from *Project Settings > API*.
5. You can configure them either:
   - In `.env.local`:
     ```env
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
     ```
   - Or directly in the **Settings** tab inside the GasGuard UI at runtime.

---

## 7. Vercel Deployment

GasGuard is pre-configured with `vercel.json` for zero-configuration Vercel deployment:

1. Push this repository to GitHub or GitLab.
2. Go to [Vercel Dashboard](https://vercel.com/new) and click **Add New Project**.
3. Import your repository.
4. (Optional) Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**.
6. Vercel will run `npm run build` and output the production PWA to the edge network.

---

## 8. Installing the PWA on Mobile

### Android (Chrome / Edge / Samsung Internet)
1. Open the deployed Vercel URL in Chrome.
2. Tap the **Install App** button at the top banner or select **Install app** from the Chrome three-dot menu.
3. The app will install directly to your app drawer and home screen.

### iOS (Safari)
1. Open the deployed Vercel URL in Safari.
2. Tap the **Share** button (box with an upward arrow) in the Safari bottom bar.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** in the top right.
5. Launch GasGuard from your home screen for full-screen standalone execution.

---

## 9. Known Browser & Hardware Limitations

1. **Web Serial Support**:
   - Web Serial is supported natively in Chromium-based browsers (Desktop Chrome, Edge, Opera, and Chrome on Android via USB-OTG).
   - Apple iOS (Safari / WebKit) does not support Web Serial due to platform security restrictions. For iPhone/iPad users, the **ESP32 Wi-Fi** driver should be selected in the **Device** tab.
2. **Background Execution**:
   - Mobile browsers throttle CPU and audio when the screen is locked or the tab is in the background. GasGuard utilizes system notifications and persistent service worker caching, but standalone physical buzzers on the Arduino (Pin 8) act as an essential hardware failsafe.
