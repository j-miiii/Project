import { ApiResponse, User, LoginRequest, LoginResponse, RegisterRequest } from '../types/api';
import { isTokenExpired, isTokenValid } from '../utils/tokenUtils';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://iringer.kr/api';

if (!API_BASE_URL || API_BASE_URL === 'undefined') {
  console.error('API_BASE_URL is not defined properly');
}

const ENDPOINT_MAP: Record<string, string> = {
  'users': 'users',
  'hospitals': 'hospitals',
  'wards': 'wards',
  'rooms': 'rooms',
  'beds': 'beds',
  'patients': 'patients',
  'devices': 'devices',
  'patient_bed_assignments': 'patient_bed_assignments',
  'infusions': 'infusions',
  'infusion_logs': 'infusion_logs',
  'notifications': 'notifications',
  'user_settings': 'user_settings',
  'access_tokens': 'access_tokens',
  'nurse_room_assignments': 'nurse_room_assignments',
  'ward_settings': 'ward_settings'
};

class DataProvider {
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;
  private authChannel: BroadcastChannel | null = null;

  constructor() {
    // BroadcastChannel 초기화 (다중 탭/창 간 통신)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.authChannel = new BroadcastChannel('auth_channel');
    }
  }

  getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  public async refreshAuthToken(): Promise<string | null> {
    return this.refreshToken();
  }

  private async refreshToken(): Promise<string | null> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string | null> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Refresh token도 만료되었는지 확인
      if (!isTokenValid(refreshToken)) {
        console.error('Refresh token is expired');
        throw new Error('Refresh token expired');
      }

      const refreshResponse = await fetch(`${API_BASE_URL}/user/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      });
      
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const newToken = refreshData.access_token || refreshData.token || refreshData.accessToken;

        if (newToken) {
          localStorage.setItem('auth_token', newToken);
          localStorage.setItem('access_token', newToken);
          // console.log('Token refreshed successfully');
          return newToken;
        } else {
          throw new Error('No new token received from refresh');
        }
      } else {
        const errorData = await refreshResponse.json().catch(() => ({}));
        console.error('Token refresh failed:', errorData);

        // 401, 403은 refresh token도 만료된 경우
        if (refreshResponse.status === 401 || refreshResponse.status === 403) {
          alert('세션이 만료되었습니다. 다시 로그인해주세요.');
          this.logout();
          window.location.href = '/login';
        }
        throw new Error(`Token refresh failed: ${refreshResponse.status}`);
      }
    } catch (error) {
      console.error('Token refresh error:', error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('네트워크 연결을 확인해주세요.');
      } else if (error instanceof Error && error.message.startsWith('Token refresh failed')) {
        // 401/403에서 이미 alert 표시 완료 → 중복 방지
        throw error;
      } else {
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
        this.logout();
        window.location.href = '/login';
      }
      throw error;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    enableTokenRefresh: boolean = false
  ): Promise<ApiResponse<T> | T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {};
    
    if (!options.headers || !('Content-Type' in options.headers)) {
      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      headers: {
        ...headers,
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 401 && enableTokenRefresh) {
          try {
            const newToken = await this.refreshToken();
            if (newToken) {
              const updatedHeaders = {
                ...config.headers,
                'Authorization': `Bearer ${newToken}`
              };
              
              const retryConfig = {
                ...config,
                headers: updatedHeaders
              };
              
              const retryResponse = await fetch(url, retryConfig);
              
              if (retryResponse.ok) {
                const data = await retryResponse.json();
                return data;
              } else {
                const retryErrorData = await retryResponse.json().catch(() => ({}));
                const error = {
                  status: retryResponse.status,
                  statusText: retryResponse.statusText,
                  message: retryErrorData.message || `HTTP error! status: ${retryResponse.status}`,
                  error: retryErrorData.error || 'Unknown error',
                  statusCode: retryErrorData.statusCode || retryResponse.status,
                  response: retryErrorData
                };
                throw error;
              }
            }
          } catch (refreshError) {
            throw refreshError;
          }
        }
        
        const error = {
          status: response.status,
          statusText: response.statusText,
          message: errorData.message || `HTTP error! status: ${response.status}`,
          error: errorData.error || 'Unknown error',
          statusCode: errorData.statusCode || response.status,
          response: errorData
        };
        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  isAuthenticated(): boolean {
    const token = this.getAuthToken();
    const user = this.getCurrentUser();
    return !!(token || user);
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.request<any>('/user/signin', {
      method: 'POST',
      body: JSON.stringify({
        auth_id: credentials.auth_id,
        password: credentials.password
      }),
    });

    const loginResponse: LoginResponse = {
      token: response.access_token || response.token || '',
      refresh_token: response.refresh_token || '',
      user: response.user || response,
      user_setting: response.user_setting,
      ward_setting: response.ward_setting
    } as any;

    return loginResponse;
  }

  async register(data: RegisterRequest): Promise<LoginResponse> {
    const userData = {
      auth_id: data.auth_id,
      password: data.password,
      nickname: data.nickname,
      role: data.role || '간호사',
      hospital_id: data.hospital_id,
      ward_id: data.ward_id
    };

    const response = await this.request<any>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    return {
      success: true,
      user: response,
      token: response.access_token || ''
    } as LoginResponse;
  }

  setTokens(loginResponse: LoginResponse): void {
    const token = loginResponse.token || (loginResponse as any).access_token || (loginResponse as any).accessToken;
    if (token) {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('access_token', token);
    }

    // Refresh token 저장 추가
    const refreshToken = loginResponse.refresh_token || (loginResponse as any).refresh_token;
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }

    const user = loginResponse.user || loginResponse;
    if (user && (user.id || user.email)) {
      localStorage.setItem('user_info', JSON.stringify(user));
      localStorage.setItem('user_id', String(user.id));
      localStorage.setItem('user_email', user.email || user.auth_id || '');
      localStorage.setItem('user_role', user.role || '');
      localStorage.setItem('user_name', user.nickname || '');
      if (user.hospital_id) {
        localStorage.setItem('hospital_id', user.hospital_id);
      }
      if (user.ward_id) {
        localStorage.setItem('ward_id', String(user.ward_id));
      }
    }

    // user_setting을 localStorage에 저장 (UI 관련 설정만)
    const userSetting = (loginResponse as any).user_setting;
    if (userSetting) {
      const uiSettings = {
        alert_color: userSetting.alert_color,
        alert_display_time: userSetting.alert_display_time,
        volume_display_mode: userSetting.volume_display_mode,
        critical_alert_enabled: userSetting.critical_alert_enabled,
        critical_sound_enabled: userSetting.critical_sound_enabled,
        caution_alert_enabled: userSetting.caution_alert_enabled,
        caution_sound_enabled: userSetting.caution_sound_enabled,
        system_error_alert_enabled: userSetting.system_error_alert_enabled,
        system_error_sound_enabled: userSetting.system_error_sound_enabled,
      };
      localStorage.setItem('user_setting', JSON.stringify(uiSettings));
    }

    // ward_setting을 localStorage에 저장 (병동 공통 설정: threshold 등)
    const wardSetting = (loginResponse as any).ward_setting;
    if (wardSetting) {
      localStorage.setItem('ward_setting', JSON.stringify(wardSetting));
    }

    window.dispatchEvent(new Event('login'));
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    localStorage.removeItem('hospital_id');
    localStorage.removeItem('ward_id');
    localStorage.removeItem('user_setting');
    localStorage.removeItem('ward_setting');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('session_id');

    // 모든 탭/창에 로그아웃 이벤트 브로드캐스트
    if (this.authChannel) {
      this.authChannel.postMessage({ type: 'logout' });
    }

    // 현재 탭/창에서 로그아웃 이벤트 발생
    window.dispatchEvent(new Event('logout'));
  }

  getCurrentUser(): User | null {
    const userInfo = localStorage.getItem('user_info');
    return userInfo ? JSON.parse(userInfo) : null;
  }

  /**
   * Access Token이 만료되었거나 곧 만료될 예정인지 확인합니다
   * @param bufferMinutes 만료 전 몇 분을 버퍼로 둘지 (기본 5분)
   * @returns true면 갱신이 필요함
   */
  isAccessTokenExpiringSoon(bufferMinutes: number = 5): boolean {
    const token = this.getAuthToken();
    if (!token) {
      return true;
    }
    return isTokenExpired(token, bufferMinutes);
  }

  /**
   * 페이지 진입 시 토큰 상태를 확인하고 필요시 갱신합니다
   * @returns 유효한 토큰이 있으면 true, 로그인 필요하면 false
   */
  async validateAndRefreshToken(): Promise<boolean> {
    const accessToken = this.getAuthToken();
    const refreshToken = this.getRefreshToken();

    // 토큰이 없으면 로그인 필요
    if (!accessToken || !refreshToken) {
      return false;
    }

    // Access token이 유효하면 OK
    if (!isTokenExpired(accessToken, 5)) {
      return true;
    }

    // Access token이 만료 임박/만료됨 -> Refresh 시도
    try {
      const newToken = await this.refreshToken();
      return !!newToken;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async getList<T>(resource: string, params?: {
    page?: number;
    limit?: number;
    order?: string;
    where?: string | Record<string, any>;
    start_date?: string;
    end_date?: string;
    search?: string;
    filter?: Record<string, any>;
    sort?: string;
  }): Promise<ApiResponse<T>> {
    const endpoint = ENDPOINT_MAP[resource] || resource;
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    if (params?.order) {
      searchParams.append('order', params.order);
    } else if (params?.sort) {
      searchParams.append('order', params.sort);
    }
    
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.search) searchParams.append('search', params.search);
    
    if (params?.where) {
      if (typeof params.where === 'string') {
        searchParams.append('where', params.where);
      } else {
        const whereConditions = Object.entries(params.where)
          .filter(([_, value]) => value !== null && value !== undefined)
          .map(([key, value]) => `${key}:${value}`)
          .join(',');
        if (whereConditions) {
          searchParams.append('where', whereConditions);
        }
      }
    } else if (params?.filter) {
      const whereConditions = Object.entries(params.filter)
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key, value]) => `${key}:${value}`)
        .join(',');
      if (whereConditions) {
        searchParams.append('where', whereConditions);
      }
    }

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await this.request<T>(`/${endpoint}${query}`) as any;
    
    if (response.data && !response.items) {
      response.items = response.data;
    }
    
    return response as ApiResponse<T>;
  }

  async getOne<T>(resource: string, id: string | number, params?: { include?: string }): Promise<T> {
    const endpoint = ENDPOINT_MAP[resource] || resource;
    const queryParams = new URLSearchParams();
    if (params?.include) {
      queryParams.append('include', params.include);
    }
    const queryString = queryParams.toString();
    const url = queryString ? `/${endpoint}/${id}?${queryString}` : `/${endpoint}/${id}`;
    return this.request<T>(url) as Promise<T>;
  }

  async create<T>(resource: string, data: Partial<T> | FormData): Promise<T> {
    const endpoint = ENDPOINT_MAP[resource] || resource;
    const isFormData = data instanceof FormData;
    
    const options: RequestInit = {
      method: 'POST',
      body: isFormData ? data : JSON.stringify(data),
    };
    
    if (!isFormData) {
      options.headers = {
        'Content-Type': 'application/json',
      };
    }
    
    return this.request<T>(`/${endpoint}`, options) as Promise<T>;
  }

  async update<T>(resource: string, id: string | number, data: Partial<T>): Promise<T> {
    const endpoint = ENDPOINT_MAP[resource] || resource;
    return this.request<T>(`/${endpoint}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, true) as Promise<T>;
  }

  async delete(resource: string, id: string | number): Promise<void> {
    const endpoint = ENDPOINT_MAP[resource] || resource;
    await this.request(`/${endpoint}/${id}`, {
      method: 'DELETE',
    }, true);
  }

  async getProfile(): Promise<User> {
    return this.request<User>('/users/profile') as Promise<User>;
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return this.request<User>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }, true) as Promise<User>;
  }

  async upload(resource: string, formData: FormData): Promise<any> {
    return this.create(resource, formData);
  }

  async getHospitalHierarchy(): Promise<any> {
    const url = `${API_BASE_URL}/hierarchy/hospitals/all`;
    const token = this.getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch hierarchy: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 투여완료 처리 (단일)
   * @param assignmentId patient_bed_assignments id
   * @returns
   * - 200: 정상 처리
   * - 404: 연결된 기기를 찾을 수 없음
   * - 409: 이미 완료 처리됨
   */
  /**
   * 수액 삭제 (환자 유지)
   * 수액 관련 필드만 초기화하고 환자-침상 연결은 유지합니다.
   * @param assignmentId patient_bed_assignments id
   */
  async clearInfusion(assignmentId: number): Promise<any> {
    const url = `${API_BASE_URL}/monitoring/assignments/${assignmentId}/clear-infusion`;
    const token = this.getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        statusText: response.statusText,
        message: errorData.message || `HTTP error! status: ${response.status}`,
        error: errorData.error || 'Unknown error',
        statusCode: response.status,
        response: errorData
      };
    }

    return response.json();
  }

  async releaseAssignment(assignmentId: number): Promise<any> {
    const url = `${API_BASE_URL}/monitoring/assignments/${assignmentId}/release`;
    const token = this.getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        statusText: response.statusText,
        message: errorData.message || `HTTP error! status: ${response.status}`,
        error: errorData.error || 'Unknown error',
        statusCode: response.status,
        response: errorData
      };
    }

    return response.json();
  }

  /**
   * 투여완료 처리 (벌크)
   * @param assignmentIds patient_bed_assignments id 배열
   * @returns
   * {
   *   success: boolean,
   *   message: string,
   *   data: {
   *     total: number,
   *     succeeded: number,
   *     failed: number,
   *     hasFailures: boolean,
   *     results: Array<{
   *       assignment_id: number,
   *       success: boolean,
   *       statusCode: number,
   *       message: string,
   *       data?: any
   *     }>
   *   }
   * }
   */
  async bulkReleaseAssignments(assignmentIds: number[]): Promise<any> {
    const url = `${API_BASE_URL}/monitoring/assignments/bulk-release`;
    const token = this.getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ ids: assignmentIds })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        statusText: response.statusText,
        message: errorData.message || `HTTP error! status: ${response.status}`,
        error: errorData.error || 'Unknown error',
        statusCode: response.status,
        response: errorData
      };
    }

    return response.json();
  }

  /**
   * 가상 데이터 생성
   * @param hospital_id 병원 ID
   * @param ward_id 병동 ID (전체 병동인 경우 null)
   * @returns
   */
  async generateMonitoringData(hospital_id: number, ward_id: number | null): Promise<any> {
    const url = `${API_BASE_URL}/monitoring/assignments/generate`;
    const token = this.getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ hospital_id, ward_id })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        statusText: response.statusText,
        message: errorData.message || `HTTP error! status: ${response.status}`,
        error: errorData.error || 'Unknown error',
        statusCode: response.status,
        response: errorData
      };
    }

    return response.json();
  }

  /**
   * 수액 추가 (환자 침대에 수액 배정)
   * @param data 수액 추가 데이터
   */
  async addInfusion(data: {
    patient_id: number
    bed_id: number
    infusion_type: string
    infusion_total_volume: number
    infusion_code?: string
    infusion_cchr?: number
  }): Promise<any> {
    const url = `${API_BASE_URL}/monitoring/assignments/add-infusion`
    const token = this.getAuthToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw {
        status: response.status,
        statusText: response.statusText,
        message: errorData.message || `HTTP error! status: ${response.status}`,
        error: errorData.error || 'Unknown error',
        statusCode: response.status,
        response: errorData
      }
    }

    return response.json()
  }

  /**
   * 계정 잠금 해제
   * @param user_id 사용자 ID
   * @returns
   */
  async unlockAccount(user_id: number): Promise<any> {
    const url = `${API_BASE_URL}/admin/unlock-account`;
    const token = this.getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ user_id })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        statusText: response.statusText,
        message: errorData.message || `HTTP error! status: ${response.status}`,
        error: errorData.error || 'Unknown error',
        statusCode: response.status,
        response: errorData
      };
    }

    return response.json();
  }
}

export const dataProvider = new DataProvider();