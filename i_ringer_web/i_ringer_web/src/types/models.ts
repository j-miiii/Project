export interface AccessToken {
  id: number;
  user_id?: number;
  access_token?: string;
  refresh_token?: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
  user?: User;
}

export interface Bed {
  id: number;
  room_id?: number;
  bed_number?: string;
  status?: 'available' | 'occupied' | 'maintenance';
  created_at: Date;
  updated_at: Date;
  room?: Room;
  bedAssignments?: PatientBedAssignment[];
}

export interface Device {
  id: number;
  device_name?: string;
  serial_number?: string;
  network_status?: 'online' | 'offline' | 'unknown';
  battery_percent?: number;
  last_update_at?: Date;
  firmware_version?: string;
  bed_id?: string;
  created_at: Date;
  updated_at: Date;
  bedAssignments?: PatientBedAssignment[];
  infusionLogs?: InfusionLog[];
  notifications?: Notification[];
}

export interface Hospital {
  id: number;
  name?: string;
  created_at: Date;
  updated_at: Date;
  wards?: Ward[];
}

export interface InfusionLog {
  id: number;
  device_id?: number;
  patient_bed_assignment_id?: number;
  log_time?: Date;
  flow_rate?: number;
  infused_volume?: number;
  alarm_type?: string;
  created_at: Date;
  updated_at: Date;
  device?: Device;
  patientBedAssignment?: PatientBedAssignment;
}

export interface Notification {
  id: number;
  user_id?: number;
  patient_bed_assignment_id?: number;
  device_id?: number;
  title?: string;
  message?: string;
  type?: 'slow' | 'fast' | 'almost_done' | 'stop' | 'done' | 'disconnected';
  alert_category?: 'critical' | 'caution' | 'system_error';
  is_read?: number;
  read_at?: Date;
  created_at: Date;
  updated_at: Date;
  user?: User;
  patientBedAssignment?: PatientBedAssignment;
  device?: Device;
}

export interface PatientBedAssignment {
  id: number;
  patient_id?: number;
  bed_id?: number;
  device_id?: number;
  infusion_type?: string;
  infusion_total_volume?: number;
  status?: 'pending' | 'infusing' | 'paused' | 'completed' | 'canceled';
  is_active?: boolean;
  started_at?: Date;
  stopped_at?: Date;
  alert_type?: 'stop' | 'done' | 'fast' | 'slow' | 'almost_done' | 'disconnected';
  alert_category?: 'critical' | 'caution' | 'system_error';
  assigned_at?: Date;
  released_at?: Date;
  created_at: Date;
  updated_at: Date;
  patient?: Patient;
  bed?: Bed;
  device?: Device;
  infusionLogs?: InfusionLog[];
  notifications?: Notification[];
}

export interface Patient {
  id: number;
  name?: string;
  chart_number?: string;
  created_at: Date;
  updated_at: Date;
  bedAssignments?: PatientBedAssignment[];
}

export interface Room {
  id: number;
  ward_id?: number;
  name?: string;
  bed_count?: number;
  created_at: Date;
  updated_at: Date;
  ward?: Ward;
  beds?: Bed[];
}

export interface UserSetting {
  id: number;
  user_id?: number;
  fast_enabled?: number;
  fast_threshold?: number;
  slow_enabled?: number;
  slow_threshold?: number;
  default_cchr?: number;
  complete_enabled?: number;
  complete_threshold?: number;
  stop_enabled?: number;
  alert_color?: string;
  alert_display_time?: number;
  critical_alert_enabled?: number;
  critical_sound_enabled?: number;
  caution_alert_enabled?: number;
  caution_sound_enabled?: number;
  system_error_alert_enabled?: number;
  system_error_sound_enabled?: number;
  volume_display_mode?: string;
  created_at: Date;
  updated_at: Date;
  user?: User;
}

export interface WardSetting {
  id: number;
  ward_id?: number;
  fast_enabled?: number;
  fast_threshold?: number;
  slow_enabled?: number;
  slow_threshold?: number;
  complete_enabled?: number;
  complete_threshold?: number;
  stop_enabled?: number;
  default_cchr?: number;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: number;
  role?: '슈퍼관리자' | '관리자' | '간호사' | 'nurse' | 'admin' | 'super_admin';
  auth_id?: string;
  email?: string;
  password?: string;
  nickname?: string;
  hospital_id?: string;
  ward_id?: number;
  has_emr?: boolean;
  employee_number?: string;
  profile_image?: string;
  name?: string;
  created_at: Date;
  updated_at: Date;
  accessTokens?: AccessToken[];
  notifications?: Notification[];
  userSettings?: UserSetting[];
}

export interface Ward {
  id: number;
  hospital_id?: number;
  name?: string;
  created_at: Date;
  updated_at: Date;
  hospital?: Hospital;
  rooms?: Room[];
}

// 신규 모델

export interface NurseRoomAssignment {
  id: number;
  user_id: number;
  room_id: number;
  is_active?: boolean;
  assigned_at?: Date;
  released_at?: Date;
  created_at: Date;
  updated_at: Date;
  user?: User;
  room?: Room;
}

export interface Term {
  id: number;
  title?: string;
  content?: string;
  version?: string;
  type?: 'privacy' | 'service' | 'marketing' | 'location';
  is_required?: boolean;
  is_active?: boolean;
  effective_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UserTermAgreement {
  id: number;
  user_id: number;
  term_id: number;
  agreed_at?: Date;
  created_at: Date;
  updated_at: Date;
  user?: User;
  term?: Term;
}

export interface InfusionEventLog {
  id: number;
  patient_bed_assignment_id: number;
  event_type?: 'start' | 'pause' | 'resume' | 'complete' | 'cancel' | 'alert' | 'modify';
  before_value?: any;
  after_value?: any;
  performed_by?: number;
  created_at: Date;
  updated_at: Date;
  patientBedAssignment?: PatientBedAssignment;
  performer?: User;
}
