export {};

declare global {
  type USBTransferStatus = 'ok' | 'stall' | 'babble';

  interface USBDeviceFilter {
    vendorId?: number;
    productId?: number;
    classCode?: number;
    subclassCode?: number;
    protocolCode?: number;
    serialNumber?: string;
  }

  interface USBDeviceRequestOptions {
    filters: USBDeviceFilter[];
  }

  interface USBInTransferResult {
    data?: DataView;
    status: USBTransferStatus;
  }

  interface USBOutTransferResult {
    bytesWritten?: number;
    status: USBTransferStatus;
  }

  interface USBEndpoint {
    direction: 'in' | 'out';
    endpointNumber: number;
  }

  interface USBAlternateInterface {
    interfaceClass: number;
    endpoints: USBEndpoint[];
  }

  interface USBInterface {
    interfaceNumber: number;
    alternates: USBAlternateInterface[];
  }

  interface USBConfiguration {
    interfaces: USBInterface[];
  }

  interface USBDevice {
    opened: boolean;
    configuration: USBConfiguration | null;
    open(): Promise<void>;
    close(): Promise<void>;
    selectConfiguration(configurationValue: number): Promise<void>;
    claimInterface(interfaceNumber: number): Promise<void>;
    releaseInterface(interfaceNumber: number): Promise<void>;
    transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
    transferOut(
      endpointNumber: number,
      data: ArrayBufferView<ArrayBufferLike> | ArrayBufferLike,
    ): Promise<USBOutTransferResult>;
  }

  interface USB {
    requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
  }

  interface Navigator {
    usb: USB;
  }
}

