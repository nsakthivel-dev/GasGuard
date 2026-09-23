/*
 * ==============================================================================
 * GasGuard - Smart Gas Leak Detection Arduino Sketch
 * Target: Arduino Uno / Nano / Mega
 * Sensor: MQ-2 / MQ-5 / MQ-135 Gas Sensor
 * Output: Newline-delimited JSON over USB Serial (9600 baud)
 * ==============================================================================
 * 
 * Hardware Wiring:
 * ----------------
 * MQ-2 / MQ-5 Gas Sensor:
 *   - VCC  -> 5V
 *   - GND  -> GND
 *   - AOUT -> A0 (Analog 0)
 * 
 * Local Indicators (Optional):
 *   - Green LED (Safe)    -> Pin 13 (with 220 ohm resistor)
 *   - Red LED (Alert)     -> Pin 12 (with 220 ohm resistor)
 *   - Active Buzzer       -> Pin 8  (with 100 ohm resistor / direct)
 * 
 * Optional Temperature/Humidity:
 *   - LM35 or thermistor  -> A1 (or DHT11/22 sensor library)
 */

const int GAS_SENSOR_PIN = A0;
const int GREEN_LED_PIN = 13;
const int RED_LED_PIN = 12;
const int BUZZER_PIN = 8;

// Local hardware alarm threshold (standalone failsafe)
const int LOCAL_DANGER_THRESHOLD = 700;

// Telemetry transmit interval (in milliseconds)
const unsigned long TRANSMIT_INTERVAL_MS = 1000;
unsigned long lastTransmitTime = 0;

void setup() {
  // Initialize Serial at standard 9600 baud
  Serial.begin(9600);

  pinMode(GAS_SENSOR_PIN, INPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Power-on indicator
  digitalWrite(GREEN_LED_PIN, HIGH);
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // Allow sensor heater 2 seconds to warm up
  delay(1500);
}

void loop() {
  unsigned long currentTime = millis();

  // Read analog gas level (0 - 1023)
  // Takes multiple samples to average out electrical noise
  int rawGas = 0;
  for (int i = 0; i < 5; i++) {
    rawGas += analogRead(GAS_SENSOR_PIN);
    delay(5);
  }
  int gasValue = rawGas / 5;

  // Local hardware visual/sound failsafe
  if (gasValue >= LOCAL_DANGER_THRESHOLD) {
    digitalWrite(RED_LED_PIN, HIGH);
    digitalWrite(GREEN_LED_PIN, LOW);
    // Beep buzzer
    if ((currentTime / 250) % 2 == 0) {
      digitalWrite(BUZZER_PIN, HIGH);
    } else {
      digitalWrite(BUZZER_PIN, LOW);
    }
  } else {
    digitalWrite(RED_LED_PIN, LOW);
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, LOW);
  }

  // Periodic structured telemetry transmission
  if (currentTime - lastTransmitTime >= TRANSMIT_INTERVAL_MS) {
    lastTransmitTime = currentTime;

    // Send formatted newline-delimited JSON
    // Note: Ambient temperature/humidity can be read from DHT11 on digital pin if installed
    Serial.print("{\"gas\":");
    Serial.print(gasValue);
    Serial.print(",\"timestamp\":");
    Serial.print(currentTime);
    Serial.println("}");
  }
}
