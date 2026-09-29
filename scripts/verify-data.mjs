// Data truth-check. Asserts the source-verified facts against the shipped dataset.
// Run: node scripts/verify-data.mjs
import { GPIOS, getGpio, stateOf } from '../src/data/gpio.js';
import { HEADER_LEFT, HEADER_RIGHT, validateDataset } from '../src/data/boards.js';
import { SERIAL_PORTS, SPI_BUSES, I2C_NOTES, ADCCONFLICT_NOTES } from '../src/data/peripherals.js';

let fail = 0;
const ok = (label, cond, detail = '') => {
  if (!cond) { fail++; console.log(`FAIL  ${label}${detail ? '  -> ' + detail : ''}`); }
  else console.log(`ok    ${label}`);
};
const eq = (label, actual, expected) =>
  ok(label, JSON.stringify(actual) === JSON.stringify(expected),
     `got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`);

// ---- dataset integrity -------------------------------------------------
eq('validateDataset() reports no problems', validateDataset(), []);
eq('HEADER_LEFT length', HEADER_LEFT.length, 15);
eq('HEADER_RIGHT length', HEADER_RIGHT.length, 15);

// ---- ADC1: GPIO32-39 only ----------------------------------------------
const adc1 = Object.values(GPIOS).filter(p => p.adc?.unit === 'ADC1').map(p => p.gpio).sort((a, b) => a - b);
eq('ADC1 pins', adc1, [32, 33, 34, 35, 36, 37, 38, 39]);
const adc1ch = {};
Object.values(GPIOS).forEach(p => { if (p.adc?.unit === 'ADC1') adc1ch[p.adc.channel] = p.gpio; });
eq('ADC1 channel map', adc1ch, { 0: 36, 1: 37, 2: 38, 3: 39, 4: 32, 5: 33, 6: 34, 7: 35 });

// ---- ADC2: exactly the 10 documented pins -------------------------------
const adc2 = Object.values(GPIOS).filter(p => p.adc?.unit === 'ADC2').map(p => p.gpio).sort((a, b) => a - b);
eq('ADC2 pins', adc2, [0, 2, 4, 12, 13, 14, 15, 25, 26, 27]);
const adc2ch = {};
Object.values(GPIOS).forEach(p => { if (p.adc?.unit === 'ADC2') adc2ch[p.adc.channel] = p.gpio; });
eq('ADC2 channel map', adc2ch, { 0: 4, 1: 0, 2: 2, 3: 15, 4: 13, 5: 12, 6: 14, 7: 27, 8: 25, 9: 26 });

// ---- no ADC on these ---------------------------------------------------
[1, 3, 5, 16, 17, 18, 19, 21, 22, 23].forEach(g =>
  ok(`GPIO${g} has no ADC`, GPIOS[g].adc === null || GPIOS[g].adc === undefined));

// ---- exactly TWO DAC channels, no DAC3 ----------------------------------
const dac = Object.values(GPIOS).filter(p => p.dac).map(p => p.gpio).sort((a, b) => a - b);
eq('DAC pins (no DAC3, GPIO18 is not a DAC)', dac, [25, 26]);
ok('GPIO18 is not a DAC', !GPIOS[18].dac);

// ---- touch: GPIO34/35/36/39 have none ----------------------------------
[34, 35, 36, 39].forEach(g =>
  ok(`GPIO${g} has no touch function`, GPIOS[g].touch === null || GPIOS[g].touch === undefined));
const touch = {};
Object.values(GPIOS).forEach(p => { if (p.touch !== null && p.touch !== undefined) touch[p.touch] = p.gpio; });
eq('TOUCH0-9 map', touch, { 0: 4, 1: 0, 2: 2, 3: 15, 4: 13, 5: 12, 6: 14, 7: 27, 8: 33, 9: 32 });

// ---- header membership --------------------------------------------------
const onHeaderSet = new Set([...HEADER_LEFT, ...HEADER_RIGHT]
  .filter(p => p.type === 'gpio').map(p => p.gpio));

// ---- nonexistent GPIOs on the SoC --------------------------------------
// The bare ESP32 has 34 GPIOs: 0-19, 21-23, 25-27, 32-39. These six do not exist at all.
[20, 24, 28, 29, 30, 31].forEach(g =>
  ok(`GPIO${g} does not exist on the SoC`, GPIOS[g]?.direction === 'absent', GPIOS[g]?.direction));
// GPIO37/38 exist in the silicon but are NOT bonded out on the WROOM-32 module.
// The user-facing reason is prose and lives in Spanish, so the guard checks the structure
// (the flag, the direction, a non-empty reason) plus the one language-independent token the
// reason must name: the module it is not bonded out on.
[37, 38].forEach(g =>
  ok(`GPIO${g} is not bonded out on the module`,
     GPIOS[g]?.direction === 'absent' &&
     GPIOS[g]?.flags?.notBonded === true &&
     typeof GPIOS[g]?.reasons?.notExposed === 'string' &&
     GPIOS[g].reasons.notExposed.length > 20 &&
     /WROOM-32/.test(GPIOS[g].reasons.notExposed),
     GPIOS[g]?.reasons?.notExposed));
ok('ESP32 SoC exposes 34 GPIOs (32 bonded out on WROOM-32)',
   Object.values(GPIOS).filter(p => p.direction !== 'absent').length === 32,
   String(Object.values(GPIOS).filter(p => p.direction !== 'absent').length));

// ---- input-only, no pulls ---------------------------------------------
[34, 35, 36, 39].forEach(g =>
  ok(`GPIO${g} is input-only`, GPIOS[g].direction === 'input-only', GPIOS[g].direction));
ok('GPIO37/38 keep their ADC1 channel but are not bonded out',
   GPIOS[37].adc?.unit === 'ADC1' && GPIOS[38].adc?.unit === 'ADC1');

// ---- flash pins unusable ----------------------------------------------
[6, 7, 8, 9, 10, 11].forEach(g =>
  ok(`GPIO${g} is internal-only (flash)`, GPIOS[g].direction === 'internal-only', GPIOS[g].direction));
ok('GPIO6-11 are not header positions', ![6, 7, 8, 9, 10, 11].some(g => onHeaderSet.has(g)));
ok('GPIO13 is bidirectional (not a strapping pin)', GPIOS[13].direction === 'bidirectional');
ok('GPIO14 is bidirectional (not a strapping pin)', GPIOS[14].direction === 'bidirectional');

// ---- strapping: exactly these five -------------------------------------
const strap = Object.values(GPIOS).filter(p => p.strapping).map(p => p.gpio).sort((a, b) => a - b);
eq('strapping pins', strap, [0, 2, 5, 12, 15]);
[0, 2, 5, 12, 15].forEach(g =>
  ok(`GPIO${g} states both boot states`,
     !!GPIOS[g].strapping?.high && !!GPIOS[g].strapping?.low, JSON.stringify(GPIOS[g].strapping)));
// Every strapping pin must carry all four explanatory fields, as real prose rather than a
// placeholder: the role, the board default and the consequence of each boot level.
ok('every strapping pin has non-empty role, boardDefault, high and low',
   strap.every(g => {
     const s = GPIOS[g].strapping;
     return [s.role, s.boardDefault, s.high, s.low].every((v) => typeof v === 'string' && v.trim().length > 5);
   }),
   strap.filter(g => ![GPIOS[g].strapping.role, GPIOS[g].strapping.boardDefault,
     GPIOS[g].strapping.high, GPIOS[g].strapping.low].every((v) => typeof v === 'string' && v.trim().length > 5))
     .join(','));

// MTDI is GPIO12 and MTDO is GPIO15. Nothing else may claim those JTAG pad names.
eq('only GPIO12 is MTDI',
   Object.values(GPIOS).filter(p => /MTDI/.test(p.strapping?.role || '')).map(p => p.gpio), [12]);
eq('only GPIO15 is MTDO',
   Object.values(GPIOS).filter(p => /MTDO/.test(p.strapping?.role || '')).map(p => p.gpio), [15]);
eq('GPIO12 role names the flash supply', /VDD_SDIO/.test(GPIOS[12].strapping.role), true);

// The panel has to show the datasheet pad names verbatim, so the names must survive in the data.
// These four pins are the ones the UI was paraphraseing: MTDO and MTDI were stored as "JTAG TDO"
// / "JTAG TDI" and the DAC/ADC pair reaches the panel as ADC2_CH8. A role string that no longer
// starts with the pad name would be invisible to the reader of the panel.
ok('GPIO12 carries the datasheet pad name MTDI', GPIOS[12].roles.jtag.includes('MTDI (JTAG TDI)'),
   JSON.stringify(GPIOS[12].roles.jtag));
ok('GPIO15 carries the datasheet pad name MTDO', GPIOS[15].roles.jtag.includes('MTDO (JTAG TDO)'),
   JSON.stringify(GPIOS[15].roles.jtag));
ok('GPIO2 carries HSPIWP, not the VSPI chip select', GPIOS[2].roles.spi.includes('HSPIWP'),
   JSON.stringify(GPIOS[2].roles.spi));
ok('GPIO5 carries VSPICS0', GPIOS[5].roles.spi.some((r) => r.startsWith('VSPICS0')),
   JSON.stringify(GPIOS[5].roles.spi));
ok('the four JTAG pads of GPIO12-15 all carry the datasheet name first',
   [12, 13, 14, 15].every((g) => GPIOS[g].roles.jtag.every((r) => /^(MTDI|MTDO|MTCK|MTMS)\b/.test(r))),
   [12, 13, 14, 15].map((g) => `${g}:${GPIOS[g].roles.jtag.join('|')}`).join(' '));
// The prose is Spanish, so the boot-failure guard asserts the language-independent facts that
// make it a failure: the HIGH state is 1.8 V while the module flash is 3.3 V.
const g12high = GPIOS[12].strapping.high;
ok('GPIO12 HIGH states the 1.8 V flash supply that stops the boot',
   /1\.8/.test(g12high) && /3\.3/.test(g12high), g12high);
ok('GPIO12 LOW states the correct 3.3 V default',
   /3\.3/.test(GPIOS[12].strapping.low), GPIOS[12].strapping.low);

// Every restriction must explain itself: a non-empty title and a non-empty detail.
ok('every restriction of every pin has a title and a detail',
   Object.values(GPIOS).every(p => p.restrictions.every(r =>
     typeof r.title === 'string' && r.title.trim().length > 3 &&
     typeof r.detail === 'string' && r.detail.trim().length > 10)),
   Object.values(GPIOS).flatMap(p => p.restrictions.filter(r =>
     !(r.title && r.title.trim().length > 3 && r.detail && r.detail.trim().length > 10))
     .map(r => `GPIO${p.gpio}: ${r.title}`)).join('; '));

// ---- GPIO0 not on the 30-pin header, but present and badged ------------
ok('GPIO0 exists in the dataset', GPIOS[0] !== undefined);
ok('GPIO0 is NOT a header position', !onHeaderSet.has(0));
ok('GPIO0 explains why it has no header position',
   typeof getGpio(0).reasons?.notExposed === 'string' &&
   getGpio(0).reasons.notExposed.length > 20 &&
   /header/.test(getGpio(0).reasons.notExposed),
   getGpio(0).reasons?.notExposed);
ok('header exposes exactly 25 GPIOs', onHeaderSet.size === 25, String(onHeaderSet.size));

// ---- header rails -------------------------------------------------------
const rails = [...HEADER_LEFT, ...HEADER_RIGHT].filter(p => p.type === 'rail').map(p => p.id);
eq('header rail positions', rails.sort(), ['3V3', 'EN', 'GND', 'GND', 'VIN']);

// ---- Arduino aliases: A1/A2/A8/A9 must not exist ------------------------
[1, 2, 8, 9].forEach(a =>
  ok(`A${a} is not offered`, !Object.values(GPIOS).some(p => p.arduino === `A${a}`)));
const a18 = GPIOS[25].arduino, a19 = GPIOS[26].arduino;
ok('GPIO25 -> A18', a18 === 'A18', String(a18));
ok('GPIO26 -> A19', a19 === 'A19', String(a19));
ok('GPIO36 -> A0', GPIOS[36].arduino === 'A0', GPIOS[36].arduino);
ok('GPIO13 -> A14', GPIOS[13].arduino === 'A14', GPIOS[13].arduino);

// ---- stateOf reflects the safety model ---------------------------------
ok('GPIO13 is safe', stateOf(GPIOS[13]) === 'safe', stateOf(GPIOS[13]));
ok('GPIO12 is strapping', stateOf(GPIOS[12]) === 'strapping', stateOf(GPIOS[12]));
ok('GPIO34 is input-only', stateOf(GPIOS[34]) === 'input-only', stateOf(GPIOS[34]));
ok('GPIO9 is flash/unusable', stateOf(GPIOS[9]) === 'flash', stateOf(GPIOS[9]));

// ---- peripheral defaults -------------------------------------------------
const uart = Object.fromEntries(SERIAL_PORTS.map(p => [p.name, p]));
eq('UART0 tx/rx (fixed in IO MUX)', { tx: uart.UART0.tx, rx: uart.UART0.rx }, { tx: 1, rx: 3 });
// Espressif IO_MUX: U1RXD = pad 28 = GPIO9 (SD_DATA_2), U1TXD = pad 29 = GPIO10 (SD_DATA_3)
eq('UART1 rx/tx (was inverted)', { rx: uart.UART1.rx, tx: uart.UART1.tx }, { rx: 9, tx: 10 });
eq('UART2 rx/tx', { rx: uart.UART2.rx, tx: uart.UART2.tx }, { rx: 16, tx: 17 });

const bus = Object.fromEntries(SPI_BUSES.map(b => [b.id, b]));
const v = bus.vspi, h = bus.hspi;
eq('VSPI sck/miso/mosi/cs', [v.sck, v.miso, v.mosi, v.cs], [18, 19, 23, 5]);
eq('HSPI sck/miso/mosi/cs', [h.sck, h.miso, h.mosi, h.cs], [14, 12, 13, 15]);

// I2C on ESP32: any GPIO, default 21/22. The LEDC/PWM-source rule is an S2/C3 rule, not ESP32.
// The notes are Spanish prose, so the guards assert the language-independent tokens they must
// name: the signal names, the Arduino default pins, and the two chips the LEDC rule applies to.
const i2cText = I2C_NOTES.join(' ');
ok('I2C documents any-GPIO routing on ESP32',
   /GPIO/.test(i2cText) && /SDA/.test(i2cText) && /SCL/.test(i2cText), i2cText.slice(0, 90));
ok('I2C scopes the LEDC rule to the S2/C3 chips only',
   /LEDC/.test(i2cText) && /ESP32-S2/.test(i2cText) && /ESP32-C3/.test(i2cText), i2cText.slice(0, 240));
ok('I2C documents the 21/22 default', /GPIO21/.test(i2cText) && /GPIO22/.test(i2cText));
ok('I2C states the external pull-up requirement', /4\.7 kOhm/.test(i2cText));

// ADC2 vs Wi-Fi must be arbitration/timeout, NOT "ADC2 is unusable".
// Language-independent markers: the error code the driver returns and the ADC1 carve-out.
const conflict = ADCCONFLICT_NOTES.join(' ');
ok('ADC2 conflict described as arbitration/timeout',
   /ESP_ERR_TIMEOUT/.test(conflict) && /adc2_get_raw/.test(conflict), conflict.slice(0, 120));
ok('ADC2 conflict is NOT stated as flatly unusable',
   !/(cannot|can not|impossible) (be )?(use|read)/i.test(conflict) && /Wi-Fi/.test(conflict));
ok('ADC1 stated as unaffected by Wi-Fi', /ADC1/.test(conflict) && /GPIO32-39/.test(conflict));
ok('the contention is scoped to the original ESP32, not the C6 and later',
   /ESP32-C6/.test(conflict), conflict.slice(-120));

console.log(fail ? `\n${fail} FAILED` : '\nAll data assertions passed.');
process.exit(fail ? 1 : 0);
