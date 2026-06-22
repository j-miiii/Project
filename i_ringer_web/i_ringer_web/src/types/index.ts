export * from './models';

export type { 
  ApiResponse,
  ErrorResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest
} from './api';

export type ID = number | string;
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SearchParams extends PaginationParams {
  search?: string;
  filter?: Record<string, any>;
}

export interface CreateResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface UpdateResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface DeleteResponse {
  success: boolean;
  message?: string;
}

export type FormData<T> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>;