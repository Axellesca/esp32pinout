/**
 * Peripheral reference: default pin assignments, routing rules and the known traps.
 * Data only. Used by the info panel (peripheral context) and by the filter chip tooltips.
 * Prose is in Spanish, technical terms and datasheet identifiers stay in English.
 */

import { GPIO_MATRIX_QUOTE } from './gpio.js';

export const MATRIX_QUOTE = GPIO_MATRIX_QUOTE;

export const SERIAL_PORTS = [
  {
    id: 'uart0',
    name: 'UART0',
    ioMuxFixed: true,
    tx: 1,
    rx: 3,
    role: 'Consola y flasheo',
    notes: [
      'Fijado en el IO MUX: TX = GPIO1, RX = GPIO3. Ambos pads están conectados al puente ' +
        'USB-UART de la placa, así que no están libres para uso de la aplicación.',
      'Este es el puerto con el que hablan esptool y el monitor serie de Arduino.'
    ]
  },
  {
    id: 'uart1',
    name: 'UART1',
    ioMuxFixed: false,
    rx: 9,
    tx: 10,
    role: 'No utilizable en el WROOM-32',
    notes: [
      'El valor por defecto de hardware enruta UART1 a RX = GPIO9 (SD_DATA_2) y TX = GPIO10 ' +
        '(SD_DATA_3). En el ESP32-WROOM-32 ambos pads están unidos al SPI flash, así que el ' +
        'mapeo por defecto no puede funcionar.',
      'Consecuencia: el objeto Serial1 de arduino-esp32 no puede recibir en una placa WROOM-32. ' +
        'Enruta UART1 por la matriz GPIO a pines libres si lo necesitas.'
    ]
  },
  {
    id: 'uart2',
    name: 'UART2',
    ioMuxFixed: false,
    tx: 17,
    rx: 16,
    role: 'El puerto serie hardware "libre" recomendado',
    notes: [
      'Usa RX = GPIO16 y TX = GPIO17 por defecto, ambos libres en el WROOM-32 y ambos seguros en Arduino.',
      'Es el que usa Serial2 en el core arduino-esp32.'
    ]
  }
];

export const SPI_BUSES = [
  {
    id: 'vspi',
    name: 'VSPI (SPI en Arduino)',
    sck: 18,
    miso: 19,
    mosi: 23,
    cs: 5,
    role: 'Bus SPI por defecto',
    notes: [
      'El core arduino-esp32 mapea SPI a este bus. El CS es GPIO5 por defecto, que es un pin ' +
        'strapping con pull-up interno, así que el bus no funciona de forma libre sin un chip select.',
      'Las cuatro señales también se pueden enrutar a cualquier otro pin por la matriz GPIO.'
    ]
  },
  {
    id: 'hspi',
    name: 'HSPI (HSPI / SPI2)',
    sck: 14,
    miso: 12,
    mosi: 13,
    cs: 15,
    role: 'El segundo bus más usado',
    notes: [
      'HSPI CLK = GPIO14, MISO = GPIO12, MOSI = GPIO13, CS = GPIO15.',
      'Esta es exactamente la razón por la que HSPI es la opción popular: a diferencia de VSPI, ' +
        'ninguno de los cuatro pines choca con una función por defecto de un periférico, así que ' +
        'el bus está libre aunque los pines en sí necesiten cuidado.',
      'GPIO12 es MTDI (selección de la tensión del flash) y GPIO15 es MTDO (log de arranque). ' +
        'Trátalos con cuidado.'
    ]
  }
];

export const I2C_NOTES = [
  'En el ESP32 cualquier GPIO puede actuar como SDA o SCL mediante la matriz GPIO. No hay un ' +
    'requisito de pin dedicado para I2C.',
  'El valor por defecto de arduino-esp32 es SDA = GPIO21, SCL = GPIO22.',
  'Hacen falta resistencias pull-up externas (unos 4.7 kOhm a 3.3 V); los pulls internos de ' +
    'unos 45 kOhm son demasiado débiles para I2C.',
  'La restricción de que "el SDA debe ser un pin capaz de PWM/LEDC" aplica al ESP32-S2 y al ' +
    'ESP32-C3, NO al ESP32. No la apliques aquí.'
];

export const I2S_NOTES = [
  'No hay una asignación de pines I2S oficial de Espressif en el ESP32. Se puede usar cualquier GPIO.',
  'La única restricción real es el clock de bits: BCLK se maneja por CLK_OUT1, CLK_OUT2 y ' +
    'CLK_OUT3, que se corresponden con GPIO0, GPIO1 y GPIO3 respectivamente.',
  'Cualquier mapa de pines I2S del ESP32 publicado es una convención comunitaria, no un valor ' +
    'por defecto de Espressif. Trátalo como tal.'
];

export const MATRIX_PERIPHERALS = [
  {
    id: 'pcnt',
    name: 'PCNT (contador de pulsos)',
    note: 'Cualquier GPIO. Cuenta flancos en dos pines de señal por unidad; hay cuatro unidades en el ESP32.'
  },
  {
    id: 'twai',
    name: 'TWAI (bus CAN)',
    note: 'Cualquier GPIO. Dos pines por controlador: TX y RX.'
  },
  {
    id: 'rmt',
    name: 'RMT (control remoto)',
    note: 'Cualquier GPIO. Maneja unos pocos canales con temporización precisa en microsegundos.'
  },
  {
    id: 'ledc',
    name: 'LEDC / MCPWM (PWM)',
    note: 'Cualquier GPIO con salida. GPIO34-39 no tienen driver de salida, así que no pueden hacer ' +
      'PWM. LEDC es también el origen de la restricción de SDA de I2C en el ESP32-S2/C3, que no ' +
      'se aplica aquí.'
  },
  {
    id: 'sdm',
    name: 'SDM (modulación sigma-delta)',
    note: 'Cualquier GPIO con salida.'
  },
  {
    id: 'i2s',
    name: 'I2S',
    note: I2S_NOTES.join(' ')
  },
  {
    id: 'i2c',
    name: 'I2C',
    note: I2C_NOTES.join(' ')
  }
];

export const ADCCONFLICT_NOTES = [
  'Esto no es "ADC2 está roto". El bloque ADC2 está compartido con la radio Wi-Fi y solo un ' +
    'controlador lo puede usar a la vez, así que el perdedor expira.',
  'La firma del fallo es ESP_ERR_TIMEOUT devuelto por adc2_get_raw(), no una lectura errónea.',
  'ADC1 nunca se ve afectado por la radio. Si necesitas muestreo fiable con el Wi-Fi activo, usa ' +
    'ADC1 (GPIO32-39).',
  'En el ESP32-C6 y posteriores se cambió el hardware y ADC2 ya no entra en conflicto. Esta ' +
    'página modela el ESP32 original, donde sí lo hay.'
];

export const POWER_NOTES = [
  'Solo lógica de 3.3 V. El ESP32 no es tolerante a 5 V; la entrada absoluta máxima es ' +
    'VDD + 0.3 V = 3.9 V.',
  'Las resistencias pull-up y pull-down internas son de unos 45 kOhm.',
  'La corriente total acumulada máxima de salida IO es 1100 mA.',
  'Los pines strapping se muestrean en el reset, así que el hardware externo que conectes en ' +
    'ellos debe estabilizarse en tH >= 1 ms.'
];

/** Peripherals that can be routed to any pin, used for the generic panel section. */
export function matrixPeripheralList() {
  return MATRIX_PERIPHERALS.map((p) => `${p.name}: ${p.note}`);
}
