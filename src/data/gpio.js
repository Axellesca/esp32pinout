/**
 * Per-GPIO capability dataset for the ESP32-WROOM-32 (34 GPIOs).
 *
 * DATA IS FACT-CHECKED AGAINST PRIMARY ESPressif SOURCES. Do not "correct" it by
 * intuition: three widely repeated community assumptions are known to be WRONG and are
 * encoded correctly here (see CORRECTIONS below).
 *
 * CORRECTION 1 - ADC1 is GPIO32..GPIO39 only (8 channels). ADC2 is GPIO 0, 2, 4, 12, 13,
 *              14, 15, 25, 26, 27 (10 channels). The "ADC1 = even, ADC2 = odd" intuition
 *              is false.
 * CORRECTION 2 - The ESP32 has exactly TWO DAC channels: DAC1 = GPIO25, DAC2 = GPIO26.
 *              There is no DAC3 and GPIO18 is not a DAC pin.
 * CORRECTION 3 - GPIO34, 35, 36 and 39 have NO touch function. They are also input only
 *              and have no internal pull resistors. Touch CH0..CH9 = GPIO 4, 0, 2, 15,
 *              13, 12, 14, 27, 33, 32.
 *
 * Field reference
 *   adc        : { unit: 'ADC1'|'ADC2', channel: n } | null
 *   touch      : touch channel number | null   (null is meaningful: 34/35/36/39 have none)
 *   dac        : 1 | 2 | null
 *   direction  : 'bidirectional' | 'input-only' | 'internal-only' | 'absent'
 *   strapping  : { role, boardDefault, high, low } | null
 *   roles      : named multiplexing roles grouped by subsystem
 *   flags      : cross-cutting attributes consumed by filters, legend and warnings
 *   reasons    : { notExposed: why this pin has no header position on the board }
 */

/** Short source ids, rendered in the UI provenance panel. */
export const SOURCES = {
  series: 'ESP32 Series Datasheet (Espressif)',
  wroom: 'ESP32-WROOM-32 Datasheet v3.7 (Espressif)',
  idfAdc: 'ESP-IDF ADC documentation (Espressif)',
  idfGpio: 'ESP-IDF GPIO documentation (Espressif)',
  idfDac: 'ESP-IDF DAC documentation (Espressif)',
  idfTouch: 'ESP-IDF cap_touch_sens documentation (Espressif)',
  devkitc: 'ESP32-DevKitC V4 User Guide and schematic (Espressif)',
  doit: 'DOIT ESP32 DEVKIT V1 schematic silkscreen layer',
  variants: 'arduino-esp32 variants/esp32/pins_arduino.h',
  esptool: 'esptool boot-mode documentation (boot strapping)'
};

/** The GPIO matrix sentence, quoted from the ESP32 series datasheet. */
export const GPIO_MATRIX_QUOTE =
  'Through IO MUX, RTC IO MUX and the GPIO matrix, peripheral input signals can be from ' +
  'any IO pins, and peripheral output signals can be routed to any IO pins.';

export const ELECTRICAL = {
  logic: 'Solo 3.3 V. El ESP32 NO es tolerante a 5 V.',
  absMax: 'Tensión de entrada absoluta máxima = VDD + 0.3 V = 3.9 V. Diseña para 3.3 V.',
  pulls: 'Las resistencias pull-up y pull-down internas son de unos 45 kOhm.',
  ioCurrent: 'Corriente total acumulada máxima de salida IO: 1100 mA.',
  strappingHold: 'Los pines strapping se muestrean en el reset; el tiempo de mantenimiento tH debe ser >= 1 ms.',
  adcAttenuation:
    'La atenuación por defecto del ADC en ESP-IDF es 11 dB. Elige una atenuación menor para más ' +
    'resolución o mayor para más rango; el rango de entrada útil es de unos 0..3.1 V a 11 dB con ' +
    'la referencia interna del ESP32, y las lecturas no llegan derail a rail.',
  adcUnits:
    'ADC1 y ADC2 son dos unidades SARADC independientes. ADC1 nunca está bloqueado por el ' +
    'Wi-Fi. ADC2 comparte su bloque con la radio Wi-Fi, así que ambos controladores se arbitran y ' +
    'el perdedor expira (ESP_ERR_TIMEOUT devuelto por adc2_get_raw()).'
};

const R = (severity, title, detail) => ({ severity, title, detail });

/** GPIO 6..11 are wired to the module SPI flash and are unusable. */
const FLASH_REASON =
  'Soldado al SPI flash del ESP-WROOM-32 y no expuesto en el header de 30 pines.';

export const GPIOS = {
  0: {
    gpio: 0,
    arduino: 'A11',
    touchAlias: 'T1',
    adc: { unit: 'ADC2', channel: 1 },
    touch: 1,
    dac: null,
    direction: 'bidirectional',
    strapping: {
      role: 'Selección del modo de arranque del chip (no es un pin JTAG)',
      boardDefault: 'pull-up interno; el botón BOOT de la placa lo lleva a LOW',
      high: 'Arranque normal desde el SPI flash.',
      low: 'Modo de descarga serie (el código ROM escucha en UART0).'
    },
    roles: {
      uart: [],
      spi: [],
      clkOut: ['CLK_OUT1'],
      emac: ['EMAC_TX_CLK'],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO0']
    },
    flags: { onboardLed: 'Algunas placas (no el DOIT DevKit V1) conectan un LED a GPIO0.' },
    reasons: {
      notExposed:
        'GPIO0 no está expuesto en el header de 30 pines. El botón BOOT va directo al pad del ' +
        'módulo, así que no hay posición de header para él. Usa el botón BOOT para manejarla.'
    },
    restrictions: [
      R(
        'critical',
        'Pin strapping: selecciona el modo de arranque',
        'Si está en LOW al reset, el chip entra en modo de descarga serie. El botón BOOT de la ' +
          'placa lo lleva a LOW; el pull-up interno hace que HIGH (arranque normal desde flash) ' +
          'sea el estado en reposo. No conectes una carga que lo mantenga en LOW.'
      ),
      R(
        'warning',
        'No está expuesto en el header de 30 pines',
        'El botón BOOT es el único acceso físico a este pad en el DevKit V1 estándar.'
      ),
      R(
        'info',
        'Sin restricción de salida',
        'Totalmente capaz de salida, con pull-up o pull-down interno seleccionable.'
      )
    ],
    notes: [
      'ADC2 está compartido con la radio Wi-Fi. Con la radio activa, las lecturas devuelven un timeout.'
    ],
    sources: [SOURCES.series, SOURCES.idfAdc, SOURCES.esptool]
  },

  1: {
    gpio: 1,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: ['U0TXD (UART0 TX)'],
      spi: [],
      clkOut: ['CLK_OUT3'],
      emac: ['EMAC_RXD2'],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO1']
    },
    flags: { uart0Console: true },
    restrictions: [
      R(
        'critical',
        'Conectado al puente USB-UART',
        'GPIO1 es el TX hardware de UART0 y está conectado al chip USB-serie de la placa. ' +
          'Reconfigurarlo como GPIO rompe el flasheo y la consola serie.'
      ),
      R(
        'info',
        'No lo toques',
        'Es funcionalmente utilizable, pero en una placa de desarrollo no deberías reutilizarlo.'
      )
    ],
    notes: [
      'UART0 está fijado en el IO MUX: TX = GPIO1, RX = GPIO3. Ambos pads también se pueden ' +
        'enrutar por la matriz GPIO a cualquier otro pin si realmente lo necesitas.'
    ],
    sources: [SOURCES.series, SOURCES.devkitc, SOURCES.doit]
  },

  2: {
    gpio: 2,
    arduino: 'A12',
    touchAlias: 'T2',
    adc: { unit: 'ADC2', channel: 2 },
    touch: 2,
    dac: null,
    direction: 'bidirectional',
    strapping: {
      role: 'Selección del modo de arranque, emparejada con GPIO0: debe estar en LOW o flotante al arrancar',
      boardDefault: 'pull-down interno',
      high: 'Con GPIO0 en LOW esto selecciona un modo de arranque SDIO que el flash del WROOM-32 no puede satisfacer, así que la placa no arranca.',
      low: 'Arranque normal. Es el estado necesario mientras GPIO0 está en LOW para flashear.'
    },
    roles: {
      uart: [],
      spi: ['HSPIWP'],
      clkOut: [],
      emac: [],
      jtag: [],
      sdio: ['SD_DATA0', 'HS2_DATA0'],
      rtc: ['RTC_GPIO2']
    },
    flags: { onboardLed: 'LED azul en el DOIT DevKit V1; LED_BUILTIN de Arduino = 2.' },
    restrictions: [
      R(
        'critical',
        'Pin strapping: debe estar en LOW o flotante al arrancar',
        'Si GPIO0 está en LOW (modo descarga) y GPIO2 también está en HIGH, el chip selecciona un ' +
          'modo de arranque SDIO que el flash del WROOM-32 no puede satisfacer. Mantén activado ' +
          'el pull-down interno.'
      ),
      R(
        'warning',
        'Maneja el LED azul de la placa',
        'En el DOIT DevKit V1 el LED azul (LED_BUILTIN de Arduino) está en este pin. Un nivel ' +
          'lógico HIGH enciende el LED y, según la orientación del LED, puede cargar el pin.'
      ),
      R(
        'info',
        'ADC2 está compartido con la radio Wi-Fi',
        'Las lecturas pueden expirar mientras la radio transmite o recibe.'
      )
    ],
    sources: [SOURCES.series, SOURCES.esptool, SOURCES.doit, SOURCES.variants]
  },

  3: {
    gpio: 3,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: ['U0RXD (UART0 RX)'],
      spi: [],
      clkOut: ['CLK_OUT2'],
      emac: [],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO3']
    },
    flags: { uart0Console: true },
    restrictions: [
      R(
        'critical',
        'Conectado al puente USB-UART',
        'GPIO3 es el RX hardware de UART0 y está conectado al chip USB-serie de la placa. ' +
          'Reutilizarlo rompe el flasheo y la consola serie.'
      )
    ],
    notes: [
      'UART0 está fijado en el IO MUX: TX = GPIO1, RX = GPIO3.'
    ],
    sources: [SOURCES.series, SOURCES.devkitc, SOURCES.doit]
  },

  4: {
    gpio: 4,
    arduino: 'A10',
    touchAlias: 'T0',
    adc: { unit: 'ADC2', channel: 0 },
    touch: 0,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: [],
      spi: ['HSPIHD'],
      clkOut: [],
      emac: ['EMAC_TX_ER'],
      jtag: [],
      sdio: ['SD_DATA1', 'HS2_DATA1'],
      rtc: ['RTC_GPIO4']
    },
    flags: {},
    restrictions: [
      R(
        'info',
        'Sin restricción',
        'Totalmente de propósito general: entrada, salida, pulls internos, PWM y ADC disponibles.'
      ),
      R('info', 'ADC2 está compartido con la radio Wi-Fi', 'Las lecturas pueden expirar durante la actividad de la radio.')
    ],
    sources: [SOURCES.series, SOURCES.idfAdc, SOURCES.variants]
  },

  5: {
    gpio: 5,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'bidirectional',
    strapping: {
      role: 'Temporización del modo esclavo SDIO (se muestrea junto con GPIO15)',
      boardDefault: 'pull-up interno',
      high: 'Temporización por defecto; necesaria para el arranque normal desde SPI flash.',
      low: 'Cambia la temporización del esclavo SDIO; solo la usan flujos de fábrica especiales.'
    },
    roles: {
      uart: [],
      spi: ['VSPICS0 (chip select de SPI en Arduino)'],
      clkOut: [],
      emac: ['EMAC_RX_CLK'],
      jtag: [],
      sdio: ['HS1_DATA6'],
      rtc: ['RTC_GPIO5']
    },
    flags: { arduinoSpiCs: true },
    restrictions: [
      R(
        'warning',
        'Pin strapping: temporización del SPI flash y de SDIO',
        'El pull-up interno mantiene la temporización normal de arranque. Un pull-down externo ' +
          'fuerte puede hacer que el módulo no arranque desde el flash.'
      ),
      R(
        'info',
        'Se usa como CS de SPI por defecto en Arduino',
        'El core arduino-esp32 mapea el CS de VSPI a GPIO5, así que el bus SPI no funciona de ' +
          'forma libre sin un chip select.'
      )
    ],
    sources: [SOURCES.series, SOURCES.esptool, SOURCES.doit, SOURCES.variants]
  },

  6: {
    gpio: 6,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'internal-only',
    strapping: null,
    roles: { uart: [], spi: [], clkOut: [], emac: [], jtag: [], sdio: ['SPI flash CLK'], rtc: [] },
    flags: { flash: true },
    reasons: { notExposed: FLASH_REASON },
    restrictions: [
      R(
        'critical',
        'Conectado al SPI flash del módulo',
        'Este pad está unido al chip flash del WROOM-32. Manejarlo corromperá el contenido del ' +
          'flash o dejará la placa inservible. No está disponible en el header de 30 pines.'
      )
    ],
    sources: [SOURCES.wroom, SOURCES.series]
  },

  7: {
    gpio: 7,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'internal-only',
    strapping: null,
    roles: { uart: [], spi: [], clkOut: [], emac: [], jtag: [], sdio: ['SPI flash SD0'], rtc: [] },
    flags: { flash: true },
    reasons: { notExposed: FLASH_REASON },
    restrictions: [
      R(
        'critical',
        'Conectado al SPI flash del módulo',
        'Nunca disponible para la aplicación en un módulo WROOM-32.'
      )
    ],
    sources: [SOURCES.wroom, SOURCES.series]
  },

  8: {
    gpio: 8,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'internal-only',
    strapping: null,
    roles: { uart: [], spi: [], clkOut: [], emac: [], jtag: [], sdio: ['SPI flash SD1'], rtc: [] },
    flags: { flash: true },
    reasons: { notExposed: FLASH_REASON },
    restrictions: [
      R(
        'critical',
        'Conectado al SPI flash del módulo',
        'Nunca disponible para la aplicación en un módulo WROOM-32.'
      )
    ],
    sources: [SOURCES.wroom, SOURCES.series]
  },

  9: {
    gpio: 9,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'internal-only',
    strapping: null,
    roles: { uart: [], spi: [], clkOut: [], emac: [], jtag: [], sdio: ['SPI flash SD2'], rtc: [] },
    flags: { flash: true },
    reasons: { notExposed: FLASH_REASON },
    restrictions: [
      R(
        'critical',
        'Conectado al SPI flash del módulo',
        'Nunca disponible para la aplicación en un módulo WROOM-32.'
      )
    ],
    notes: [
      'UART1 usa GPIO9 (TX) y GPIO10 (RX) por defecto. Ambos son pads de flash, y ese es el ' +
        'motivo por el que el objeto Serial1 de arduino-esp32 no puede recibir en una placa WROOM-32.'
    ],
    sources: [SOURCES.wroom, SOURCES.series, SOURCES.variants]
  },

  10: {
    gpio: 10,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'internal-only',
    strapping: null,
    roles: { uart: [], spi: [], clkOut: [], emac: [], jtag: [], sdio: ['SPI flash SD3'], rtc: [] },
    flags: { flash: true },
    reasons: { notExposed: FLASH_REASON },
    restrictions: [
      R(
        'critical',
        'Conectado al SPI flash del módulo',
        'Nunca disponible para la aplicación en un módulo WROOM-32.'
      )
    ],
    notes: ['RX por defecto de UART1. También es un pad de flash, así que Serial1 no puede recibir.'],
    sources: [SOURCES.wroom, SOURCES.series, SOURCES.variants]
  },

  11: {
    gpio: 11,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'internal-only',
    strapping: null,
    roles: { uart: [], spi: [], clkOut: [], emac: [], jtag: [], sdio: ['SPI flash CMD'], rtc: [] },
    flags: { flash: true },
    reasons: { notExposed: FLASH_REASON },
    restrictions: [
      R(
        'critical',
        'Conectado al SPI flash del módulo',
        'Nunca disponible para la aplicación en un módulo WROOM-32.'
      )
    ],
    sources: [SOURCES.wroom, SOURCES.series]
  },

  12: {
    gpio: 12,
    arduino: 'A15',
    touchAlias: 'T5',
    adc: { unit: 'ADC2', channel: 5 },
    touch: 5,
    dac: null,
    direction: 'bidirectional',
    strapping: {
      role: 'MTDI: selecciona la tensión de alimentación del SPI flash del módulo (VDD_SDIO)',
      boardDefault: 'pull-down interno',
      high: 'VDD_SDIO = 1.8 V. El flash del WROOM-32 es de 3.3 V: la placa no arrancará.',
      low: 'VDD_SDIO = 3.3 V. Correcto y por defecto.'
    },
    roles: {
      uart: [],
      spi: ['HSPIQ (HSPI MISO)'],
      clkOut: [],
      emac: [],
      jtag: ['MTDI (JTAG TDI)'],
      sdio: ['SD_DATA2', 'HS2_DATA2'],
      rtc: ['RTC_GPIO12']
    },
    flags: { arduinoTrap: true },
    restrictions: [
      R(
        'critical',
        'Pin strapping: si queda en HIGH aquí, la placa no arrancará',
        'Poner GPIO12 en HIGH selecciona una alimentación de flash de 1.8 V. En una placa WROOM-32 ' +
          'el síntoma es un arranque fallido con un mensaje del tipo "Invalid header", o un brownout ' +
          'durante el acceso al flash. Mantén activado el pull-down interno y no toques los circuitos ' +
          'externos.'
      ),
      R(
        'warning',
        'Trampa del alias de Arduino: A15',
        'A15 es GPIO12, no "canal analógico 15". Lo mismo con A11 = GPIO0 y A12 = GPIO2, que son ' +
          'los otros dos pines trampa.'
      ),
      R('info', 'ADC2 está compartido con la radio Wi-Fi', 'Las lecturas pueden expirar durante la actividad de la radio.')
    ],
    sources: [SOURCES.series, SOURCES.esptool, SOURCES.variants, SOURCES.devkitc]
  },

  13: {
    gpio: 13,
    arduino: 'A14',
    touchAlias: 'T4',
    adc: { unit: 'ADC2', channel: 4 },
    touch: 4,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: [],
      spi: ['HSPID (HSPI MOSI)'],
      clkOut: [],
      emac: ['EMAC_RX_ER'],
      jtag: ['MTCK (JTAG TCK)'],
      sdio: ['SD_DATA3', 'HS2_DATA3'],
      rtc: ['RTC_GPIO13']
    },
    flags: {},
    restrictions: [
      R(
        'info',
        'No es un pin strapping',
        'A menudo se asume que lo es por ser un pin de HSPI. Es seguro y totalmente de propósito general.'
      ),
      R('info', 'ADC2 está compartido con la radio Wi-Fi', 'Las lecturas pueden expirar durante la actividad de la radio.'),
      R(
        'info',
        'Compartido con JTAG',
        'Solo es relevante si usas la interfaz JTAG; el driver de JTAG y tu aplicación no deben ' +
          'reclamar el pin a la vez.'
      )
    ],
    sources: [SOURCES.series, SOURCES.idfAdc, SOURCES.variants]
  },

  14: {
    gpio: 14,
    arduino: 'A16',
    touchAlias: 'T6',
    adc: { unit: 'ADC2', channel: 6 },
    touch: 6,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: [],
      spi: ['HSPICLK (HSPI SCK)'],
      clkOut: [],
      emac: ['EMAC_TXD2'],
      jtag: ['MTMS (JTAG TMS)'],
      sdio: ['SD_CLK', 'HS2_CLK'],
      rtc: ['RTC_GPIO14']
    },
    flags: {},
    restrictions: [
      R(
        'info',
        'No es un pin strapping',
        'Se confunde con frecuencia con un pin strapping. Solo GPIO0, 2, 5, 12 y 15 son strapping en el ESP32.'
      ),
      R('info', 'ADC2 está compartido con la radio Wi-Fi', 'Las lecturas pueden expirar durante la actividad de la radio.')
    ],
    sources: [SOURCES.series, SOURCES.idfAdc, SOURCES.variants]
  },

  15: {
    gpio: 15,
    arduino: 'A13',
    touchAlias: 'T3',
    adc: { unit: 'ADC2', channel: 3 },
    touch: 3,
    dac: null,
    direction: 'bidirectional',
    strapping: {
      role: 'MTDO: verbosidad del log de arranque y temporización del esclavo SDIO',
      boardDefault: 'pull-up interno',
      high: 'El log de arranque de la ROM se imprime por U0TXD (GPIO1).',
      low: 'El log de arranque se silencia; el arranque es algo más rápido.'
    },
    roles: {
      uart: [],
      spi: ['HSPICS0 (HSPI CS)'],
      clkOut: [],
      emac: ['EMAC_RXD3'],
      jtag: ['MTDO (JTAG TDO)'],
      sdio: ['SD_CMD', 'HS2_CMD'],
      rtc: ['RTC_GPIO15']
    },
    flags: { arduinoTrap: true },
    restrictions: [
      R(
        'warning',
        'Pin strapping: log de arranque y temporización de SDIO',
        'Un pull-down silencia el log de arranque de la ROM, lo que dificulta la depuración del ' +
          'encendido. El pull-up interno es el valor por defecto útil.'
      ),
      R(
        'warning',
        'Trampa del alias de Arduino: A13',
        'A13 es GPIO15. A11, A12 y A15 son los otros tres pines mal etiquetados que son strapping.'
      ),
      R('info', 'ADC2 está compartido con la radio Wi-Fi', 'Las lecturas pueden expirar durante la actividad de la radio.')
    ],
    sources: [SOURCES.series, SOURCES.esptool, SOURCES.variants]
  },

  16: {
    gpio: 16,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: ['U2RXD (UART2 RX)'],
      spi: ['HS1_DATA4'],
      clkOut: [],
      emac: ['EMAC_CLK_OUT'],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO16']
    },
    flags: { recommended: true },
    restrictions: [
      R(
        'warning',
        'Reservado para PSRAM en los módulos WROVER',
        'Libre en el ESP32-WROOM-32. En el ESP32-WROVER el módulo usa este pad para PSRAM, así que ' +
          'ahí no se debe usar. Todas las placas modeladas llevan un WROOM-32.'
      ),
      R(
        'info',
        'Pin de propósito general seguro en Arduino',
        'RX de UART2, el puerto serie hardware "libre" recomendado en esta placa. También es una ' +
          'excelente salida PWM.'
      )
    ],
    sources: [SOURCES.series, SOURCES.wroom, SOURCES.variants]
  },

  17: {
    gpio: 17,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: ['U2TXD (UART2 TX)'],
      spi: ['HS1_DATA5'],
      clkOut: [],
      emac: ['EMAC_CLK_OUT_180'],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO17']
    },
    flags: { recommended: true },
    restrictions: [
      R(
        'warning',
        'Reservado para PSRAM en los módulos WROVER',
        'Libre en el ESP32-WROOM-32. No utilizable en el ESP32-WROVER.'
      ),
      R('info', 'Pin de propósito general seguro en Arduino', 'TX de UART2, emparejado con GPIO16.')
    ],
    sources: [SOURCES.series, SOURCES.wroom, SOURCES.variants]
  },

  18: {
    gpio: 18,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: [],
      spi: ['VSPICLK (SPI SCK en Arduino)'],
      clkOut: [],
      emac: ['EMAC_TXD0'],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO18']
    },
    flags: { recommended: true, notDac: true },
    restrictions: [
      R(
        'warning',
        'No es un pin DAC',
        'Algunas referencias de pinout listan aquí un tercer canal DAC. El ESP32 tiene exactamente ' +
          'dos canales DAC, DAC1 = GPIO25 y DAC2 = GPIO26. GPIO18 es el reloj VSPI por defecto.'
      ),
      R('info', 'Pin de propósito general seguro en Arduino', 'Salida segura con pulls internos y PWM.')
    ],
    sources: [SOURCES.series, SOURCES.idfDac, SOURCES.variants]
  },

  19: {
    gpio: 19,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: ['U0CTS (control de flujo de UART0, dirección TX)'],
      spi: ['VSPIQ (SPI MISO en Arduino)'],
      clkOut: [],
      emac: ['EMAC_TXD0'],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO19']
    },
    flags: { recommended: true },
    restrictions: [
      R(
        'info',
        'Sin restricción',
        'Totalmente de propósito general. MISO de VSPI por defecto y una excelente salida general.'
      )
    ],
    sources: [SOURCES.series, SOURCES.variants]
  },

  20: {
    gpio: 20,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'absent',
    strapping: null,
    roles: { uart: [], spi: [], clkOut: [], emac: [], jtag: [], sdio: [], rtc: [] },
    flags: { absent: true },
    reasons: {
      notExposed:
        'GPIO20 no existe en el ESP32-WROOM-32. El pad solo está presente en el encapsulado ' +
        'ESP32-PICO-V3, que lo expone para la función de log por U1TXD de la ROM. El módulo ' +
        'WROOM-32 no lo saca a un pad.'
    },
    restrictions: [
      R(
        'critical',
        'Este GPIO no existe en el ESP32-WROOM-32',
        'Cualquier referencia que liste GPIO20 como pin utilizable está describiendo el ' +
          'encapsulado desnudo ESP32-PICO-V3, no el módulo de esta placa. En el PICO-V3 el pad es ' +
          'U1TXD, una salida de log de la ROM, no una IO de propósito general.'
      )
    ],
    sources: [SOURCES.wroom, SOURCES.series]
  },

  21: {
    gpio: 21,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: [],
      spi: ['VSPIHD'],
      clkOut: [],
      emac: ['EMAC_TX_EN'],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO21']
    },
    flags: { recommended: true, arduinoI2c: 'SDA' },
    restrictions: [
      R(
        'info',
        'SDA de I2C por defecto en Arduino',
        'El core arduino-esp32 mapea el SDA de Wire a GPIO21. En el ESP32 cualquier GPIO puede ser ' +
          'SDA o SCL mediante la matriz GPIO, y hacen falta pull-ups externos (unos 4.7 kOhm).'
      )
    ],
    sources: [SOURCES.series, SOURCES.variants]
  },

  22: {
    gpio: 22,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: ['U0RTS (control de flujo de UART0)'],
      spi: ['VSPIWP'],
      clkOut: [],
      emac: ['EMAC_TXD1'],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO22']
    },
    flags: { recommended: true, arduinoI2c: 'SCL' },
    restrictions: [
      R(
        'info',
        'SCL de I2C por defecto en Arduino',
        'Hacen falta pull-ups externos (unos 4.7 kOhm). En el ESP32 cualquier GPIO puede ser SDA o ' +
          'SCL; la regla de que "el SDA debe venir de un pin PWM/LEDC" aplica al ESP32-S2 y al ' +
          'ESP32-C3, no al ESP32.'
      )
    ],
    sources: [SOURCES.series, SOURCES.variants]
  },

  23: {
    gpio: 23,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: [],
      spi: ['VSPID (SPI MOSI en Arduino)', 'HS1_STROBE'],
      clkOut: [],
      emac: [],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO23']
    },
    flags: { recommended: true },
    restrictions: [
      R(
        'info',
        'Sin restricción',
        'Totalmente de propósito general. MOSI de VSPI por defecto.'
      )
    ],
    sources: [SOURCES.series, SOURCES.variants]
  },

  24: {
    gpio: 24,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'absent',
    strapping: null,
    roles: { uart: [], spi: [], clkOut: [], emac: [], jtag: [], sdio: [], rtc: [] },
    flags: { absent: true },
    reasons: { notExposed: 'GPIO24 no existe en el ESP32-WROOM-32.' },
    restrictions: [
      R('critical', 'Este GPIO no existe en el ESP32', 'No hay GPIO24 en el ESP32.')
    ],
    sources: [SOURCES.series]
  },

  25: {
    gpio: 25,
    arduino: 'A18',
    adc: { unit: 'ADC2', channel: 8 },
    touch: null,
    dac: 1,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: [],
      spi: [],
      clkOut: [],
      emac: ['EMAC_RXD0'],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO25']
    },
    flags: { dac: true },
    restrictions: [
      R(
        'info',
        'Salida DAC1',
        'Uno de exactamente dos canales DAC integrados. El rango de salida es de unos 0 a VDD ' +
          '(0..3.3 V), con una impedancia de salida real que necesita un buffer para cargas exigentes.'
      ),
      R('info', 'Sin función touch en este pad', 'DAC1 y DAC2 no son entradas touch capacitivas.'),
      R('info', 'ADC2 está compartido con la radio Wi-Fi', 'Las lecturas pueden expirar durante la actividad de la radio.'),
      R(
        'info',
        'Conflicto con la serigrafía DOIT',
        'La serigrafía original de DOIT etiqueta este pad como A8, mientras que el core ' +
          'arduino-esp32 define el alias A18. Usa el nombre de Arduino en el código y espera A8 en ' +
          'la impresión de la placa.'
      )
    ],
    sources: [SOURCES.idfDac, SOURCES.idfAdc, SOURCES.variants, SOURCES.doit]
  },

  26: {
    gpio: 26,
    arduino: 'A19',
    adc: { unit: 'ADC2', channel: 9 },
    touch: null,
    dac: 2,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: [],
      spi: [],
      clkOut: [],
      emac: ['EMAC_RXD1'],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO26']
    },
    flags: { dac: true },
    restrictions: [
      R(
        'info',
        'Salida DAC2',
        'El segundo y último canal DAC integrado. GPIO18 NO es un DAC: el ESP32 tiene exactamente dos.'
      ),
      R('info', 'Sin función touch en este pad', 'DAC1 y DAC2 no son entradas touch capacitivas.'),
      R('info', 'ADC2 está compartido con la radio Wi-Fi', 'Las lecturas pueden expirar durante la actividad de la radio.'),
      R(
        'info',
        'Conflicto con la serigrafía DOIT',
        'La serigrafía original de DOIT etiqueta este pad como A9, mientras que el core ' +
          'arduino-esp32 define el alias A19.'
      )
    ],
    sources: [SOURCES.idfDac, SOURCES.idfAdc, SOURCES.variants, SOURCES.doit]
  },

  27: {
    gpio: 27,
    arduino: 'A17',
    touchAlias: 'T7',
    adc: { unit: 'ADC2', channel: 7 },
    touch: 7,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: [],
      spi: [],
      clkOut: [],
      emac: ['EMAC_RX_DV'],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO27']
    },
    flags: {},
    restrictions: [
      R('info', 'No es un pin strapping', 'Totalmente de propósito general, seguro para cualquier uso.'),
      R('info', 'ADC2 está compartido con la radio Wi-Fi', 'Las lecturas pueden expirar durante la actividad de la radio.')
    ],
    sources: [SOURCES.series, SOURCES.idfAdc, SOURCES.variants]
  },

  28: {
    gpio: 28,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'absent',
    strapping: null,
    roles: { uart: [], spi: [], clkOut: [], emac: [], jtag: [], sdio: [], rtc: [] },
    flags: { absent: true },
    reasons: { notExposed: 'GPIO28 no existe en el ESP32-WROOM-32.' },
    restrictions: [
      R('critical', 'Este GPIO no existe en el ESP32', 'No hay GPIO28 en el ESP32.')
    ],
    sources: [SOURCES.series]
  },

  29: {
    gpio: 29,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'absent',
    strapping: null,
    roles: { uart: [], spi: [], clkOut: [], emac: [], jtag: [], sdio: [], rtc: [] },
    flags: { absent: true },
    reasons: { notExposed: 'GPIO29 no existe en el ESP32-WROOM-32.' },
    restrictions: [
      R('critical', 'Este GPIO no existe en el ESP32', 'No hay GPIO29 en el ESP32.')
    ],
    sources: [SOURCES.series]
  },

  30: {
    gpio: 30,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'absent',
    strapping: null,
    roles: { uart: [], spi: [], clkOut: [], emac: [], jtag: [], sdio: [], rtc: [] },
    flags: { absent: true },
    reasons: { notExposed: 'GPIO30 no existe en el ESP32-WROOM-32.' },
    restrictions: [
      R('critical', 'Este GPIO no existe en el ESP32', 'No hay GPIO30 en el ESP32.')
    ],
    sources: [SOURCES.series]
  },

  31: {
    gpio: 31,
    arduino: null,
    adc: null,
    touch: null,
    dac: null,
    direction: 'absent',
    strapping: null,
    roles: { uart: [], spi: [], clkOut: [], emac: [], jtag: [], sdio: [], rtc: [] },
    flags: { absent: true },
    reasons: { notExposed: 'GPIO31 no existe en el ESP32-WROOM-32.' },
    restrictions: [
      R('critical', 'Este GPIO no existe en el ESP32', 'No hay GPIO31 en el ESP32.')
    ],
    sources: [SOURCES.series]
  },

  32: {
    gpio: 32,
    arduino: 'A4',
    touchAlias: 'T9',
    adc: { unit: 'ADC1', channel: 4 },
    touch: 9,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: [],
      spi: [],
      clkOut: [],
      emac: [],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO32', '32K_XP (pad del driver de cristal de 32 kHz)']
    },
    flags: { adc1: true, crystal: '32k_XP' },
    restrictions: [
      R(
        'info',
        'Pad de cristal de 32 kHz, libre en este módulo',
        'GPIO32 es el pad 32K_XP. El módulo WROOM-32 no lleva cristal de 32 kHz, así que el pad ' +
          'está libre para uso general. Una placa con un cristal real ocuparía este pin.'
      ),
      R(
        'info',
        'ADC1: nunca bloqueado por el Wi-Fi',
        'Las lecturas en ADC1 funcionan con la radio activa, a diferencia de ADC2.'
      )
    ],
    sources: [SOURCES.series, SOURCES.wroom, SOURCES.idfAdc, SOURCES.variants]
  },

  33: {
    gpio: 33,
    arduino: 'A5',
    touchAlias: 'T8',
    adc: { unit: 'ADC1', channel: 5 },
    touch: 8,
    dac: null,
    direction: 'bidirectional',
    strapping: null,
    roles: {
      uart: [],
      spi: [],
      clkOut: [],
      emac: [],
      jtag: [],
      sdio: [],
      rtc: ['RTC_GPIO33', '32K_XN (pad del driver de cristal de 32 kHz)']
    },
    flags: { adc1: true, crystal: '32k_XN' },
    restrictions: [
      R(
        'info',
        'Pad de cristal de 32 kHz, libre en este módulo',
        'Libre en el módulo WROOM-32 por el mismo motivo que GPIO32.'
      ),
      R('info', 'ADC1: nunca bloqueado por el Wi-Fi', 'Las lecturas funcionan con la radio activa.')
    ],
    sources: [SOURCES.series, SOURCES.wroom, SOURCES.idfAdc, SOURCES.variants]
  },

  34: {
    gpio: 34,
    arduino: 'A6',
    adc: { unit: 'ADC1', channel: 6 },
    touch: null,
    dac: null,
    direction: 'input-only',
    strapping: null,
    roles: {
      uart: [],
      spi: [],
      clkOut: [],
      emac: ['VDET_1 (VDET1 / sensor en cuadratura)'],
      jtag: [],
      sdio: [],
      rtc: []
    },
    flags: { adc1: true, inputOnly: true, noPull: true },
    restrictions: [
      R(
        'critical',
        'Solo entrada: sin driver de salida ni resistencias pull internas',
        'GPIO34 no puede manejar nada. Tampoco tiene pull-up ni pull-down internos, así que ' +
          'flota cuando no hay nada conectado. Añade una resistencia externa para definir el nivel ' +
          'en reposo, por ejemplo 10 kOhm a GND.'
      ),
      R(
        'warning',
        'Sin función touch',
        'El último canal touch capacitivo es CH9 en GPIO32. GPIO34, 35, 36 y 39 no tienen función touch.'
      ),
      R('info', 'ADC1: nunca bloqueado por el Wi-Fi', 'Las lecturas funcionan con la radio activa.')
    ],
    sources: [SOURCES.series, SOURCES.idfGpio, SOURCES.idfAdc, SOURCES.idfTouch]
  },

  35: {
    gpio: 35,
    arduino: 'A7',
    adc: { unit: 'ADC1', channel: 7 },
    touch: null,
    dac: null,
    direction: 'input-only',
    strapping: null,
    roles: {
      uart: [],
      spi: [],
      clkOut: [],
      emac: ['VDET_2 (VDET2 / sensor en cuadratura)'],
      jtag: [],
      sdio: [],
      rtc: []
    },
    flags: { adc1: true, inputOnly: true, noPull: true },
    restrictions: [
      R(
        'critical',
        'Solo entrada: sin driver de salida ni resistencias pull internas',
        'Igual que GPIO34. Usa una resistencia externa para fijar el nivel en reposo.'
      ),
      R('warning', 'Sin función touch', 'GPIO35 no tiene canal touch capacitivo.'),
      R('info', 'ADC1: nunca bloqueado por el Wi-Fi', 'Las lecturas funcionan con la radio activa.')
    ],
    sources: [SOURCES.series, SOURCES.idfGpio, SOURCES.idfAdc, SOURCES.idfTouch]
  },

  36: {
    gpio: 36,
    arduino: 'A0',
    adc: { unit: 'ADC1', channel: 0 },
    touch: null,
    dac: null,
    direction: 'input-only',
    strapping: null,
    roles: {
      uart: [],
      spi: [],
      clkOut: [],
      emac: ['SENSOR_VP (también VP del sensor Hall)'],
      jtag: [],
      sdio: [],
      rtc: []
    },
    flags: { adc1: true, inputOnly: true, noPull: true, glitch: 80 },
    restrictions: [
      R(
        'critical',
        'Solo entrada: sin driver de salida ni resistencias pull internas',
        'Es el único canal ADC1 que además está conectado al sensor Hall interno. Usa una ' +
          'resistencia externa para definir el nivel en reposo.'
      ),
      R(
        'warning',
        'Glitch de unos 80 ns al conmutar la alimentación del SARADC o del Hall',
        'Cuando los bloques ADC2 o Hall cambian de estado de alimentación aparece un transitorio ' +
          'corto en este pad. Llamar a adc_power_acquire() antes de muestrear y a ' +
          'adc_power_release() después lo suprime.'
      ),
      R('warning', 'Sin función touch', 'GPIO36 no tiene canal touch capacitivo.'),
      R(
        'info',
        'Nomenclatura de la serigrafía',
        'DOIT imprime VP en este pad; el alias de Arduino es A0.'
      )
    ],
    sources: [SOURCES.series, SOURCES.idfAdc, SOURCES.idfGpio, SOURCES.variants, SOURCES.doit]
  },

  37: {
    gpio: 37,
    arduino: null,
    adc: { unit: 'ADC1', channel: 1 },
    touch: null,
    dac: null,
    direction: 'absent',
    strapping: null,
    roles: {
      uart: [],
      spi: [],
      clkOut: [],
      emac: ['SENSOR_CAPP'],
      jtag: [],
      sdio: [],
      rtc: []
    },
    flags: { adc1: true, notBonded: true, sensorCap: true },
    reasons: {
      notExposed:
        'No está vinculado (bonded out) en el módulo ESP32-WROOM-32. El pad existe en el silicio ' +
        'desnudo del ESP32 y está conectado al condensador externo del ADC1 para el sensor Hall, ' +
        'pero el módulo no lo saca a un pad.'
    },
    restrictions: [
      R(
        'critical',
        'No disponible en el módulo WROOM-32',
        'GPIO37 es un pad solo interno, usado para el condensador externo del sensor Hall. No está ' +
          'en la placa y no se puede usar.'
      )
    ],
    notes: [
      'Está presente en otros módulos y en el chip desnudo, y por eso varias referencias de ' +
        'pinout lo listan.'
    ],
    sources: [SOURCES.series, SOURCES.wroom, SOURCES.idfAdc]
  },

  38: {
    gpio: 38,
    arduino: null,
    adc: { unit: 'ADC1', channel: 2 },
    touch: null,
    dac: null,
    direction: 'absent',
    strapping: null,
    roles: {
      uart: [],
      spi: [],
      clkOut: [],
      emac: ['SENSOR_CAPN'],
      jtag: [],
      sdio: [],
      rtc: []
    },
    flags: { adc1: true, notBonded: true, sensorCap: true },
    reasons: {
      notExposed:
        'No está vinculado (bonded out) en el módulo ESP32-WROOM-32, por el mismo motivo que ' +
        'GPIO37: lleva el condensador externo del sensor Hall.'
    },
    restrictions: [
      R(
        'critical',
        'No disponible en el módulo WROOM-32',
        'Pad del condensador interno del sensor Hall. No está en la placa.'
      )
    ],
    sources: [SOURCES.series, SOURCES.wroom, SOURCES.idfAdc]
  },

  39: {
    gpio: 39,
    arduino: 'A3',
    adc: { unit: 'ADC1', channel: 3 },
    touch: null,
    dac: null,
    direction: 'input-only',
    strapping: null,
    roles: {
      uart: [],
      spi: [],
      clkOut: [],
      emac: ['SENSOR_VN (VN del sensor Hall)'],
      jtag: [],
      sdio: [],
      rtc: []
    },
    flags: { adc1: true, inputOnly: true, noPull: true, glitch: 80 },
    restrictions: [
      R(
        'critical',
        'Solo entrada: sin driver de salida ni resistencias pull internas',
        'La misma limitación que GPIO34, 35 y 36. Usa una resistencia externa para fijar el nivel ' +
          'en reposo.'
      ),
      R(
        'warning',
        'Glitch de unos 80 ns al conmutar la alimentación del SARADC o del Hall',
        'adc_power_acquire() / adc_power_release() alrededor de la lectura lo suprimen.'
      ),
      R('warning', 'Sin función touch', 'GPIO39 no tiene canal touch capacitivo.'),
      R(
        'info',
        'Nomenclatura de la serigrafía',
        'DOIT imprime VN en este pad; el alias de Arduino es A3.'
      )
    ],
    sources: [SOURCES.series, SOURCES.idfAdc, SOURCES.idfGpio, SOURCES.variants, SOURCES.doit]
  }
};

/** GPIO numbers present in the ESP32-WROOM-32 silicon. */
export const GPIO_LIST = Object.values(GPIOS).map((p) => p.gpio);

/** Arduino analog aliases. A1, A2, A8 and A9 are intentionally undefined. */
export const ARDUINO_ALIASES = {
  A0: 36,
  A3: 39,
  A4: 32,
  A5: 33,
  A6: 34,
  A7: 35,
  A10: 4,
  A11: 0,
  A12: 2,
  A13: 15,
  A14: 13,
  A15: 12,
  A16: 14,
  A17: 27,
  A18: 25,
  A19: 26
};

export const UNDEFINED_ARDUINO_ALIASES = ['A1', 'A2', 'A8', 'A9'];

/** Touch aliases T0..T9 in channel order. */
export const TOUCH_ALIASES = {
  T0: 4,
  T1: 0,
  T2: 2,
  T3: 15,
  T4: 13,
  T5: 12,
  T6: 14,
  T7: 27,
  T8: 33,
  T9: 32
};

export const ADC1_CHANNELS = Object.values(GPIOS)
  .filter((p) => p.adc && p.adc.unit === 'ADC1' && !p.flags.notBonded)
  .map((p) => p.adc.channel)
  .sort((a, b) => a - b);

export const ADC2_CHANNELS = Object.values(GPIOS)
  .filter((p) => p.adc && p.adc.unit === 'ADC2')
  .map((p) => p.adc.channel)
  .sort((a, b) => a - b);

export const DAC_CHANNELS = Object.values(GPIOS)
  .filter((p) => p.dac)
  .map((p) => ({ channel: p.dac, gpio: p.gpio }));

/**
 * Canonical capability ids, derived from the data so the dataset stays the single
 * source of truth. Used by the filter chips, the legend and the label glyphs.
 */
export function capabilitiesOf(pin) {
  const caps = [];
  if (pin.direction === 'bidirectional') caps.push('output', 'pwm');
  if (pin.direction === 'input-only') caps.push('input-only');
  if (pin.flags.flash) caps.push('flash');
  if (pin.flags.absent) caps.push('absent');
  if (pin.flags.notBonded) caps.push('not-bonded');
  if (pin.adc) caps.push(pin.adc.unit.toLowerCase());
  if (pin.dac) caps.push('dac');
  if (pin.touch !== null && pin.touch !== undefined) caps.push('touch');
  if (pin.strapping) caps.push('strapping');
  if (pin.roles.uart.length) caps.push('uart');
  if (pin.roles.spi.length) caps.push('spi');
  if (pin.roles.jtag.length) caps.push('jtag');
  if (pin.roles.sdio.length) caps.push('sdio');
  if (pin.roles.emac.length) caps.push('emac');
  if (pin.roles.clkOut.length) caps.push('clk-out');
  if (pin.roles.rtc.length) caps.push('rtc');
  if (pin.flags.recommended) caps.push('recommended');
  if (pin.flags.arduinoTrap) caps.push('alias-trap');
  if (pin.flags.arduinoI2c) caps.push('i2c');
  if (pin.flags.dac) caps.push('dac');
  return [...new Set(caps)];
}

/**
 * Visual state of a pin. Order matters: the most restrictive condition wins, so a flash
 * pad never reads as "safe".
 */
export function stateOf(pin) {
  if (pin.direction === 'absent') return 'absent';
  if (pin.flags.notBonded) return 'not-bonded';
  if (pin.flags.flash) return 'flash';
  if (pin.strapping) return 'strapping';
  if (pin.direction === 'input-only') return 'input-only';
  return 'safe';
}

/** Flatten all named roles for quick search and the info panel. */
export function allRoles(pin) {
  const out = [];
  for (const [group, list] of Object.entries(pin.roles)) {
    for (const role of list) out.push({ group, role });
  }
  return out;
}

export function getGpio(n) {
  return GPIOS[n] ?? null;
}
