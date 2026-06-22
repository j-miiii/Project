import { 
  Controller, 
  Post,
  Body,
  HttpException, 
  HttpStatus
} from '@nestjs/common';
import { ApiBody, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller('api')
@ApiTags('개별모델 삽입')
export class ModelsController {
  constructor(private readonly appService: AppService) {}

  @Post('users')
  @ApiOperation({ summary: '사용자 생성', description: '새로운 사용자를 생성합니다.' })
  @ApiBody({
    description: '사용자 데이터',
    schema: {
      type: 'object',
      example: {
        role: '간호사',
        auth_id: 'nurse001',
        password: 'password123',
        nickname: '김간호사',
        hospital_id: 'H001',
        ward_id: 1,
        employee_number: 'EMP001',
        profile_image: '/images/default_profile.png'
      }
    }
  })
  async createUser(@Body() data: any) {
    try {
      return await this.appService.insertData('users', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('patients')
  @ApiOperation({ summary: '환자 생성', description: '새로운 환자를 생성합니다.' })
  @ApiBody({ 
    description: '환자 데이터',
    schema: {
      type: 'object',
      example: {
        nickname: '홍길동',
        chart_number: 'P001'
      }
    }
  })
  async createPatient(@Body() data: any) {
    try {
      return await this.appService.insertData('patients', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('hospitals')
  @ApiOperation({ summary: '병원 생성', description: '새로운 병원을 생성합니다.' })
  @ApiBody({ 
    description: '병원 데이터',
    schema: {
      type: 'object',
      example: {
        name: '서울대학교병원'
      }
    }
  })
  async createHospital(@Body() data: any) {
    try {
      return await this.appService.insertData('hospitals', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('wards')
  @ApiOperation({ summary: '병동 생성', description: '새로운 병동을 생성합니다.' })
  @ApiBody({ 
    description: '병동 데이터',
    schema: {
      type: 'object',
      example: {
        hospital_id: 1,
        name: '내과병동'
      }
    }
  })
  async createWard(@Body() data: any) {
    try {
      return await this.appService.insertData('wards', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rooms')
  @ApiOperation({ summary: '병실 생성', description: '새로운 병실을 생성합니다.' })
  @ApiBody({ 
    description: '병실 데이터',
    schema: {
      type: 'object',
      example: {
        ward_id: 1,
        name: '101호',
        bed_count: 4
      }
    }
  })
  async createRoom(@Body() data: any) {
    try {
      return await this.appService.insertData('rooms', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('beds')
  @ApiOperation({ summary: '침대 생성', description: '새로운 침대를 생성합니다.' })
  @ApiBody({ 
    description: '침대 데이터',
    schema: {
      type: 'object',
      example: {
        room_id: 1,
        bed_number: 'A1',
        status: 'available'
      }
    }
  })
  async createBed(@Body() data: any) {
    try {
      return await this.appService.insertData('beds', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('devices')
  @ApiOperation({ summary: '장치 생성', description: '새로운 링겔 모니터링 장치를 생성합니다.' })
  @ApiBody({ 
    description: '장치 데이터',
    schema: {
      type: 'object',
      example: {
        device_name: 'I-Ringer-001',
        serial_number: 'IR001',
        network_status: 'online',
        battery_percent: 85,
        firmware_version: '1.0.0',
        bed_id: '1'
      }
    }
  })
  async createDevice(@Body() data: any) {
    try {
      return await this.appService.insertData('devices', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('patient_bed_assignments')
  @ApiOperation({ summary: '환자 침대 할당 생성', description: '환자를 침대에 할당합니다. 수액은 별도로 /api/monitoring/assignments/add-infusion 으로 추가합니다.' })
  @ApiBody({
    description: '환자 침대 할당 데이터',
    schema: {
      type: 'object',
      example: {
        patient_id: 1,
        bed_id: 1,
        device_id: 1,
        assigned_at: '2025-09-04T14:00:00Z',
        status: 'pending',
        is_active: true
      }
    }
  })
  async createPatientBedAssignment(@Body() data: any) {
    try {
      return await this.appService.insertData('patient_bed_assignments', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('infusion_raw_logs')
  @ApiOperation({ summary: '수액 원시 로그 생성', description: '새로운 수액 원시 로그를 생성합니다.' })
  @ApiBody({
    description: '수액 원시 로그 데이터',
    schema: {
      type: 'object',
      example: {
        sn: 'IR001',
        api: 'v1',
        device_type: 'IR',
        weight: 450.50,
        battery: 85,
        injected_amount: 50.25,
        gtt: 120.5,
        rest_minute: 45,
        time: 1725451200000,
        extra_json: { "temperature": 25, "humidity": 60 }
      }
    }
  })
  async createInfusionRawLog(@Body() data: any) {
    try {
      return await this.appService.insertData('infusion_raw_logs', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('notifications')
  @ApiOperation({ summary: '알림 생성', description: '새로운 알림을 생성합니다.' })
  @ApiBody({
    description: '알림 데이터',
    schema: {
      type: 'object',
      example: {
        user_id: 1,
        patient_bed_assignment_id: 1,
        device_id: 1,
        title: '수액 투여 완료 임박',
        message: '환자 홍길동의 수액 투여가 완료 임박입니다.',
        type: 'almost_done',
        is_read: 0,
        alert_category: 'caution'
      }
    }
  })
  async createNotification(@Body() data: any) {
    try {
      return await this.appService.insertData('notifications', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('user_settings')
  @ApiOperation({ summary: '사용자 설정 생성', description: '새로운 사용자 설정을 생성합니다.' })
  @ApiBody({ 
    description: '사용자 설정 데이터',
    schema: {
      type: 'object',
      example: {
        user_id: 1,
        fast_enabled: 1,
        fast_threshold: 50,
        slow_enabled: 1,
        slow_threshold: -50,
        default_gatt: 60,
        complete_enabled: 1,
        complete_threshold: 95,
        stop_enabled: 1,
        alert_color: '#FF0000',
        alert_display_time: 5,
        critical_alert_enabled: 1,
        critical_sound_enabled: 1,
        caution_alert_enabled: 1,
        caution_sound_enabled: 1,
        system_error_alert_enabled: 1,
        system_error_sound_enabled: 1,
        volume_display_mode: 'percentage'
      }
    }
  })
  async createUserSetting(@Body() data: any) {
    try {
      return await this.appService.insertData('user_settings', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('access_tokens')
  @ApiOperation({ summary: '액세스 토큰 생성', description: '새로운 액세스 토큰을 생성합니다.' })
  @ApiBody({ 
    description: '액세스 토큰 데이터',
    schema: {
      type: 'object',
      example: {
        user_id: 1,
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expires_at: '2025-09-04T15:00:00Z'
      }
    }
  })
  async createAccessToken(@Body() data: any) {
    try {
      return await this.appService.insertData('access_tokens', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('infusions')
  @ApiOperation({ summary: '수액 마스터 생성', description: '새로운 수액 종류를 등록합니다.' })
  @ApiBody({
    description: '수액 마스터 데이터',
    schema: {
      type: 'object',
      example: {
        code: 'NS',
        name: '생리식염수',
        default_volume: 500,
        default_gtt: 60,
        description: '0.9% NaCl 용액',
        is_active: true
      }
    }
  })
  async createInfusion(@Body() data: any) {
    try {
      return await this.appService.insertData('infusions', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('drug_orders')
  @ApiOperation({ summary: '투약 처방 생성', description: '새로운 투약 처방을 생성합니다.' })
  @ApiBody({
    description: '투약 처방 데이터',
    schema: {
      type: 'object',
      example: {
        patient_id: 1,
        infusion_id: 1,
        order_code: 'ORD001',
        volume: 500,
        gtt: 60,
        order_date: '20260414',
        status: 'active'
      }
    }
  })
  async createDrugOrder(@Body() data: any) {
    try {
      return await this.appService.insertData('drug_orders', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('patient_vitals')
  @ApiOperation({ summary: '환자 바이탈 생성', description: '새로운 환자 바이탈 기록을 생성합니다.' })
  @ApiBody({
    description: '환자 바이탈 데이터',
    schema: {
      type: 'object',
      example: {
        patient_id: 1,
        adm: 'ADM001',
        date: '20250326',
        time: '1430',
        nurse_key: 'NK001',
        height: 170.5,
        weight: 65.0
      }
    }
  })
  async createPatientVital(@Body() data: any) {
    try {
      return await this.appService.insertData('patient_vitals', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('nurse_room_assignments')
  @ApiOperation({ summary: '간호사 병실 배정 생성', description: '간호사를 병실에 배정합니다.' })
  @ApiBody({
    description: '간호사 병실 배정 데이터',
    schema: {
      type: 'object',
      example: {
        user_id: 1,
        room_id: 1,
        is_active: true
      }
    }
  })
  async createNurseRoomAssignment(@Body() data: any) {
    try {
      return await this.appService.insertData('nurse_room_assignments', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('terms')
  @ApiOperation({ summary: '약관 생성', description: '새로운 약관을 생성합니다.' })
  @ApiBody({
    description: '약관 데이터',
    schema: {
      type: 'object',
      example: {
        title: '개인정보 처리방침',
        content: '약관 내용...',
        version: '1.0',
        type: 'privacy',
        is_required: true,
        is_active: true
      }
    }
  })
  async createTerm(@Body() data: any) {
    try {
      return await this.appService.insertData('terms', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('user_term_agreements')
  @ApiOperation({ summary: '약관 동의 생성', description: '사용자의 약관 동의를 기록합니다.' })
  @ApiBody({
    description: '약관 동의 데이터',
    schema: {
      type: 'object',
      example: {
        user_id: 1,
        term_id: 1
      }
    }
  })
  async createUserTermAgreement(@Body() data: any) {
    try {
      return await this.appService.insertData('user_term_agreements', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('infusion_event_logs')
  @ApiOperation({ summary: '수액 이벤트 로그 생성', description: '수액 투여 이벤트 로그를 기록합니다.' })
  @ApiBody({
    description: '수액 이벤트 로그 데이터',
    schema: {
      type: 'object',
      example: {
        patient_bed_assignment_id: 1,
        event_type: 'start',
        before_value: null,
        after_value: { status: 'infusing' },
        performed_by: 1
      }
    }
  })
  async createInfusionEventLog(@Body() data: any) {
    try {
      return await this.appService.insertData('infusion_event_logs', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}