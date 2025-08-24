// Verified Service UUIDs from firmware analysis
export const VERIFIED_SERVICE_UUIDS = {
  GENERIC_ACCESS_PROFILE: {
    uuid: 0x1800,
    name: 'Generic Access Profile',
    verified: {
      littleEndian: {
        occurrences: 6076,
        firstOffset: 0x0001c9a7
      },
      bigEndian: {
        occurrences: 3196,
        firstOffset: 0x00008be0
      }
    }
  },
  GENERIC_ATTRIBUTE_PROFILE: {
    uuid: 0x1801,
    name: 'Generic Attribute Profile',
    verified: {
      littleEndian: {
        occurrences: 2416,
        firstOffset: 0x00023410
      },
      bigEndian: {
        occurrences: 3004,
        firstOffset: 0x000088c0
      }
    }
  },
  DEVICE_INFORMATION_SERVICE: {
    uuid: 0x180A,
    name: 'Device Information Service',
    verified: {
      littleEndian: {
        occurrences: 2263,
        firstOffset: 0x00004e0c
      },
      bigEndian: {
        occurrences: 2287,
        firstOffset: 0x0002ffe4
      }
    }
  },
  BATTERY_SERVICE: {
    uuid: 0x180F,
    name: 'Battery Service',
    verified: {
      littleEndian: {
        occurrences: 2189,
        firstOffset: 0x0000222b
      },
      bigEndian: {
        occurrences: 2182,
        firstOffset: 0x00005483
      }
    }
  },
  HUMAN_INTERFACE_DEVICE: {
    uuid: 0x1812,
    name: 'Human Interface Device',
    verified: {
      littleEndian: {
        occurrences: 2586,
        firstOffset: 0x0003626b
      },
      bigEndian: {
        occurrences: 2568,
        firstOffset: 0x00000fb4
      }
    }
  },
  AUDIO_SOURCE: {
    uuid: 0x110A,
    name: 'Audio Source',
    verified: {
      littleEndian: {
        occurrences: 2069,
        firstOffset: 0x000021f8
      },
      bigEndian: {
        occurrences: 2472,
        firstOffset: 0x0003343a
      }
    }
  },
  AUDIO_SINK: {
    uuid: 0x110B,
    name: 'Audio Sink',
    verified: {
      littleEndian: {
        occurrences: 2332,
        firstOffset: 0x0002301c
      },
      bigEndian: {
        occurrences: 2058,
        firstOffset: 0x000053fc
      }
    }
  },
  OBJECT_PUSH_PROFILE: {
    uuid: 0x1105,
    name: 'Object Push Profile',
    verified: {
      littleEndian: {
        occurrences: 2763,
        firstOffset: 0x0000a3a6
      },
      bigEndian: {
        occurrences: 2401,
        firstOffset: 0x00005f7d
      }
    }
  },
  FILE_TRANSFER_PROFILE: {
    uuid: 0x1106,
    name: 'File Transfer Profile',
    verified: {
      littleEndian: {
        occurrences: 2539,
        firstOffset: 0x00018dbb
      },
      bigEndian: {
        occurrences: 2562,
        firstOffset: 0x000064f3
      }
    }
  },
  NORDIC_DFU_SERVICE: {
    uuid: 0xFE59,
    name: 'Nordic DFU Service',
    verified: {
      littleEndian: {
        occurrences: 2566,
        firstOffset: 0x0000dae0
      },
      bigEndian: {
        occurrences: 2134,
        firstOffset: 0x00007a8c
      }
    }
  }
} as const;

// Verified HCI Commands from firmware analysis
export const VERIFIED_HCI_COMMANDS = {
  HCI_RESET: {
    pattern: [0x01, 0x03, 0x0C] as const,
    name: 'HCI Reset',
    verified: {
      occurrences: 5,
      firstOffset: 0x0087B99B,
      context: '3073E5AC01650B2F53D90CD985AA8AFA01030CB78FAAA1286ADD0D13D04D729F'
    }
  },
  HCI_SET_EVENT_MASK: {
    pattern: [0x01, 0x05, 0x0C] as const,
    name: 'HCI Set Event Mask',
    verified: {
      occurrences: 8,
      firstOffset: 0x000A2E6F,
      context: 'D976409D81CB529D83E0548CF54DB4A701050CF4F57C031D8776F2A41E24BE49'
    }
  },
  HCI_INQUIRY: {
    pattern: [0x01, 0x01, 0x0C] as const,
    name: 'HCI Inquiry',
    verified: {
      occurrences: 6,
      firstOffset: 0x00099830,
      context: '35DE008A2A7144CE5C1E4C26EBCE5B0001010CB8FFED23B1A8CB2418FDD9FA95'
    }
  },
  HCI_READ_BD_ADDR: {
    pattern: [0x01, 0x09, 0x0C] as const,
    name: 'HCI Read BD_ADDR',
    verified: {
      occurrences: 7,
      firstOffset: 0x0076E699,
      context: '63BA7723CB0A988B894316A8D3C010C801090CEF0461E78B66B3F93754B55783'
    }
  },
  HCI_CHANGE_LOCAL_NAME: {
    pattern: [0x01, 0x13, 0x0C] as const,
    name: 'HCI Change Local Name',
    verified: {
      occurrences: 16,
      firstOffset: 0x00417506,
      context: 'C5840A85982A1E2E333F41CF6D79DF3901130CD79E1DD4E535C7E1837492DCFD'
    }
  },
  HCI_WRITE_SCAN_ENABLE: {
    pattern: [0x01, 0x1A, 0x0C] as const,
    name: 'HCI Write Scan Enable',
    verified: {
      occurrences: 11,
      firstOffset: 0x009335F5,
      context: 'C7C99D8136B8DA3CA1F6639F8F0F32AE011A0C5A3FF1E680124A19427DCFB9F2'
    }
  },
  HCI_WRITE_CLASS_OF_DEVICE: {
    pattern: [0x01, 0x23, 0x0C] as const,
    name: 'HCI Write Class of Device',
    verified: {
      occurrences: 10,
      firstOffset: 0x005CAA28,
      context: 'A780235EDF45A1442F161E94A672500501230C4A61A15E39A9B078BFCC101F18'
    }
  },
  HCI_WRITE_SIMPLE_PAIRING_MODE: {
    pattern: [0x01, 0x56, 0x0C] as const,
    name: 'HCI Write Simple Pairing Mode',
    verified: {
      occurrences: 10,
      firstOffset: 0x0050BFD7,
      context: '8FD844B59D0C12D0880907612CCC015A01560CE422B116F01C58E7BAE1D74C66'
    }
  },
  HCI_WRITE_LE_HOST_SUPPORT: {
    pattern: [0x01, 0x6D, 0x0C] as const,
    name: 'HCI Write LE Host Support',
    verified: {
      occurrences: 7,
      firstOffset: 0x004F6294,
      context: 'AC2A1D23F06EF840683124BB54E5D3C8016D0C4B5DB63D4DB264B14CE67791EA'
    }
  }
} as const;

// Web Bluetooth API compatible service UUIDs
export const WEB_BLUETOOTH_SERVICES = {
  GENERIC_ACCESS: '00001800-0000-1000-8000-00805f9b34fb',
  GENERIC_ATTRIBUTE: '00001801-0000-1000-8000-00805f9b34fb',
  DEVICE_INFORMATION: '0000180a-0000-1000-8000-00805f9b34fb',
  BATTERY_SERVICE: '0000180f-0000-1000-8000-00805f9b34fb',
  HID_SERVICE: '00001812-0000-1000-8000-00805f9b34fb',
  NORDIC_DFU: '0000fe59-0000-1000-8000-00805f9b34fb'
} as const;

// Standard GATT characteristics
export const GATT_CHARACTERISTICS = {
  DEVICE_NAME: '00002a00-0000-1000-8000-00805f9b34fb',
  APPEARANCE: '00002a01-0000-1000-8000-00805f9b34fb',
  PERIPHERAL_CONNECTION_PARAMETERS: '00002a04-0000-1000-8000-00805f9b34fb',
  SERVICE_CHANGED: '00002a05-0000-1000-8000-00805f9b34fb',
  MANUFACTURER_NAME_STRING: '00002a29-0000-1000-8000-00805f9b34fb',
  MODEL_NUMBER_STRING: '00002a24-0000-1000-8000-00805f9b34fb',
  SERIAL_NUMBER_STRING: '00002a25-0000-1000-8000-00805f9b34fb',
  HARDWARE_REVISION_STRING: '00002a27-0000-1000-8000-00805f9b34fb',
  FIRMWARE_REVISION_STRING: '00002a26-0000-1000-8000-00805f9b34fb',
  SOFTWARE_REVISION_STRING: '00002a28-0000-1000-8000-00805f9b34fb',
  BATTERY_LEVEL: '00002a19-0000-1000-8000-00805f9b34fb'
} as const;

// Verified advertising data patterns
export const VERIFIED_ADVERTISING_PATTERNS = {
  FLAGS: {
    pattern: [0x02, 0x01] as const,
    name: 'Flags',
    verified: {
      occurrences: 1984,
      firstOffset: 0x00004950
    }
  },
  INCOMPLETE_16BIT_SERVICE_UUIDS: {
    pattern: [0x03, 0x02] as const,
    name: 'Incomplete List 16-bit Service UUIDs',
    verified: {
      occurrences: 1756,
      firstOffset: 0x0003B02A
    }
  },
  COMPLETE_16BIT_SERVICE_UUIDS: {
    pattern: [0x03, 0x03] as const,
    name: 'Complete List 16-bit Service UUIDs',
    verified: {
      occurrences: 2009,
      firstOffset: 0x0000517A
    }
  },
  COMPLETE_128BIT_SERVICE_UUIDS: {
    pattern: [0x17, 0x06] as const,
    name: 'Complete List 128-bit Service UUIDs',
    verified: {
      occurrences: 2115,
      firstOffset: 0x000100DB
    }
  },
  COMPLETE_LOCAL_NAME: {
    pattern: [0x09, 0x09] as const,
    name: 'Complete Local Name',
    verified: {
      occurrences: 2232,
      firstOffset: 0x0001E45B
    }
  }
} as const;

// Protocol signatures
export const VERIFIED_BLUETOOTH_SIGNATURES = {
  BLE: {
    occurrences: 5,
    firstOffset: 0x01c1e183,
    context: 'fd9e98c75214606c56c39017bd25ceb24151a9fd424c451114b56bee9cca41da2178b512d0a134f66623b7'
  },
  GAP: {
    occurrences: 11,
    firstOffset: 0x006039db,
    context: 'd33bd5f8b594249fc75fa3827cd0aa9640e117f54741503ff695befee427292565a5cb642d747dd1cd6a50'
  },
  HCI: {
    occurrences: 9,
    firstOffset: 0x014597d9,
    context: '218ee93ddd58aedbe488c084cd24d368824f109d48434994871f4d46c64e83f25d1ee0e15fecad9050c0b1'
  },
  SDP: {
    occurrences: 11,
    firstOffset: 0x00758d61,
    context: 'e3825a975bbde3285f45cdb6d17ba473e39c370753445058034a16ed7deaeb08bff6a3900a112a86aac0bb'
  },
  ATT: {
    occurrences: 5,
    firstOffset: 0x029f2ac1,
    context: 'dcbc3eefd3ca41fd68b27b155d1855464ee54985415454f28d47ba467a7794be253fe87011e13b96c7497d'
  }
} as const;