import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';

@ApiTags('통계')
@Controller('api/statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  /**
   * GET /api/statistics/all/dashboard
   *
   * 통계 페이지 All-in-One API
   *
   * @param start_date - 시작 날짜 (YYYY-MM-DD)
   * @param end_date - 종료 날짜 (YYYY-MM-DD)
   * @param hospital_id - 병원 ID
   * @param ward_id - 병동 ID (선택)
   * @param room_id - 병실 ID (선택)
   * @param granularity - 집계 기준 (daily, weekly, monthly, yearly)
   */
  @Get('all/dashboard')
  @ApiQuery({ name: 'start_date', required: true, example: '2025-10-20', description: '시작 날짜 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'end_date', required: true, example: '2025-10-27', description: '종료 날짜 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'hospital_id', required: false, example: '21', description: '병원 ID (선택, 없으면 전체 병원 집계)' })
  @ApiQuery({ name: 'ward_id', required: false, example: '51', description: '병동 ID (선택)' })
  @ApiQuery({ name: 'room_id', required: false, example: '101', description: '병실 ID (선택)' })
  @ApiQuery({ name: 'granularity', required: false, example: 'daily', description: '집계 기준 (daily, weekly, monthly, yearly)', enum: ['daily', 'weekly', 'monthly', 'yearly'] })
  async getAllDashboard(
    @Query('start_date') start_date: string,
    @Query('end_date') end_date: string,
    @Query('hospital_id') hospital_id?: string,
    @Query('ward_id') ward_id?: string,
    @Query('room_id') room_id?: string,
    @Query('granularity') granularity: string = 'daily',
  ) {
    // 필수 파라미터 검증
    if (!start_date || !end_date) {
      throw new HttpException(
        'start_date and end_date are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // granularity 검증
    const validGranularities = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validGranularities.includes(granularity)) {
      throw new HttpException(
        `Invalid granularity. Must be one of: ${validGranularities.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const query = {
      start_date,
      end_date,
      hospital_id: hospital_id ? parseInt(hospital_id) : undefined,
      ward_id: ward_id ? parseInt(ward_id) : undefined,
      room_id: room_id ? parseInt(room_id) : undefined,
      granularity: granularity as 'daily' | 'weekly' | 'monthly' | 'yearly',
    };

    return await this.statisticsService.getAllDashboardStatistics(query);
  }

  /**
   * GET /api/statistics/debug/device-usage
   * 디버그용: 특정 기기의 상세 사용 데이터 조회
   */
  @Get('debug/device-usage')
  @ApiQuery({ name: 'device_id', required: true, example: '81' })
  @ApiQuery({ name: 'start_date', required: true, example: '2025-10-20' })
  @ApiQuery({ name: 'end_date', required: true, example: '2025-10-27' })
  async getDeviceUsageDebug(
    @Query('device_id') device_id: string,
    @Query('start_date') start_date: string,
    @Query('end_date') end_date: string,
  ) {
    return await this.statisticsService.getDeviceUsageDebug(
      parseInt(device_id),
      start_date,
      end_date,
    );
  }
}
