import {
  Controller,
  Get,
  Param,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { EmrService } from './emr.service';

@ApiTags('EMR')
@Controller()
export class EmrController {
  constructor(
    private readonly emrService: EmrService,
    private readonly jwtService: JwtService,
  ) {}

  private extractUserId(authorization: string): number {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('유효하지 않은 토큰');
    }

    const token = authorization.substring(7);
    try {
      const payload = this.jwtService.verify(token);
      return payload.sub;
    } catch {
      throw new UnauthorizedException('유효하지 않은 토큰');
    }
  }

  @Get('api/emr/wards/my')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 병동 환자 조회',
    description: 'JWT 토큰의 사용자 정보로 배정된 병동의 환자 목록을 조회합니다. 환자 EMR 정보(성별, 나이, 진료과, 담당의 등)와 투약, 디바이스 정보를 포함합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '병동 환자 조회 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            ward: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 1 },
                name: { type: 'string', example: '내과 1병동' },
                code: { type: 'string', example: 'W01' },
              },
            },
            rooms: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  room_id: { type: 'number', example: 1 },
                  room_name: { type: 'string', example: '101' },
                  beds: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        bed_id: { type: 'number', example: 1 },
                        bed_number: { type: 'string', example: 'A1' },
                        bed_status: { type: 'string', example: 'occupied' },
                        patient: {
                          type: 'object',
                          properties: {
                            id: { type: 'number' },
                            name: { type: 'string' },
                            chart_number: { type: 'string' },
                            sex: { type: 'string' },
                            age: { type: 'number' },
                            dept: { type: 'string' },
                            doc: { type: 'string' },
                            resident: { type: 'string' },
                            pa_nurse: { type: 'string' },
                            adm: { type: 'string' },
                          },
                        },
                        assignment: {
                          type: 'object',
                          properties: {
                            id: { type: 'number' },
                            infusion_type: { type: 'string' },
                            total_volume: { type: 'number' },
                            current_volume: { type: 'number' },
                            infusion_gtt: { type: 'number' },
                            infusion_percentage: { type: 'number' },
                            alert_type: { type: 'string' },
                            assigned_at: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async getMyWard(@Headers('authorization') authorization: string) {
    const userId = this.extractUserId(authorization);
    return await this.emrService.getMyWard(userId);
  }

  @Get('api/emr/patients/:id/orders')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '환자 투약 목록 조회',
    description: '환자 ID로 투약 처방 목록을 조회합니다. dc_yn, order_date 필터를 지원합니다.',
  })
  @ApiParam({ name: 'id', description: '환자 ID', example: 1, type: Number })
  @ApiQuery({ name: 'dc_yn', required: false, description: '처방취소여부 (Y/N)', example: 'N' })
  @ApiQuery({ name: 'order_date', required: false, description: '처방일자 (YYYYMMDD)', example: '20250326' })
  @ApiResponse({ status: 200, description: '투약 목록 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async getPatientOrders(
    @Headers('authorization') authorization: string,
    @Param('id') id: number,
    @Query('dc_yn') dcYn?: string,
    @Query('order_date') orderDate?: string,
  ) {
    this.extractUserId(authorization);
    return await this.emrService.getPatientOrders(Number(id), {
      dc_yn: dcYn,
      order_date: orderDate,
    });
  }

  @Get('api/emr/patients/:id/vitals')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '환자 바이탈 조회',
    description: '환자 ID로 바이탈(신장, 체중 등) 기록을 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '환자 ID', example: 1, type: Number })
  @ApiResponse({ status: 200, description: '바이탈 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async getPatientVitals(
    @Headers('authorization') authorization: string,
    @Param('id') id: number,
  ) {
    this.extractUserId(authorization);
    return await this.emrService.getPatientVitals(Number(id));
  }
}
