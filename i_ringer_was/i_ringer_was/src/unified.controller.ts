import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  Request,
  NotFoundException
} from '@nestjs/common';
import { ApiParam, ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller('api')
@ApiTags('통합')
export class UnifiedController {
  constructor(private readonly appService: AppService) {}

  @Get(':table_name')
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

  @Get(':table_name/:id')
  @ApiParam({ name: 'table_name', example: 'users', description: '조회할 테이블 이름' })
  @ApiParam({ name: 'id', example: 1, description: '조회할 레코드 ID' })
  @ApiQuery({ name: 'user_id', required: false, description: '사용자 ID (관련 데이터 확인용)' })
  @ApiOperation({ summary: '데이터 상세 조회', description: '지정된 테이블의 특정 데이터를 조회합니다.' })
  @ApiResponse({ status: 200, description: '성공적으로 조회됨' })
  @ApiResponse({ status: 404, description: '데이터를 찾을 수 없음' })
  async findOne(
    @Param('table_name') tableName: string,
    @Param('id') id: string,
    @Query('user_id') userId?: number,
    @Headers('authorization') authorization?: string
  ) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new NotFoundException(`Invalid ID format: ${id}`);
    }

    try {
      return await this.appService.findOne(tableName, numericId, userId);
    } catch (error) {
      throw new NotFoundException(`Record not found in ${tableName} with id ${id}`);
    }
  }

  @Post('fcm/test')
  @ApiOperation({ summary: 'FCM 푸시 테스트', description: '특정 사용자에게 FCM 테스트 푸시를 발송합니다.' })
  @ApiBody({
    description: 'FCM 테스트 데이터',
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'number', description: '대상 유저 ID' },
        title: { type: 'string', description: '알림 제목', example: 'FCM 테스트' },
        body: { type: 'string', description: '알림 본문', example: '테스트 메시지입니다.' },
      },
      required: ['user_id', 'title', 'body'],
    },
  })
  @ApiResponse({ status: 200, description: 'FCM 발송 결과' })
  async sendFcmTest(@Body() body: { user_id: number; title: string; body: string }) {
    return await this.appService.sendFcmTest(body.user_id, body.title, body.body);
  }

  @Post('notifications/mark-all-read')
  @ApiOperation({ summary: '알림 전체 읽음 처리', description: '특정 사용자의 미읽은 알림을 일괄 읽음 처리합니다.' })
  @ApiBody({
    description: '사용자 ID',
    schema: { type: 'object', properties: { user_id: { type: 'number' } }, required: ['user_id'] }
  })
  @ApiResponse({ status: 200, description: '성공적으로 처리됨' })
  @ApiBearerAuth('bearerAuth')
  async markAllNotificationsAsRead(@Body() body: { user_id: number }) {
    return await this.appService.markAllNotificationsAsRead(body.user_id);
  }

  @Put(':table_name/:id')
  @ApiParam({ name: 'table_name', example: 'users', description: '수정할 테이블 이름' })
  @ApiParam({ name: 'id', example: 1, description: '수정할 레코드 ID' })
  @ApiBody({ 
    description: '수정할 데이터',
    schema: {
      type: 'object',
      example: {
      }
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

  @Delete(':table_name/:id')
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
}