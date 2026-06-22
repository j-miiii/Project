import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Request,
  Headers,
  NotFoundException
} from '@nestjs/common';
import { ApiParam, ApiBody, ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AppService } from './app.service';
import { CreateDeviceDto } from './dto/device.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // ===== 통합 API =====
  @Get('api/:table_name')
  @ApiTags('통합')
  @ApiBearerAuth()
  @ApiParam({ name: 'table_name', example: 'users', description: '조회할 테이블 이름' })
  @ApiQuery({ name: 'search', required: false, description: '검색 키워드' })
  @ApiQuery({ name: 'order', required: false, example: 'id:desc', description: '정렬 조건을 문자열 형태로 입력 (예: id:desc,created_at:asc)' })
  @ApiQuery({ name: 'where', required: false, example: '', description: '필터링 조건을 문자열 형태로 입력 (예: status:active,type:premium)' })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: '페이지당 항목 수 (기본값: 10)' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: '페이지 번호 (기본값: 1)' })
  @ApiQuery({ name: 'start_date', required: false, example: '', description: '시작일 (YYYY-MM-DD 형식)' })
  @ApiQuery({ name: 'end_date', required: false, example: '', description: '종료일 (YYYY-MM-DD 형식)' })
  @ApiOperation({ summary: '데이터 목록 조회', description: '지정된 테이블의 데이터 목록을 조회합니다.' })
  @ApiResponse({ status: 200, description: '성공적으로 조회됨' })
  async findAll(@Param('table_name') tableName: string, @Query() query: any, @Headers('authorization') authorization?: string) {
    try {
      return await this.appService.findAll(tableName, query, authorization);
    } catch (error) {
      throw new NotFoundException(`Table ${tableName} not found or accessible`);
    }
  }

  @Get('api/:table_name/:id')
  @ApiTags('통합')
  @ApiParam({ name: 'table_name', example: 'users', description: '조회할 테이블 이름' })
  @ApiParam({ name: 'id', example: 1, description: '조회할 레코드 ID' })
  @ApiQuery({ name: 'user_id', required: false, description: '사용자 ID (관련 데이터 확인용)' })
  @ApiOperation({ summary: '데이터 상세 조회', description: '지정된 테이블의 특정 데이터를 조회합니다.' })
  @ApiResponse({ status: 200, description: '성공적으로 조회됨' })
  @ApiResponse({ status: 404, description: '데이터를 찾을 수 없음' })
  async findOne(
    @Param('table_name') tableName: string, 
    @Param('id') id: number, 
    @Query('user_id') userId?: number,
    @Headers('authorization') authorization?: string
  ) {
    try {
      return await this.appService.findOne(tableName, id, userId);
    } catch (error) {
      throw new NotFoundException(`Record not found in ${tableName} with id ${id}`);
    }
  }

  @Put('api/:table_name/:id')
  @ApiTags('통합')
  @ApiParam({ name: 'table_name', example: 'users', description: '수정할 테이블 이름' })
  @ApiParam({ name: 'id', example: 1, description: '수정할 레코드 ID' })
  @ApiBody({ 
    description: '수정할 데이터',
    schema: {
      type: 'object',
      example: {}
    }
  })
  @ApiOperation({ summary: '데이터 수정', description: '지정된 테이블의 특정 데이터를 수정합니다.' })
  @ApiResponse({ status: 200, description: '성공적으로 수정됨' })
  @ApiResponse({ status: 404, description: '데이터를 찾을 수 없음' })
  @ApiBearerAuth('bearerAuth')
  async update(@Param('table_name') tableName: string, @Param('id') id: number, @Body() updateDto: any, @Request() req: any) {
    try {
      return await this.appService.update(tableName, id, updateDto);
    } catch (error) {
      throw error;
    }
  }

  @Delete('api/:table_name/:id')
  @ApiTags('통합')
  @ApiParam({ name: 'table_name', example: 'users', description: '삭제할 테이블 이름' })
  @ApiParam({ name: 'id', example: 1, description: '삭제할 레코드 ID' })
  @ApiOperation({ summary: '데이터 삭제', description: '지정된 테이블의 특정 데이터를 삭제합니다.' })
  @ApiResponse({ status: 200, description: '성공적으로 삭제됨' })
  @ApiResponse({ status: 404, description: '데이터를 찾을 수 없음' })
  @ApiBearerAuth('bearerAuth')
  async remove(@Param('table_name') tableName: string, @Param('id') id: number, @Request() req: any) {
    try {
      await this.appService.remove(tableName, id);
      return { message: `Record with id ${id} deleted successfully from ${tableName}` };
    } catch (error) {
      throw error;
    }
  }

  // ===== 개별 모델 삽입 API =====
  @Post('api/users')
  @ApiTags('개별모델 삽입')
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

  @Post('api/patients')
  @ApiTags('개별모델 삽입')
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

  @Post('api/hospitals')
  @ApiTags('개별모델 삽입')
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

  @Post('api/wards')
  @ApiTags('개별모델 삽입')
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

  @Post('api/rooms')
  @ApiTags('개별모델 삽입')
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

  @Post('api/beds')
  @ApiTags('개별모델 삽입')
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

  @Post('api/devices')
  @ApiTags('개별모델 삽입')
  @ApiOperation({ summary: '장치 생성', description: '새로운 링겔 모니터링 장치를 생성합니다.' })
  async createDevice(@Body() data: CreateDeviceDto) {
    try {
      return await this.appService.insertData('devices', data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('api/patient_bed_assignments')
  @ApiTags('개별모델 삽입')
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

  @Post('api/patient_bed_assignments/upsert')
  @ApiTags('환자 침대 배정')
  @ApiOperation({
    summary: '환자 침대 배정 Upsert',
    description: `기존 배정이 있으면 업데이트, 없으면 새로 생성합니다.

    - bed_id가 일치하고 device_id, assigned_at, released_at이 모두 null인 데이터가 있으면 업데이트
    - 없으면 새로운 배정 생성
    - 후처리: devices 테이블 bed_id 업데이트, beds 테이블 status를 occupied로 변경
    - 수액은 별도로 /api/monitoring/assignments/add-infusion 으로 추가`
  })
  @ApiBody({
    description: '환자 침대 배정 데이터',
    schema: {
      type: 'object',
      required: ['bed_id', 'device_id'],
      properties: {
        patient_id: { type: 'number', example: 1, description: '환자 ID (선택)' },
        bed_id: { type: 'number', example: 1, description: '침대 ID (필수)' },
        device_id: { type: 'number', example: 1, description: '디바이스 ID (필수)' },
      }
    }
  })
  @ApiResponse({ status: 200, description: '성공적으로 처리됨 (업데이트 또는 생성)' })
  @ApiResponse({ status: 500, description: '서버 오류' })
  async upsertPatientBedAssignment(@Body() data: any) {
    try {
      return await this.appService.upsertPatientBedAssignment(data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('api/notifications')
  @ApiTags('개별모델 삽입')
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

  @Post('api/user_settings')
  @ApiTags('개별모델 삽입')
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

  @Post('api/access_tokens')
  @ApiTags('개별모델 삽입')
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

  @Post('api/nurse_room_assignments')
  @ApiTags('개별모델 삽입')
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

  @Post('api/terms')
  @ApiTags('개별모델 삽입')
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

  @Post('api/user_term_agreements')
  @ApiTags('개별모델 삽입')
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

  @Post('api/infusions')
  @ApiTags('개별모델 삽입')
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

  @Post('api/drug_orders')
  @ApiTags('개별모델 삽입')
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

  @Post('api/infusion_event_logs')
  @ApiTags('개별모델 삽입')
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

  // ===== 테스트 API =====
  @Post('api/test/trigger-notification')
  @ApiTags('테스트')
  @ApiOperation({
    summary: '알림 테스트',
    description: 'assignment의 퍼센트를 조작해서 알림이 발송되는지 테스트합니다. (user_id=3 대상)'
  })
  @ApiBody({
    description: '테스트 데이터',
    schema: {
      type: 'object',
      properties: {
        assignment_id: { type: 'number', example: 1, description: 'patient_bed_assignment ID' },
        target_percentage: { type: 'number', example: 96, description: '목표 퍼센트 (0-100)' }
      },
      required: ['assignment_id', 'target_percentage']
    }
  })
  @ApiResponse({ status: 200, description: '테스트 성공' })
  async testNotification(@Body() data: { assignment_id: number; target_percentage: number }) {
    try {
      return await this.appService.testNotification(data.assignment_id, data.target_percentage);
    } catch (error) {
      throw new HttpException(
        error.message || 'Test failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}