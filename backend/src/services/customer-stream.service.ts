import { EventEmitter } from 'node:events';

export type CustomerStatusChangedEvent = {
  customerId: number;
  isActive: boolean;
  updatedBy: number | null;
  updatedAt: string;
};

const customerStreamEmitter = new EventEmitter();
customerStreamEmitter.setMaxListeners(0);

const CUSTOMER_STATUS_CHANGED_EVENT = 'customer-status-changed';

export const emitCustomerStatusChanged = (payload: CustomerStatusChangedEvent) => {
  customerStreamEmitter.emit(CUSTOMER_STATUS_CHANGED_EVENT, payload);
};

export const subscribeCustomerStatusChanged = (listener: (payload: CustomerStatusChangedEvent) => void) => {
  customerStreamEmitter.on(CUSTOMER_STATUS_CHANGED_EVENT, listener);

  return () => {
    customerStreamEmitter.off(CUSTOMER_STATUS_CHANGED_EVENT, listener);
  };
};
