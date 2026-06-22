import type { User } from './models';

export type { 
  User,
  AccessToken,
  Bed,
  Device,
  Hospital,
  InfusionLog,
  Notification,
  PatientBedAssignment,
  Patient,
  Room,
  UserSetting,
  Ward
} from './models';

export interface ApiResponse<T> {
  data?: T[];
  items?: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    nextPage?: number;
    nextPageUrl?: string;
  };
}

export interface ErrorResponse {
  status: number;
  statusText: string;
  message: string;
  error: string;
  statusCode: number;
  response: any;
}

export interface LoginRequest {
  auth_id: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refresh_token?: string;
  user: User;
  message?: string;
  success?: boolean;
}

export interface RegisterRequest {
  auth_id: string;
  password: string;
  nickname: string;
  role?: '슈퍼관리자' | '관리자' | '간호사';
  hospital_id?: string;
  ward_id?: number;
}