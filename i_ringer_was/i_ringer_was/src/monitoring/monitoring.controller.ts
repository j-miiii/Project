import { Controller, Get, Put, Post, Param, Query, Body, HttpStatus, HttpException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { AppService } from '../app.service';
import { BulkReleaseDto } from '../dto/patient-bed-assignment.dto';

@ApiTags('Monitoring')
@Controller()
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly appService: AppService
  ) {}

  @Get('api/hierarchy/hospitals/all')
  @ApiOperation({
    summary: '모든 병원 계층 구조 조회',
    description: '모든 병원의 병동, 병실, 침대 정보를 계층 구조로 조회합니다.'
  })
  @ApiResponse({ status: 200, description: '성공적으로 조회됨' })
  async getAllHospitalsHierarchy() {
    try {
      return await this.appService.getAllHospitalsHierarchy();
    } catch (error) {
      throw new NotFoundException('Error fetching hospitals hierarchy');
    }
  }

  @Get('api/monitoring/bed/:bed_id')
  @ApiOperation({
    summary: '[개발용] 침대 ID로 전체 정보 조회',
    description: 'bed_id를 기반으로 침대, 병실, 병동, 병원 정보 및 담당 간호사 정보를 한 번에 조회합니다.'
  })
  @ApiParam({
    name: 'bed_id',
    description: '침대 ID',
    example: 1,
    type: Number
  })
  @ApiResponse({
    status: 200,
    description: '침대 정보 조회 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            bed: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 1 },
                bed_number: { type: 'string', example: 'A1' },
                status: { type: 'string', example: 'occupied' }
              }
            },
            room: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 1 },
                name: { type: 'string', example: '101' }
              }
            },
            ward: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 1 },
                name: { type: 'string', example: '내과 1병동' }
              }
            },
            hospital: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 1 },
                name: { type: 'string', example: '서울대학교병원' }
              }
            },
            nurses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 1 },
                  nickname: { type: 'string', example: '김간호사' },
                  auth_id: { type: 'string', example: 'nurse001' },
                  role: { type: 'string', example: 'nurse' }
                }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: '침대를 찾을 수 없음'
  })
  async getBedInfo(@Param('bed_id') bedId: number) {
    return await this.monitoringService.getBedInfo(Number(bedId));
  }

  @Get('api/monitoring/data/list')
  @ApiOperation({
    summary: '모니터링 데이터 조회',
    description: '병원, 병동, 병실별로 환자 및 링거 상태를 모니터링합니다.'
  })
  @ApiQuery({
    name: 'hospital_id',
    required: false,
    description: '병원 ID (단일값)',
    example: 1
  })
  @ApiQuery({
    name: 'ward_id',
    required: false,
    description: '병동 ID (단일값)',
    example: 1
  })
  @ApiQuery({
    name: 'room_id',
    required: false,
    description: '병실 ID (콤마로 구분된 다중값)',
    example: '1,2,3'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '모니터링 데이터 조회 성공'
  })
  async getMonitoringData(
    @Query('hospital_id') hospitalId?: number,
    @Query('ward_id') wardId?: number,
    @Query('room_id') roomIds?: string,
  ) {
    const filters = {
      hospitalId: hospitalId ? Number(hospitalId) : undefined,
      wardId: wardId ? Number(wardId) : undefined,
      roomIds: roomIds ? roomIds.split(',').map(id => Number(id.trim())) : undefined,
    };

    return await this.monitoringService.getMonitoringData(filters);
  }

  @Post('api/monitoring/assignments/bulk-release')
  @ApiOperation({
    summary: '투여 완료 일괄 처리',
    description: '여러 환자 침대 배정의 투여를 일괄로 완료 처리합니다. 각 ID별로 성공/실패를 개별적으로 처리하고 결과를 반환합니다.'
  })
  @ApiBody({
    type: BulkReleaseDto,
    description: '투여 완료 처리할 assignment ID 배열',
    examples: {
      example1: {
        summary: '3개의 ID 일괄 처리',
        value: {
          ids: [1, 2, 3]
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: '일괄 처리 완료 (개별 성공/실패 정보 포함)',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true, description: '전체 요청 처리 성공 여부' },
        message: { type: 'string', example: 'Bulk release completed: 2 succeeded, 1 failed' },
        data: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 3, description: '전체 처리 항목 수' },
            succeeded: { type: 'number', example: 2, description: '성공한 항목 수' },
            failed: { type: 'number', example: 1, description: '실패한 항목 수' },
            hasFailures: { type: 'boolean', example: true, description: '실패한 항목이 있는지 여부' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  assignment_id: { type: 'number', example: 1 },
                  success: { type: 'boolean', example: true },
                  statusCode: { type: 'number', example: 200 },
                  message: { type: 'string', example: 'Assignment 1 successfully released' },
                  data: {
                    type: 'object',
                    properties: {
                      assignment_id: { type: 'number', example: 1 },
                      released_at: { type: 'string', example: '2025-10-16T12:34:56.789Z' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (빈 배열 또는 유효하지 않은 ID)'
  })
  async releaseBulkAssignments(@Body() bulkReleaseDto: BulkReleaseDto) {
    return await this.monitoringService.releaseBulkAssignments(bulkReleaseDto.ids);
  }

  @Put('api/monitoring/assignments/:id/clear-infusion')
  @ApiOperation({
    summary: '수액 삭제 (환자 유지)',
    description: '수액 관련 필드만 초기화합니다. 환자-침상 연결은 유지됩니다.'
  })
  @ApiParam({
    name: 'id',
    description: 'patient_bed_assignment ID',
    example: 1,
    type: Number
  })
  @ApiResponse({ status: 200, description: '수액 삭제 성공' })
  @ApiResponse({ status: 404, description: 'Assignment를 찾을 수 없음' })
  async clearInfusion(@Param('id') id: number) {
    const result = await this.monitoringService.clearInfusion(Number(id));

    if (!result.success) {
      throw new HttpException(result.message, result.statusCode);
    }

    return result;
  }

  @Put('api/monitoring/assignments/:id/release')
  @ApiOperation({
    summary: '투여 완료 처리 (단일)',
    description: '단일 환자 침대 배정의 투여를 완료 처리합니다. device의 bed_id를 null로 변경하고 assignment의 released_at을 현재 시간으로 업데이트합니다.'
  })
  @ApiParam({
    name: 'id',
    description: 'patient_bed_assignment ID',
    example: 1,
    type: Number
  })
  @ApiResponse({
    status: 200,
    description: '투여 완료 처리 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Assignment 1 successfully released' },
        data: {
          type: 'object',
          properties: {
            assignment_id: { type: 'number', example: 1 },
            released_at: { type: 'string', example: '2025-10-16T12:34:56.789Z' }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Assignment 또는 Device를 찾을 수 없음'
  })
  @ApiResponse({
    status: 409,
    description: '이미 완료 처리된 투여'
  })
  async releaseAssignment(@Param('id') id: number) {
    const result = await this.monitoringService.releaseAssignment(Number(id));

    if (!result.success) {
      throw new HttpException(result.message, result.statusCode);
    }

    return result;
  }

  @Post('api/monitoring/assignments/add-infusion')
  @ApiOperation({
    summary: '수액 추가',
    description: '이미 침대에 배정된 환자에게 수액을 추가합니다. 환자당 최대 3개까지 동시 투여 가능합니다.'
  })
  @ApiBody({
    description: '수액 추가 요청',
    schema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', example: 3341, description: '환자 ID (필수)' },
        bed_id: { type: 'number', example: 10, description: '침대 ID (필수)' },
        infusion_type: { type: 'string', example: '항생제 100ml', description: '수액 종류 (필수)' },
        infusion_code: { type: 'string', example: 'ABX', description: '수액 영문 약어 (선택)' },
        infusion_id: { type: 'number', example: 6, description: '수액 마스터 ID (선택)', nullable: true },
        infusion_total_volume: { type: 'number', example: 100, description: '총 투여량 ml (필수)' },
        infusion_cchr: { type: 'number', example: 197, description: '유속 cc/hr (필수)' },
        drug_order_id: { type: 'number', example: null, description: 'EMR 처방 ID (선택)', nullable: true },
      },
      required: ['patient_id', 'bed_id', 'infusion_type', 'infusion_total_volume', 'infusion_cchr']
    }
  })
  @ApiResponse({ status: 200, description: '수액 추가 성공' })
  @ApiResponse({ status: 400, description: '최대 3개 수액 초과' })
  async addInfusion(@Body() data: {
    patient_id: number;
    bed_id: number;
    infusion_type: string;
    infusion_code?: string;
    infusion_id?: number;
    infusion_total_volume: number;
    infusion_cchr: number;
    drug_order_id?: number;
  }) {
    try {
      return await this.appService.addInfusion(data);
    } catch (error) {
      throw new HttpException(
        error.message || 'Infusion addition failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('api/monitoring/assignments/generate')
  @ApiOperation({
    summary: '가상 환자 배정 데이터 생성',
    description: '병원 정보를 받아서 랜덤한 환자 침대 배정 데이터를 생성합니다. ward_id가 null이면 해당 병원의 모든 병동에서 병실을 선택합니다. 병상은 랜덤 선택, 환자는 랜덤 이름, 기기는 null, 수액 정보는 랜덤 값으로 생성됩니다.'
  })
  @ApiBody({
    description: '배정 데이터 생성 요청',
    schema: {
      type: 'object',
      properties: {
        hospital_id: { type: 'number', example: 23, description: '병원 ID (필수)' },
        ward_id: { type: 'number', example: 60, description: '병동 ID (선택, null이면 병원의 모든 병동 대상)', nullable: true }
      },
      required: ['hospital_id']
    }
  })
  @ApiResponse({
    status: 200,
    description: '배정 데이터 생성 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Mock assignment created successfully' },
        data: {
          type: 'object',
          properties: {
            assignment_id: { type: 'number', example: 100 },
            patient: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 50 },
                name: { type: 'string', example: '김민수' },
                chart_number: { type: 'string', example: 'P1697123456789' }
              }
            },
            bed: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 135 },
                bed_number: { type: 'string', example: 'A1' }
              }
            },
            room: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 82 },
                name: { type: 'string', example: '101' }
              }
            },
            infusion: {
              type: 'object',
              properties: {
                type: { type: 'string', example: '생리식염수' },
                total_volume: { type: 'number', example: 500 },
                current_volume: { type: 'number', example: 0 },
                cchr: { type: 'number', example: 197, description: '유속 cc/hr' }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: '병동 또는 병실을 찾을 수 없음' })
  @ApiResponse({ status: 409, description: '사용 가능한 빈 병상이 없음 (모든 병상이 사용 중)' })
  async generateMockAssignment(@Body() data: { hospital_id: number; ward_id?: number }) {
    try {
      return await this.appService.generateMockAssignment(data.hospital_id, data.ward_id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Assignment generation failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}