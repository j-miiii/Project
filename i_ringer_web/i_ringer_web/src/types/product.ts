export interface DeviceListResponse {
  items: Device[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface PatientListResponse {
  items: Patient[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

import type { Device, Patient } from './models';
export type { Device, Patient } from './models';