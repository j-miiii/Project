import { Injectable, HttpException, HttpStatus, Logger, Inject, forwardRef } from '@nestjs/common';
import { DataSource, Repository, In, IsNull, Not } from 'typeorm';

// Import entity classes
import { User } from './entities/user.entity';
import { Patient } from './entities/patient.entity';
import { Hospital } from './entities/hospital.entity';
import { Ward } from './entities/ward.entity';
import { Room } from './entities/room.entity';
import { Bed } from './entities/bed.entity';
import { Device } from './entities/device.entity';
import { PatientBedAssignment } from './entities/patient-bed-assignment.entity';
import { InfusionRawLog } from './entities/infusion-raw-log.entity';
import { Notification } from './entities/notification.entity';
import { UserSetting } from './entities/user-setting.entity';
import { AccessToken } from './entities/access-token.entity';
import { UserLockoutStatus } from './entities/user-lockout-status.entity';
import { UserLockoutLog } from './entities/user-lockout-log.entity';
import { DrugOrder } from './entities/drug-order.entity';
import { Infusion } from './entities/infusion.entity';
import { PatientVital } from './entities/patient-vital.entity';
import { NurseRoomAssignment } from './entities/nurse-room-assignment.entity';
import { Term } from './entities/term.entity';
import { UserTermAgreement } from './entities/user-term-agreement.entity';
import { InfusionEventLog } from './entities/infusion-event-log.entity';
import { WardSetting } from './entities/ward-setting.entity';
import { MqttService } from './mqtt/mqtt.service';
import { FcmService } from './fcm/fcm.service';

// GTT ↔ CC/HR conversion (1 gtt = 3.282 cc/hr)
function gttToCcHr(gtt: number): number {
  return Math.round(gtt * 3.282);
}
function ccHrToGtt(ccHr: number): number {
  return ccHr / 3.282;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  private entityMap: Record<string, any> = {
    'users': User,
    'patients': Patient,
    'hospitals': Hospital,
    'wards': Ward,
    'rooms': Room,
    'beds': Bed,
    'devices': Device,
    'patient_bed_assignments': PatientBedAssignment,
    'infusion_raw_logs': InfusionRawLog,
    'notifications': Notification,
    'user_settings': UserSetting,
    'access_tokens': AccessToken,
    'user_lockout_status': UserLockoutStatus,
    'user_lockout_log': UserLockoutLog,
    'drug_orders': DrugOrder,
    'infusions': Infusion,
    'patient_vitals': PatientVital,
    'nurse_room_assignments': NurseRoomAssignment,
    'terms': Term,
    'user_term_agreements': UserTermAgreement,
    'infusion_event_logs': InfusionEventLog,
    'ward_settings': WardSetting,
  };

  constructor(
    private dataSource: DataSource,
    @Inject(forwardRef(() => MqttService))
    private mqttService: MqttService,
    private fcmService: FcmService,
  ) {}

  /**
   * alert_type으로부터 alert_category를 자동 매핑
   * - critical (위급): stop, done, fast
   * - caution (주의): slow, almost_done
   * - system_error (시스템오류): disconnected
   */
  private deriveAlertCategory(alertType: string): string | null {
    if (!alertType) return null;
    switch (alertType) {
      case 'stop':
      case 'done':
      case 'fast':
        return 'critical';
      case 'slow':
      case 'almost_done':
        return 'caution';
      case 'disconnected':
        return 'system_error';
      default:
        return null;
    }
  }

  // Repository 헬퍼 메서드
  private getRepository(tableName: string): Repository<any> {
    // Special routes that should not be handled as table names
    const specialRoutes = ['monitoring', 'mqtt', 'auth', 'emr'];
    if (specialRoutes.includes(tableName)) {
      throw new HttpException(`Table ${tableName} not found or accessible`, HttpStatus.NOT_FOUND);
    }
    
    const entityClass = this.entityMap[tableName];
    if (!entityClass) {
      throw new HttpException(`Unknown table: ${tableName}`, HttpStatus.BAD_REQUEST);
    }
    return this.dataSource.getRepository(entityClass);
  }

  // 데이터 목록 조회
  async findAll(tableName: string, query: any, authorization?: string): Promise<any> {
    try {
      const repository = this.getRepository(tableName);
      const queryBuilder = repository.createQueryBuilder(tableName);

      // where 조건 처리
      if (query.where) {
        const whereConditions = query.where.split(',');
        whereConditions.forEach((condition: string, index: number) => {
          const [key, value] = condition.split(':');
          if (key && value) {
            if (index === 0) {
              queryBuilder.andWhere(`${tableName}.${key} = :${key}`, { [key]: value });
            } else {
              queryBuilder.andWhere(`${tableName}.${key} = :${key}${index}`, { [`${key}${index}`]: value });
            }
          }
        });
      }

      // search 조건 처리 (name 컬럼이 있는 경우)
      if (query.search) {
        queryBuilder.andWhere(`${tableName}.name LIKE :search`, { search: `%${query.search}%` });
      }

      // 날짜 범위 조건 처리
      if (query.start_date) {
        queryBuilder.andWhere(`${tableName}.created_at >= :start_date`, { start_date: query.start_date });
      }
      if (query.end_date) {
        queryBuilder.andWhere(`${tableName}.created_at <= :end_date`, { end_date: query.end_date });
      }

      // order 조건 처리
      if (query.order) {
        const orderConditions = query.order.split(',');
        orderConditions.forEach((condition: string) => {
          const [key, direction] = condition.split(':');
          if (key && direction) {
            queryBuilder.addOrderBy(`${tableName}.${key}`, direction.toUpperCase() as 'ASC' | 'DESC');
          }
        });
      } else {
        queryBuilder.orderBy(`${tableName}.id`, 'DESC');
      }

      // 페이징 처리
      const limit = parseInt(query.limit) || 10;
      const page = parseInt(query.page) || 1;
      const offset = (page - 1) * limit;
      
      queryBuilder.skip(offset).take(limit);

      const [rawData, total] = await queryBuilder.getManyAndCount();

      // users 테이블인 경우 응답 데이터 형식화
      let data = rawData;
      if (tableName === 'users') {
        // 모든 hospital_id, ward_id, user_id 수집
        const hospitalIds = [...new Set(rawData.map(u => u.hospital_id).filter(id => id))];
        const wardIds = [...new Set(rawData.map(u => u.ward_id).filter(id => id))];
        const userIds = rawData.map(u => u.id);

        // hospitals, wards, user_lockout_status 일괄 조회
        const hospitalRepository = this.getRepository('hospitals');
        const wardRepository = this.getRepository('wards');
        const lockoutStatusRepository = this.getRepository('user_lockout_status');

        const hospitals = hospitalIds.length > 0
          ? await hospitalRepository.findBy({ id: In(hospitalIds) })
          : [];
        const wards = wardIds.length > 0
          ? await wardRepository.findBy({ id: In(wardIds) })
          : [];
        const lockoutStatuses = userIds.length > 0
          ? await lockoutStatusRepository.findBy({ user_id: In(userIds) })
          : [];

        // Map으로 변환 (빠른 조회)
        const hospitalMap = new Map(hospitals.map(h => [h.id, h]));
        const wardMap = new Map(wards.map(w => [w.id, w]));
        const lockoutMap = new Map(lockoutStatuses.map(l => [l.user_id, l]));

        data = rawData.map(user => {
          const result: any = {
            id: user.id,
            role: user.role,
            auth_id: user.auth_id,
            nickname: user.nickname,
            hospital_id: user.hospital_id,
            ward_id: user.ward_id,
            has_emr: user.has_emr,
            emr_user_key: user.emr_user_key || null,
            emr_group_code: user.emr_group_code || null,
            emr_group_desc: user.emr_group_desc || null,
            dept_code: user.dept_code || null,
            employee_number: user.employee_number || null,
            profile_image: user.profile_image || '/images/default_profile.png',
            created_at: user.created_at,
            updated_at: user.updated_at
          };

          // hospital_id가 있고 관련 정보가 조회된 경우
          if (user.hospital_id) {
            const hospital = hospitalMap.get(user.hospital_id);
            if (hospital) {
              result.hospital_info = {
                hospital_id: hospital.id,
                hospital_name: hospital.name
              };
            }
          }

          // ward_id가 있고 관련 정보가 조회된 경우
          if (user.ward_id) {
            const ward = wardMap.get(user.ward_id);
            if (ward) {
              result.ward_info = {
                ward_id: ward.id,
                ward_name: ward.name
              };
            }
          }

          // 계정 잠금 상태 추가
          const lockoutStatus = lockoutMap.get(user.id);
          result.is_locked = lockoutStatus ? lockoutStatus.is_locked : false;
          result.failure_count = lockoutStatus ? lockoutStatus.failure_count : 0;

          return result;
        });
      }

      // patient_bed_assignments 테이블인 경우 관련 데이터 JOIN
      if (tableName === 'patient_bed_assignments') {
        const patientIds = [...new Set(rawData.map(a => a.patient_id).filter(id => id))];
        const bedIds = [...new Set(rawData.map(a => a.bed_id).filter(id => id))];

        const patientRepository = this.getRepository('patients');
        const bedRepository = this.getRepository('beds');

        const patients = patientIds.length > 0
          ? await patientRepository.findBy({ id: In(patientIds) })
          : [];
        const beds = bedIds.length > 0
          ? await bedRepository.find({ where: { id: In(bedIds) }, relations: ['room', 'room.ward', 'room.ward.hospital'] })
          : [];

        const patientMap = new Map(patients.map(p => [p.id, p]));
        const bedMap = new Map(beds.map(b => [b.id, b]));

        data = rawData.map(assignment => {
          const result: any = { ...assignment };
          const patient = assignment.patient_id ? patientMap.get(assignment.patient_id) : null;
          const bed = assignment.bed_id ? bedMap.get(assignment.bed_id) : null;

          if (patient) {
            result.patient_name = patient.name;
            result.chart_number = patient.chart_number;
            result.sex = patient.sex;
            result.age = patient.age;
          }
          if (bed) {
            result.bed_number = bed.bed_number;
            if (bed.room) {
              result.room_number = bed.room.name;
              if (bed.room.ward) {
                result.ward_name = bed.room.ward.name;
                if (bed.room.ward.hospital) {
                  result.hospital_name = bed.room.ward.hospital.name;
                }
              }
            }
          }

          return result;
        });
      }

      // devices 테이블인 경우 bed, room, ward, hospital 관련 데이터 추가
      if (tableName === 'devices') {
        // 모든 bed_id 수집
        const bedIds = [...new Set(rawData.map(d => d.bed_id).filter(id => id))];

        // beds 일괄 조회 (room, ward, hospital relations 포함)
        const bedRepository = this.getRepository('beds');
        const beds = bedIds.length > 0
          ? await bedRepository.find({ where: { id: In(bedIds) }, relations: ['room', 'room.ward', 'room.ward.hospital'] })
          : [];

        // Map으로 변환 (빠른 조회)
        const bedMap = new Map(beds.map(b => [b.id, b]));

        data = rawData.map(device => {
          const result: any = { ...device };

          // bed_id가 있으면 bed, room, ward, hospital 정보 추가
          if (device.bed_id) {
            const bed = bedMap.get(device.bed_id);
            if (bed) {
              result.bed = bed;
              result.bed_number = bed.bed_number;
              if (bed.room) {
                result.room = bed.room;
                result.room_id = bed.room.id;
                result.room_number = bed.room.name;
                if (bed.room.ward) {
                  result.ward = bed.room.ward;
                  result.ward_id = bed.room.ward.id;
                  result.ward_name = bed.room.ward.name;
                  if (bed.room.ward.hospital) {
                    result.hospital = bed.room.ward.hospital;
                    result.hospital_id = bed.room.ward.hospital.id;
                    result.hospital_name = bed.room.ward.hospital.name;
                  }
                }
              }
            }
          }

          return result;
        });
      }

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      this.logger.error(`Error in findAll for ${tableName}:`, error);
      throw new HttpException(
        error.message || 'Error fetching data',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 데이터 상세 조회
  async findOne(tableName: string, id: number, userId?: number): Promise<any> {
    try {
      const repository = this.getRepository(tableName);
      const queryBuilder = repository.createQueryBuilder(tableName);
      queryBuilder.where(`${tableName}.id = :id`, { id });

      // devices 테이블인 경우 bed relation JOIN
      if (tableName === 'devices') {
        queryBuilder.leftJoinAndSelect(`${tableName}.bed`, 'bed');
        queryBuilder.leftJoinAndSelect('bed.room', 'room');
        queryBuilder.leftJoinAndSelect('room.ward', 'ward');
        queryBuilder.leftJoinAndSelect('ward.hospital', 'hospital');
      }

      // userId가 제공된 경우 추가 조건 확인 (필요시)
      if (userId && tableName === 'notifications') {
        queryBuilder.andWhere(`${tableName}.user_id = :userId`, { userId });
      }

      const result = await queryBuilder.getOne();

      if (!result) {
        throw new HttpException(
          `Record not found in ${tableName} with id ${id}`,
          HttpStatus.NOT_FOUND,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Error in findOne for ${tableName}:`, error);
      throw error;
    }
  }

  // 데이터 수정
  async update(tableName: string, id: number, updateDto: any): Promise<any> {
    try {
      this.logger.log(`[UPDATE INPUT] Table: ${tableName}, ID: ${id}, Body: ${JSON.stringify(updateDto)}`);
      const repository = this.getRepository(tableName);

      // updateDto 유효성 검사
      if (!updateDto || Object.keys(updateDto).length === 0) {
        throw new HttpException(
          'Update data is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 먼저 해당 레코드가 존재하는지 확인
      const existingRecord = await repository.findOne({ where: { id } });
      if (!existingRecord) {
        throw new HttpException(
          `Record not found in ${tableName} with id ${id}`,
          HttpStatus.NOT_FOUND,
        );
      }

      // id, created_at, updated_at 필드 제거 (수정 불가 필드)
      const filteredUpdateDto = { ...updateDto };
      delete filteredUpdateDto.id;
      delete filteredUpdateDto.created_at;
      delete filteredUpdateDto.updated_at;

      // -------------0622 데이터 확인을 위한 추가 부분-------------
      const isChangeButtonClicked = updateDto.infusion_change_button === true; // 수액 교체 버튼이 true 인지?

      delete filteredUpdateDto.infusion_change_button;        //   파라미터용으로 DB 테이블 컬럼에 없어 
      delete filteredUpdateDto.infusion_current_volume;      //    에러방지로 지워주기
      //---------------------------------------------------------

      // 필터링 후에도 업데이트할 데이터가 있는지 확인
      if (Object.keys(filteredUpdateDto).length === 0) {
        throw new HttpException(
          'No valid fields to update',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 테이블별 전처리 작업 (업데이트 전)
      if (tableName === 'users') {
        // name → nickname 매핑 (프론트엔드 호환)
        if (filteredUpdateDto.name && !filteredUpdateDto.nickname) {
          filteredUpdateDto.nickname = filteredUpdateDto.name;
        }
        delete filteredUpdateDto.name;

        // fcm_token 빈 문자열 → null 변환 (앱 로그아웃 시 클리어)
        if (filteredUpdateDto.fcm_token === '' || filteredUpdateDto.fcm_token === null) {
          filteredUpdateDto.fcm_token = null;
        }

        // fcm_token 설정 시 동일 토큰을 가진 다른 계정의 토큰 null 처리 (1기기 1계정 보장)
        if (filteredUpdateDto.fcm_token && filteredUpdateDto.fcm_token !== '') {
          await repository.createQueryBuilder()
            .update()
            .set({ fcm_token: null })
            .where('fcm_token = :token AND id != :userId', {
              token: filteredUpdateDto.fcm_token,
              userId: id,
            })
            .execute();
        }

        // 허용 필드만 통과 (존재하지 않는 컬럼 차단)
        const allowedUserFields = [
          'role', 'auth_id', 'password', 'nickname',
          'hospital_id', 'ward_id', 'has_emr', 'emr_user_key',
          'emr_group_code', 'emr_group_desc', 'dept_code',
          'employee_number', 'profile_image', 'fcm_token',
        ];
        for (const key of Object.keys(filteredUpdateDto)) {
          if (!allowedUserFields.includes(key)) {
            this.logger.warn(`[USER UPDATE] Unknown field removed: ${key}`);
            delete filteredUpdateDto[key];
          }
        }

        // 필터링 후 업데이트할 데이터가 없으면 에러
        if (Object.keys(filteredUpdateDto).length === 0) {
          throw new HttpException(
            'No valid fields to update for users',
            HttpStatus.BAD_REQUEST,
          );
        }

        // users 테이블의 auth_id 중복 체크
        if (filteredUpdateDto.auth_id) {
          const existingUser = await repository.findOne({
            where: { auth_id: filteredUpdateDto.auth_id }
          });

          // 자기 자신을 제외하고 중복 체크
          if (existingUser && existingUser.id !== id) {
            throw new HttpException(
              `이미 사용 중인 ID입니다: ${filteredUpdateDto.auth_id}`,
              HttpStatus.CONFLICT
            );
          }
        }

        // employee_number: 동일한 값이면 업데이트에서 제외 (불필요한 변경 방지)
        if (filteredUpdateDto.employee_number && filteredUpdateDto.employee_number === existingRecord.employee_number) {
          delete filteredUpdateDto.employee_number;
        }

        // users 테이블의 password 암호화
        if (filteredUpdateDto.password) {
          const bcrypt = require('bcrypt');
          filteredUpdateDto.password = await bcrypt.hash(filteredUpdateDto.password, 10);
          this.logger.log(`[USER UPDATE] Password encrypted for user ${id}`);
        }
      }

      if (tableName === 'hospitals' && filteredUpdateDto.name) {
        // hospitals 테이블의 name 중복 체크 (띄어쓰기 무시)
        const normalizedName = filteredUpdateDto.name.replace(/\s+/g, '');
        const allHospitals = await repository.find();

        // 자기 자신을 제외하고 중복 체크
        const duplicate = allHospitals.find(hospital =>
          hospital.id !== id && hospital.name.replace(/\s+/g, '') === normalizedName
        );

        if (duplicate) {
          throw new HttpException(
            `동일한 이름의 병원이 이미 존재합니다: ${duplicate.name}`,
            HttpStatus.CONFLICT
          );
        }
      }

      if (tableName === 'devices') {
        // devices 테이블의 serial_number 중복 체크
        if (filteredUpdateDto.serial_number) {
          const existingDevice = await repository.findOne({
            where: { serial_number: filteredUpdateDto.serial_number }
          });

          // 자기 자신을 제외하고 중복 체크
          if (existingDevice && existingDevice.id !== id) {
            throw new HttpException(
              `동일한 시리얼 번호의 장치가 이미 존재합니다: ${filteredUpdateDto.serial_number}`,
              HttpStatus.CONFLICT
            );
          }
        }

        // devices 테이블의 hospital_id 변경 시 ward_id, room_id 초기화 (함께 전송된 값은 유지)
        if (filteredUpdateDto.hospital_id !== undefined) {
          if (existingRecord.hospital_id !== filteredUpdateDto.hospital_id) {
            if (filteredUpdateDto.ward_id === undefined) {
              filteredUpdateDto.ward_id = null;
            }
            filteredUpdateDto.room_id = null;
            this.logger.log(`[DEVICE UPDATE] Hospital changed for device ${id}, resetting location (ward_id: ${filteredUpdateDto.ward_id}, room_id: null)`);
          }
        }
      }

      // patient_bed_assignments 테이블의 필드 매핑
      if (tableName === 'patient_bed_assignments') {
        // infusion_cchr 필드 직접 처리 (클라이언트에서 infusion_cchr로 전송)
        // 하위 호환: infusion_cc_hr로 보내는 경우에도 매핑
        if (filteredUpdateDto.infusion_cc_hr !== undefined) {
          filteredUpdateDto.infusion_cchr = filteredUpdateDto.infusion_cc_hr;
          delete filteredUpdateDto.infusion_cc_hr;
        }

        // 수액 교체 시 usage_count 증가
        if (filteredUpdateDto.infusion_type && filteredUpdateDto.infusion_type !== existingRecord.infusion_type) {
          try {
            const infusionRepository = this.getRepository('infusions');
            if (filteredUpdateDto.infusion_id) {
              await infusionRepository.increment({ id: filteredUpdateDto.infusion_id }, 'usage_count', 1);
              this.logger.log(`[CHANGE_INFUSION] usage_count incremented for infusion_id=${filteredUpdateDto.infusion_id}`);
            } else {
              const infusion = await infusionRepository.findOne({ where: { name: filteredUpdateDto.infusion_type, is_active: true } });
              if (infusion) {
                await infusionRepository.increment({ id: infusion.id }, 'usage_count', 1);
                this.logger.log(`[CHANGE_INFUSION] usage_count incremented for infusion name="${filteredUpdateDto.infusion_type}" (id=${infusion.id})`);
              }
            }
          } catch (usageError) {
            this.logger.error(`[CHANGE_INFUSION] usage_count update failed: ${usageError.message}`);
          }
        }
      }

      // patient_bed_assignments 테이블의 device_id 변경 시 assigned_at 자동 갱신
      if (tableName === 'patient_bed_assignments' && filteredUpdateDto.device_id !== undefined) {
        if (existingRecord.device_id !== filteredUpdateDto.device_id) {
          filteredUpdateDto.assigned_at = new Date();
          filteredUpdateDto.alert_type = null;
          filteredUpdateDto.alert_category = null;
          this.logger.log(`[ASSIGNMENT UPDATE] Device changed for assignment ${id}: ${existingRecord.device_id} → ${filteredUpdateDto.device_id}, resetting assigned_at and clearing alerts`);
        }
      }

      if (tableName === 'rooms' && filteredUpdateDto.bed_count !== undefined) {
        // rooms 테이블의 bed_count 수정 전처리
        const oldBedCount = existingRecord.bed_count || 0;
        const newBedCount = filteredUpdateDto.bed_count;

        if (oldBedCount !== newBedCount) {
          this.logger.log(`[ROOM UPDATE] Room ${id} bed_count change: ${oldBedCount} -> ${newBedCount}`);

          if (newBedCount < oldBedCount) {
            // bed_count 감소: available 침대 우선 삭제
            const bedRepository = this.getRepository('beds');
            const deleteCount = oldBedCount - newBedCount;

            this.logger.log(`[ROOM UPDATE DEBUG] Starting bed_count decrease for room ${id}: ${oldBedCount} -> ${newBedCount}`);

            // 1. 해당 room의 모든 beds 조회
            const allBeds = await bedRepository.find({
              where: { room_id: id },
              order: { id: 'ASC' }
            });

            this.logger.log(`[ROOM UPDATE DEBUG] All beds:`, allBeds.map(b => ({ id: b.id, bed_number: b.bed_number, status: b.status })));

            // 2. available 침대만 필터링하고 bed_number 큰 순서로 정렬
            const availableBeds = allBeds
              .filter(bed => bed.status === 'available')
              .sort((a, b) => {
                const aNum = parseInt(a.bed_number) || 0;
                const bNum = parseInt(b.bed_number) || 0;
                return bNum - aNum; // 큰 번호부터
              });

            this.logger.log(`[ROOM UPDATE] Total beds: ${allBeds.length}, Available: ${availableBeds.length}, Need to delete: ${deleteCount}`);

            // 3. available 침대가 충분한지 체크
            if (availableBeds.length < deleteCount) {
              throw new HttpException(
                '사용 중인 병상이 있습니다. 투여 완료 처리 후 다시 시도해주세요',
                HttpStatus.CONFLICT,
              );
            }

            // 4. 삭제할 침대 선정 (available 중 bed_number가 큰 것부터)
            const bedsToDelete = availableBeds.slice(0, deleteCount);

            // 5. 삭제 전 체크: devices와 연결된 bed가 있는지
            const deviceRepository = this.getRepository('devices');
            for (const bed of bedsToDelete) {
              const connectedDevice = await deviceRepository.findOne({
                where: { bed_id: bed.id }
              });

              if (connectedDevice) {
                throw new HttpException(
                  '해당 병실에 연결된 기기를 제거 후 다시 시도해주세요',
                  HttpStatus.CONFLICT,
                );
              }
            }

            // 6. patient_bed_assignments의 bed_id를 NULL로 설정 (데이터는 보존)
            const assignmentRepository = this.getRepository('patient_bed_assignments');

            for (const bed of bedsToDelete) {
              // 해당 bed_id의 patient_bed_assignments의 bed_id를 NULL로 설정
              await assignmentRepository.update(
                { bed_id: bed.id },
                { bed_id: null }
              );
            }

            // 7. beds 삭제
            await bedRepository.remove(bedsToDelete);
            this.logger.log(`[ROOM UPDATE] Deleted ${bedsToDelete.length} beds`);

            // 8. 남은 침대들의 bed_number 재정렬 (id 순서대로 1, 2, 3...)
            const remainingBeds = allBeds.filter(bed =>
              !bedsToDelete.find(deletedBed => deletedBed.id === bed.id)
            );

            this.logger.log(`[ROOM UPDATE DEBUG] Remaining beds before renumber:`, remainingBeds.map(b => ({ id: b.id, bed_number: b.bed_number })));

            for (let i = 0; i < remainingBeds.length; i++) {
              const oldNumber = remainingBeds[i].bed_number;
              remainingBeds[i].bed_number = String(i + 1);
              this.logger.log(`[ROOM UPDATE DEBUG] Renumbering bed ${remainingBeds[i].id}: ${oldNumber} -> ${i + 1}`);
              await bedRepository.save(remainingBeds[i]);
            }

            this.logger.log(`[ROOM UPDATE] Renumbered ${remainingBeds.length} remaining beds`);
          }
        }
      }

      // 업데이트 실행
      this.logger.log(`[UPDATE] Table: ${tableName}, ID: ${id}, Data: ${JSON.stringify(filteredUpdateDto)}`);
      await repository.update(id, filteredUpdateDto);

      // 테이블별 후처리 작업 (업데이트 후)
      if (tableName === 'rooms' && filteredUpdateDto.bed_count !== undefined) {
        const oldBedCount = existingRecord.bed_count || 0;
        const newBedCount = filteredUpdateDto.bed_count;

        if (newBedCount > oldBedCount) {
          // bed_count 증가: 새로운 bed들 추가
          const bedRepository = this.getRepository('beds');
          const bedsToCreate = [];

          for (let i = oldBedCount + 1; i <= newBedCount; i++) {
            bedsToCreate.push({
              room_id: id,
              bed_number: String(i),
              status: 'available',
            });
          }

          await bedRepository.save(bedsToCreate);
          this.logger.log(`[ROOM UPDATE] Added ${bedsToCreate.length} new beds (${oldBedCount + 1} to ${newBedCount})`);
        }
      }

      // 업데이트된 레코드 조회하여 반환
      const updatedRecord = await repository.findOne({ where: { id } });

      // patient_bed_assignments 업데이트 시 device 위치 업데이트 + MQTT 알림 발송
      if (tableName === 'patient_bed_assignments' && updatedRecord) {

        // =============== [여기서부터 코드 추가!] ===============  오더속도 전달
        // 기기가 방금 연결되었고(device_id 존재), 수액 용량 정보가 있다면 기기로 쏴줍니다.
        if (updatedRecord.device_id && updatedRecord.infusion_total_volume) {
          try {
            const deviceRepository = this.getRepository('devices');
            const targetDevice = await deviceRepository.findOne({ where: { id: updatedRecord.device_id } });
            
            if (targetDevice && targetDevice.serial_number) {
              this.mqttService.sendDeviceSetting(targetDevice.serial_number, {
                totalVolume: updatedRecord.infusion_total_volume,
                flowRate: updatedRecord.infusion_cchr || 0, // 오더속도 추가

                // 👇 [수정] 무조건 0이 아니라, 버튼이 눌렸을 때(true)만 0을 보냅니다!       0622 수정 내용
                infusion_current_volume: isChangeButtonClicked ? 0 : undefined,
                infusion_change_button: isChangeButtonClicked ? true : undefined
                //-------------------------------------------------------------
              });
              this.logger.log(`[TEST]2 기기(${targetDevice.serial_number})로 보낸 교체 파라미터 작동여부: ${isChangeButtonClicked}`);
              this.logger.log(`[ASSIGNMENT UPDATE] 기기(${targetDevice.serial_number})로 전송 완료! (총 용량: ${updatedRecord.infusion_total_volume}ml, 처방 속도: ${updatedRecord.infusion_cchr || 0}cc/hr)`);
            }
          } catch (e) {
            this.logger.error(`[ASSIGNMENT UPDATE] 기기 설정 전송 실패: ${e.message}`);
          }
        }

        
        // device_id 변경 시 device 위치 동기화
        if (updatedRecord.device_id && updatedRecord.bed_id) {
          // device_id가 설정된 경우: 위치 정보 업데이트
          try {
            const deviceRepository = this.getRepository('devices');
            const bedRepository = this.getRepository('beds');
            const bed = await bedRepository.findOne({
              where: { id: updatedRecord.bed_id },
              relations: ['room', 'room.ward']
            });
            if (bed?.room?.ward) {
              await deviceRepository.update(updatedRecord.device_id, {
                bed_id: updatedRecord.bed_id,
                room_id: bed.room.id,
                ward_id: bed.room.ward.id,
                hospital_id: bed.room.ward.hospital_id,
                last_udpate_at: new Date(),
              });
              this.logger.log(`[ASSIGNMENT UPDATE] Updated device ${updatedRecord.device_id} location - bed_id: ${updatedRecord.bed_id}, room_id: ${bed.room.id}`);
            }

            // 기기 변경(A→B)인 경우: 기존 기기(A)의 위치 초기화
            if (existingRecord.device_id && existingRecord.device_id !== updatedRecord.device_id) {
              await deviceRepository.update(existingRecord.device_id, {
                bed_id: null,
                room_id: null,
                last_udpate_at: new Date(),
              });
              this.logger.log(`[ASSIGNMENT UPDATE] Cleared old device ${existingRecord.device_id} location (device changed to ${updatedRecord.device_id})`);
            }
          } catch (deviceError) {
            this.logger.error(`[ASSIGNMENT UPDATE] Device location update failed: ${deviceError.message}`);
          }
        } else if (!updatedRecord.device_id && existingRecord.device_id) {
          // device_id가 null로 변경된 경우 (기기 해제): 이전 device의 위치 초기화
          try {
            const deviceRepository = this.getRepository('devices');
            await deviceRepository.update(existingRecord.device_id, {
              bed_id: null,
              room_id: null,
              last_udpate_at: new Date(),
            });
            this.logger.log(`[ASSIGNMENT UPDATE] Cleared device ${existingRecord.device_id} location (device disconnected)`);
          } catch (deviceError) {
            this.logger.error(`[ASSIGNMENT UPDATE] Device location clear failed: ${deviceError.message}`);
          }
        }

        try {
          const bedId = updatedRecord.bed_id || existingRecord.bed_id;
          if (bedId) {
            const bedRepository = this.getRepository('beds');
            const bed = await bedRepository.findOne({
              where: { id: bedId },
              relations: ['room', 'room.ward']
            });
            if (bed?.room?.ward?.hospital_id) {
              await this.sendAssignmentRefreshNotification(bed.room.ward.hospital_id, {
                assignment_id: id,
                bed_id: bedId,
                action: 'update'
              });
            }
          }
        } catch (mqttError) {
          this.logger.error(`[ASSIGNMENT UPDATE] MQTT notification failed: ${mqttError.message}`);
        }
      }

      return updatedRecord;
    } catch (error) {
      this.logger.error(`Error in update for ${tableName}:`, error);
      throw error;
    }
  }

  // FCM 테스트 발송
  async sendFcmTest(userId: number, title: string, body: string): Promise<any> {
    const userRepo = this.getRepository('users');
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return { success: false, message: '유저를 찾을 수 없습니다.' };
    }
    if (!user.fcm_token) {
      return { success: false, message: '해당 유저에 FCM 토큰이 없습니다.' };
    }
    const result = await this.fcmService.sendPush(user.fcm_token, title, body, {
      alert_category: 'system_error',
      alert_type: 'test',
    });
    return { success: result, fcm_token: user.fcm_token.substring(0, 20) + '...' };
  }

  // 알림 전체 읽음 처리 (일괄 UPDATE)
  async markAllNotificationsAsRead(userId: number): Promise<any> {
    const repository = this.getRepository('notifications');
    const result = await repository
      .createQueryBuilder()
      .update(Notification)
      .set({ is_read: 1 })
      .where('user_id = :userId AND is_read = 0', { userId })
      .execute();
    return { updated: result.affected || 0 };
  }

  // 데이터 삭제 (외래키 연결만 끊기)
  async remove(tableName: string, id: number): Promise<any> {
    try {
      const repository = this.getRepository(tableName);

      // 먼저 해당 레코드가 존재하는지 확인
      const existingRecord = await repository.findOne({ where: { id } });
      if (!existingRecord) {
        throw new HttpException(
          `Record not found in ${tableName} with id ${id}`,
          HttpStatus.NOT_FOUND,
        );
      }

      // devices 테이블 삭제 시 bed_id 체크
      if (tableName === 'devices') {
        if (existingRecord.bed_id !== null) {
          throw new HttpException(
            `기기(ID: ${id})를 삭제할 수 없습니다. 현재 침상(bed_id: ${existingRecord.bed_id})에 연결되어 있습니다. 먼저 기기 연결을 해제해주세요.`,
            HttpStatus.CONFLICT,
          );
        }
      }

      // 외래키 연결 끊기 처리
      if (tableName === 'hospitals') {
        // 1. 먼저 해당 병원의 users(admin, nurse) 존재 여부 체크
        const userRepository = this.getRepository('users');
        const hospitalUsers = await userRepository
          .createQueryBuilder('user')
          .where('user.hospital_id = :hospitalId', { hospitalId: id })
          .andWhere('user.role IN (:...roles)', { roles: ['admin', 'nurse'] })
          .getMany();

        if (hospitalUsers.length > 0) {
          throw new HttpException(
            `해당 병원의 병원 관리자 및 간호사 계정을 먼저 삭제하고 다시 시도해주세요.`,
            HttpStatus.CONFLICT
          );
        }

        // 2. 투여 중인 데이터 체크
        const wardRepository = this.getRepository('wards');
        const roomRepository = this.getRepository('rooms');
        const bedRepository = this.getRepository('beds');
        const assignmentRepository = this.getRepository('patient_bed_assignments');

        // 해당 병원의 모든 병동 조회
        const wards = await wardRepository.find({ where: { hospital_id: id } });
        const wardIds = wards.map(ward => ward.id);

        if (wardIds.length > 0) {
          // 해당 병동들의 모든 병실 조회
          const rooms = await roomRepository
            .createQueryBuilder('room')
            .where('room.ward_id IN (:...wardIds)', { wardIds })
            .getMany();
          const roomIds = rooms.map(room => room.id);

          if (roomIds.length > 0) {
            // 해당 병실들의 모든 병상 조회
            const beds = await bedRepository
              .createQueryBuilder('bed')
              .where('bed.room_id IN (:...roomIds)', { roomIds })
              .getMany();
            const bedIds = beds.map(bed => bed.id);

            if (bedIds.length > 0) {
              // 투여 중인 assignment 체크
              const activeAssignments = await assignmentRepository
                .createQueryBuilder('assignment')
                .where('assignment.bed_id IN (:...bedIds)', { bedIds })
                .andWhere('assignment.released_at IS NULL')
                .getMany();

              if (activeAssignments.length > 0) {
                throw new HttpException(
                  `해당 병원에 투여 중인 병상이 있습니다. 투여 완료 처리 후 다시 시도해주세요.`,
                  HttpStatus.CONFLICT
                );
              }
            }
          }
        }

        // wards 테이블에서 hospital_id를 null로 설정
        await wardRepository.update({ hospital_id: id }, { hospital_id: null });

        // devices 테이블에서 hospital_id를 null로 설정
        const deviceRepository = this.getRepository('devices');
        await deviceRepository.update({ hospital_id: id }, { hospital_id: null });

      } else if (tableName === 'wards') {
        // 1. 먼저 해당 병동의 users(nurse) 존재 여부 체크
        const userRepository = this.getRepository('users');
        const wardNurses = await userRepository
          .createQueryBuilder('user')
          .where('user.ward_id = :wardId', { wardId: id })
          .andWhere('user.role = :role', { role: 'nurse' })
          .getMany();

        if (wardNurses.length > 0) {
          throw new HttpException(
            `해당 병동 간호사 계정을 먼저 삭제하고 다시 시도해주세요.`,
            HttpStatus.CONFLICT
          );
        }

        // 2. 투여 중인 데이터 체크
        const roomRepository = this.getRepository('rooms');
        const bedRepository = this.getRepository('beds');
        const assignmentRepository = this.getRepository('patient_bed_assignments');

        // 해당 병동의 모든 병실 조회
        const rooms = await roomRepository.find({ where: { ward_id: id } });
        const roomIds = rooms.map(room => room.id);

        if (roomIds.length > 0) {
          // 해당 병실들의 모든 병상 조회
          const beds = await bedRepository
            .createQueryBuilder('bed')
            .where('bed.room_id IN (:...roomIds)', { roomIds })
            .getMany();
          const bedIds = beds.map(bed => bed.id);

          if (bedIds.length > 0) {
            // 투여 중인 assignment 체크
            const activeAssignments = await assignmentRepository
              .createQueryBuilder('assignment')
              .where('assignment.bed_id IN (:...bedIds)', { bedIds })
              .andWhere('assignment.released_at IS NULL')
              .getMany();

            if (activeAssignments.length > 0) {
              throw new HttpException(
                `해당 병동에 투여 중인 병상이 있습니다. 투여 완료 처리 후 다시 삭제해주세요.`,
                HttpStatus.CONFLICT
              );
            }
          }
        }

        // rooms 테이블에서 ward_id를 null로 설정
        await roomRepository.update({ ward_id: id }, { ward_id: null });

        // devices 테이블에서 ward_id를 null로 설정
        const deviceRepository = this.getRepository('devices');
        await deviceRepository.update({ ward_id: id }, { ward_id: null });

      } else if (tableName === 'rooms') {
        // 투여 중인 데이터 체크
        const bedRepository = this.getRepository('beds');
        const assignmentRepository = this.getRepository('patient_bed_assignments');

        // 해당 병실의 모든 병상 조회
        const beds = await bedRepository.find({ where: { room_id: id } });
        const bedIds = beds.map(bed => bed.id);

        if (bedIds.length > 0) {
          // 투여 중인 assignment 체크
          const activeAssignments = await assignmentRepository
            .createQueryBuilder('assignment')
            .where('assignment.bed_id IN (:...bedIds)', { bedIds })
            .andWhere('assignment.released_at IS NULL')
            .getMany();

          if (activeAssignments.length > 0) {
            throw new HttpException(
              `해당 병실에 투여 중인 병상이 있습니다. 투여 완료 처리 후 다시 삭제해주세요.`,
              HttpStatus.CONFLICT
            );
          }
        }

        // beds 테이블에서 room_id를 null로 설정
        await bedRepository.update({ room_id: id }, { room_id: null });

        // devices 테이블에서 room_id를 null로 설정
        const deviceRepository = this.getRepository('devices');
        await deviceRepository.update({ room_id: id }, { room_id: null });

      } else if (tableName === 'beds') {
        // 현재 사용 중인 병상인지 체크 (released_at이 null인 경우)
        const assignmentRepository = this.getRepository('patient_bed_assignments');
        const activeAssignments = await assignmentRepository.find({
          where: { bed_id: id, released_at: IsNull() }
        });

        if (activeAssignments.length > 0) {
          throw new HttpException(
            `사용 중인 병상입니다. 투여 완료 처리 후 다시 삭제해주세요.`,
            HttpStatus.CONFLICT
          );
        }

        // patient_bed_assignments 테이블에서 bed_id를 null로 설정
        await assignmentRepository.update({ bed_id: id }, { bed_id: null });

        // devices 테이블에서 bed_id를 null로 설정
        const deviceRepository = this.getRepository('devices');
        await deviceRepository.update({ bed_id: id }, { bed_id: null });

      } else if (tableName === 'patients') {
        // patient_bed_assignments 테이블에서 patient_id를 null로 설정
        const assignmentRepository = this.getRepository('patient_bed_assignments');
        await assignmentRepository.update({ patient_id: id }, { patient_id: null });

      } else if (tableName === 'devices') {
        // patient_bed_assignments 테이블에서 device_id를 null로 설정
        const assignmentRepository = this.getRepository('patient_bed_assignments');
        await assignmentRepository.update({ device_id: id }, { device_id: null });

        // notifications 테이블에서 device_id를 null로 설정
        const notificationRepository = this.getRepository('notifications');
        await notificationRepository.update({ device_id: id }, { device_id: null });

      } else if (tableName === 'patient_bed_assignments') {
        // notifications 테이블에서 patient_bed_assignment_id를 null로 설정
        const notificationRepository = this.getRepository('notifications');
        await notificationRepository.update({ patient_bed_assignment_id: id }, { patient_bed_assignment_id: null });

      } else if (tableName === 'users') {
        // admin 삭제 시 동일한 hospital_id의 nurse 존재 여부 확인
        const userRepository = this.getRepository('users');
        const userToDelete = await userRepository.findOne({ where: { id } });

        if (userToDelete && userToDelete.role === 'admin' && userToDelete.hospital_id) {
          const nurseCount = await userRepository.count({
            where: {
              hospital_id: userToDelete.hospital_id,
              role: 'nurse'
            }
          });

          if (nurseCount > 0) {
            throw new HttpException(
              `해당 병원에 소속된 간호사가 ${nurseCount}명 존재합니다. 관리자를 삭제하려면 먼저 모든 간호사를 삭제해주세요.`,
              HttpStatus.BAD_REQUEST
            );
          }
        }

        // notifications 테이블에서 user_id를 null로 설정 (알림은 보존)
        const notificationRepository = this.getRepository('notifications');
        await notificationRepository.update({ user_id: id }, { user_id: null });

        // user_lockout_log 테이블에서 user_id를 null로 설정 (로그는 보존)
        const lockoutLogRepository = this.getRepository('user_lockout_log');
        await lockoutLogRepository.update({ user_id: id }, { user_id: null });

        // 사용자 전용 데이터는 삭제
        // user_settings 삭제
        const userSettingRepository = this.getRepository('user_settings');
        await userSettingRepository.delete({ user_id: id });

        // access_tokens 삭제
        const accessTokenRepository = this.getRepository('access_tokens');
        await accessTokenRepository.delete({ user_id: id });

        // user_lockout_status 삭제
        const lockoutStatusRepository = this.getRepository('user_lockout_status');
        await lockoutStatusRepository.delete({ user_id: id });

        this.logger.log(`[USER DELETE] Deleted user-specific data and unlinked foreign keys for user ${id}`);
      }

      // patient_bed_assignments 삭제 시 MQTT 알림 발송을 위한 hospital_id 미리 조회
      let assignmentHospitalId: number | null = null;
      if (tableName === 'patient_bed_assignments' && existingRecord.bed_id) {
        try {
          const bedRepository = this.getRepository('beds');
          const bed = await bedRepository.findOne({
            where: { id: existingRecord.bed_id },
            relations: ['room', 'room.ward']
          });
          assignmentHospitalId = bed?.room?.ward?.hospital_id || null;
        } catch (e) {
          this.logger.error(`[ASSIGNMENT DELETE] Failed to lookup hospital_id: ${e.message}`);
        }
      }

      // 삭제 실행
      await repository.delete(id);

      // patient_bed_assignments 삭제 후 MQTT 알림 발송
      if (tableName === 'patient_bed_assignments' && assignmentHospitalId) {
        try {
          await this.sendAssignmentRefreshNotification(assignmentHospitalId, {
            assignment_id: id,
            bed_id: existingRecord.bed_id,
            action: 'delete'
          });
        } catch (mqttError) {
          this.logger.error(`[ASSIGNMENT DELETE] MQTT notification failed: ${mqttError.message}`);
        }
      }

      return { message: `Record with id ${id} deleted successfully from ${tableName}. Related foreign keys have been set to null.` };
    } catch (error) {
      this.logger.error(`Error in remove for ${tableName}:`, error);
      throw error;
    }
  }

  // 데이터 삽입
  async insertData(tableName: string, data: any): Promise<any> {
    try {
      const repository = this.getRepository(tableName);
      
      // 테이블별 전처리 작업
      switch (tableName) {
        case 'users':
          // users 테이블의 경우 auth_id 중복 체크
          if (data.auth_id) {
            const existingUser = await repository.findOne({
              where: { auth_id: data.auth_id }
            });

            if (existingUser) {
              throw new HttpException(
                `이미 사용 중인 ID입니다: ${data.auth_id}`,
                HttpStatus.CONFLICT
              );
            }
          }

          // admin 중복 체크: 같은 병원에 admin은 1명만 가능
          if (data.role === 'admin' && data.hospital_id) {
            const existingAdmin = await repository.findOne({
              where: {
                hospital_id: data.hospital_id,
                role: 'admin'
              }
            });

            if (existingAdmin) {
              throw new HttpException(
                `해당 병원에는 이미 관리자가 존재합니다`,
                HttpStatus.CONFLICT
              );
            }
          }

          // 비밀번호 암호화
          if (data.password) {
            const bcrypt = require('bcrypt');
            data.password = await bcrypt.hash(data.password, 10);
          }
          break;

        case 'hospitals':
          // hospitals 테이블의 경우 중복 체크 (띄어쓰기 무시)
          if (data.name) {
            // 띄어쓰기 제거한 이름
            const normalizedName = data.name.replace(/\s+/g, '');

            // 모든 병원 조회
            const allHospitals = await repository.find();

            // 띄어쓰기 제거한 이름으로 중복 체크
            const duplicate = allHospitals.find(hospital =>
              hospital.name.replace(/\s+/g, '') === normalizedName
            );

            if (duplicate) {
              throw new HttpException(
                `동일한 이름의 병원이 이미 존재합니다: ${duplicate.name}`,
                HttpStatus.CONFLICT
              );
            }
          }
          break;

        case 'devices':
          // devices 테이블의 경우 serial_number 중복 체크
          if (data.serial_number) {
            const existingDevice = await repository.findOne({
              where: { serial_number: data.serial_number }
            });

            if (existingDevice) {
              throw new HttpException(
                `동일한 시리얼 번호의 장치가 이미 존재합니다: ${data.serial_number}`,
                HttpStatus.CONFLICT
              );
            }
          }
          break;

        case 'patient_bed_assignments':
          // 같은 patient_id+bed_id로 활성 assignment가 이미 있고, device_id가 없는 경우
          // → 기존 assignment에 device_id를 업데이트하고 새 INSERT 스킵
          if (data.patient_id && data.bed_id && data.device_id) {
            const existingAssignment = await repository.findOne({
              where: {
                patient_id: data.patient_id,
                bed_id: data.bed_id,
                released_at: IsNull(),
                device_id: IsNull(),
              },
              order: { id: 'DESC' },
            });

            if (existingAssignment) {
              // 기존 assignment에 device_id 및 수액 정보 병합
              const mergeData: any = { device_id: data.device_id };
              if (data.infusion_type) mergeData.infusion_type = data.infusion_type;
              if (data.infusion_code) mergeData.infusion_code = data.infusion_code;
              if (data.infusion_total_volume) mergeData.infusion_total_volume = data.infusion_total_volume;
              // cchr 값을 직접 infusion_cchr에 저장
              if (data.infusion_cchr !== undefined) {
                mergeData.infusion_cchr = data.infusion_cchr;
              } else if (data.infusion_gtt !== undefined) {
                mergeData.infusion_cchr = Math.round(data.infusion_gtt * 3.282 * 100) / 100;
              }

              await repository.update(existingAssignment.id, mergeData);
              this.logger.log(`[ASSIGNMENT MERGE] Updated existing assignment ${existingAssignment.id} with device_id=${data.device_id} instead of creating new one`);

              // 후처리를 위해 업데이트된 레코드를 saved로 사용
              const merged = await repository.findOne({ where: { id: existingAssignment.id } });

              // device 위치 정보 업데이트
              if (merged.device_id) {
                const deviceRepository = this.getRepository('devices');
                const bedRepository = this.getRepository('beds');
                const bed = await bedRepository.findOne({
                  where: { id: merged.bed_id },
                  relations: ['room', 'room.ward']
                });
                if (bed?.room?.ward) {
                  await deviceRepository.update(merged.device_id, {
                    bed_id: merged.bed_id,
                    room_id: bed.room.id,
                    ward_id: bed.room.ward.id,
                    hospital_id: bed.room.ward.hospital_id,
                    last_udpate_at: new Date(),
                  });
                  this.logger.log(`[ASSIGNMENT MERGE] Updated device ${merged.device_id} location`);
                }
              }

              return merged;
            }
          }
          break;

        case 'infusion_raw_logs':
          // api 필드 기본값 설정 (MQTT에서 api 필드가 없는 경우)
          if (!data.api) {
            data.api = data.device_type === 'LOAD_CELL' ? 'v2' : 'v1';
            this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] api not provided, using default: ${data.api}`);
          }

          // LOAD_CELL 타입인 경우 cchr 계산 전처리
          this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] Entered case - device_type: ${data.device_type}, sn: ${data.sn}, time: ${data.time}, weight: ${data.weight}`);
          if (data.device_type === 'LOAD_CELL' && data.sn && data.time !== undefined && data.weight !== undefined) {
            // 2분 이내의 동일 serial_number 데이터 조회 (created_at 기준)
            const twoMinutesAgo = new Date(Date.now() - 120000); // 2분 전

            const recentLog = await repository
              .createQueryBuilder('log')
              .where('log.sn = :sn', { sn: data.sn })
              .andWhere('log.created_at >= :twoMinutesAgo', { twoMinutesAgo })
              .orderBy('log.created_at', 'DESC')
              .getOne();

            if (recentLog && recentLog.time !== undefined && recentLog.weight !== undefined) {
              // 시간 차이 계산 (밀리초)
              const timeDiff = data.time - recentLog.time;

              // 무게 변화량 계산 (g → ml, 1g = 1ml 가정)
              const weightDiff = recentLog.weight - data.weight;

              // timeDiff가 5초(5,000 밀리초) 미만이면 계산하지 않음
              if (timeDiff < 5000) {
                this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] LOAD_CELL SN ${data.sn}: Time interval too short (${timeDiff}ms < 5s), cchr not calculated`);
              } else if (timeDiff > 0 && weightDiff >= 0) {
                // 유량 계산 (ml/hr) = cchr
                // ml/hr = (weightDiff * 3,600,000 ms/hr) / timeDiff_ms
                const flowRate = (weightDiff * 3600000) / timeDiff;

                // flowRate(ml/hr) = cchr (변환 불필요)
                // cchr 값이 합리적인 범위(0-9999)인 경우만 저장 (소수점 2자리로 반올림)
                if (flowRate >= 0 && flowRate <= 9999) {
                  data.cchr = Math.round(flowRate * 100) / 100; // 소수점 2자리로 반올림
                  this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] Calculated cchr for LOAD_CELL SN ${data.sn}: ${data.cchr} cc/hr (weightDiff: ${weightDiff}g, timeDiff: ${timeDiff}ms, flowRate: ${flowRate.toFixed(2)} ml/hr)`);
                } else {
                  this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] LOAD_CELL SN ${data.sn}: Calculated cchr out of range (${flowRate.toFixed(2)} cc/hr), cchr not saved`);
                }
              } else {
                this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] LOAD_CELL SN ${data.sn}: Invalid diff values (timeDiff: ${timeDiff}, weightDiff: ${weightDiff}), cchr not calculated`);
              }
            } else {
              this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] LOAD_CELL SN ${data.sn}: No recent log found within 2 minutes, cchr not calculated`);
            }
          }
          break;
      }
      
      const entity = repository.create(data);
      const saved = await repository.save(entity);
      
      // 테이블별 후처리 작업
      switch (tableName) {
        case 'infusion_raw_logs':
          // infusion_raw_logs 데이터 삽입 시 후처리
          await this.processInfusionRawLog(saved);
          break;

        case 'notifications':
          // notifications 데이터 삽입 시 MQTT 발송
          const topic = `user/${saved.user_id}/notification`;

          // patient_bed_assignment_id로 bed_id 조회
          let bedId = null;
          if (saved.patient_bed_assignment_id) {
            const assignmentRepository = this.getRepository('patient_bed_assignments');
            const assignment = await assignmentRepository.findOne({
              where: { id: saved.patient_bed_assignment_id }
            });
            if (assignment) {
              bedId = assignment.bed_id;
            }
          }

          const payload = {
            notification_id: saved.id,
            user_id: saved.user_id,
            patient_bed_assignment_id: saved.patient_bed_assignment_id,
            bed_id: bedId,
            device_id: saved.device_id,
            title: saved.title,
            message: saved.message,
            type: saved.type,
            is_read: saved.is_read,
            created_at: saved.created_at,
          };

          this.mqttService.publishMessage(topic, payload);
          this.logger.log(`[NOTIFICATION] Sent MQTT notification to user ${saved.user_id}, topic: ${topic}, bed_id: ${bedId}`);
          break;

        case 'users':
          // users 테이블에 데이터가 삽입되면 자동으로 user_settings 생성 (개인 설정만)
          const userSettingRepository = this.getRepository('user_settings');

          const userSetting = userSettingRepository.create({
            user_id: saved.id,
            alert_color: '#009EE6',
            alert_display_time: 5,
            critical_sound_volume: 100,
            caution_sound_volume: 100,
            system_error_sound_volume: 100,
          });
          await userSettingRepository.save(userSetting);
          this.logger.log(`[USER_SETTINGS CREATE] Created user settings for user ${saved.id}`);
          break;

        case 'wards':
          // wards 테이블에 데이터가 삽입되면 자동으로 ward_settings 생성
          const wardSettingRepository = this.getRepository('ward_settings');
          const wardSetting = wardSettingRepository.create({
            ward_id: saved.id,
          });
          await wardSettingRepository.save(wardSetting);
          this.logger.log(`[WARD_SETTINGS CREATE] Created ward settings for ward ${saved.id}`);
          break;

        case 'rooms':
          // rooms 테이블에 데이터가 삽입되면 bed_count 만큼 beds 자동 생성
          if (saved.bed_count && saved.bed_count > 0) {
            const bedRepository = this.getRepository('beds');
            const bedsToCreate = [];

            for (let i = 1; i <= saved.bed_count; i++) {
              bedsToCreate.push({
                room_id: saved.id,
                bed_number: String(i),
                status: 'available',
              });
            }

            await bedRepository.save(bedsToCreate);
            this.logger.log(`Created ${saved.bed_count} beds for room ${saved.id}`);
          }
          break;

        case 'patient_bed_assignments':
          // patient_bed_assignments 데이터 삽입 시 후처리
          // 1. device_id가 있으면 device의 bed_id, hospital_id, ward_id, room_id 업데이트
          if (saved.device_id) {
            const deviceRepository = this.getRepository('devices');
            const bedRepository = this.getRepository('beds');

            // bed_id로 역추적하여 hospital_id, ward_id, room_id 조회
            const bed = await bedRepository.findOne({
              where: { id: saved.bed_id },
              relations: ['room', 'room.ward']
            });

            if (bed?.room?.ward) {
              await deviceRepository.update(saved.device_id, {
                bed_id: saved.bed_id,
                room_id: bed.room.id,
                ward_id: bed.room.ward.id,
                hospital_id: bed.room.ward.hospital_id,
                last_udpate_at: new Date(),
              });
              this.logger.log(`[ASSIGNMENT] Updated device ${saved.device_id} - bed_id: ${saved.bed_id}, room_id: ${bed.room.id}, ward_id: ${bed.room.ward.id}, hospital_id: ${bed.room.ward.hospital_id}`);
            } else {
              // bed 정보가 없으면 bed_id만 업데이트
              await deviceRepository.update(saved.device_id, {
                bed_id: saved.bed_id,
                last_udpate_at: new Date(),
              });
              this.logger.log(`[ASSIGNMENT] Updated device ${saved.device_id} - bed_id: ${saved.bed_id} (no bed hierarchy found)`);
            }
          }
          // 2. bed_id의 status를 occupied로 변경
          if (saved.bed_id) {
            const bedRepository = this.getRepository('beds');
            await bedRepository.update(saved.bed_id, { status: 'occupied' });
            this.logger.log(`[ASSIGNMENT] Updated bed ${saved.bed_id} status to occupied`);
          }
          // 3. MQTT 알림 발송
          if (saved.bed_id) {
            try {
              const bedRepoMqtt = this.getRepository('beds');
              const bedForMqtt = await bedRepoMqtt.findOne({
                where: { id: saved.bed_id },
                relations: ['room', 'room.ward']
              });
              if (bedForMqtt?.room?.ward?.hospital_id) {
                await this.sendAssignmentRefreshNotification(bedForMqtt.room.ward.hospital_id, {
                  assignment_id: saved.id,
                  bed_id: saved.bed_id,
                  patient_id: saved.patient_id,
                  action: 'create'
                });
              }
            } catch (mqttError) {
              this.logger.error(`[ASSIGNMENT INSERT] MQTT notification failed: ${mqttError.message}`);
            }
          }
          break;

        default:
          // 다른 테이블의 경우 추가 처리 없음
          break;
      }

      // save 후 다시 조회하여 모든 필드(created_at, updated_at 포함) 반환
      const result = await repository.findOne({ where: { id: saved.id } });

      // infusion_raw_logs 테이블인 경우 r_volume_max 추가
      if (tableName === 'infusion_raw_logs' && result) {
        try {
          // 1. sn으로 device 찾기
          const deviceRepository = this.getRepository('devices');
          const device = await deviceRepository.findOne({
            where: { serial_number: result.sn }
          });

          if (device && device.bed_id) {
            // 2. device_id와 bed_id로 active assignment 찾기
            const assignmentRepository = this.getRepository('patient_bed_assignments');
            const assignment = await assignmentRepository.findOne({
              where: {
                device_id: device.id,
                bed_id: device.bed_id,
                released_at: IsNull(),
              }
            });

            if (assignment) {
              // 3. infusion_total_volume을 r_volume_max로 추가 0612
              return {
                ...result,
                r_volume_max: assignment.infusion_total_volume,
                ordered_gtt : assignment.infusion_cchr
              };
            }
          }
        } catch (error) {
          this.logger.warn(`[INSERT DATA] Failed to get r_volume_max: ${error.message}`);
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Error in insertData for ${tableName}:`, error);
      throw new HttpException(
        error.message || 'Error inserting data',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 모든 병원의 계층 구조 조회 (hospitals -> wards -> rooms -> beds)
  async getAllHospitalsHierarchy(): Promise<any> {
    try {
      // 1. 모든 병원 조회
      const hospitalRepository = this.getRepository('hospitals');
      const hospitals = await hospitalRepository.find();

      if (hospitals.length === 0) {
        return [];
      }

      // 2. 모든 병동 조회
      const wardRepository = this.getRepository('wards');
      const allWards = await wardRepository.find();

      // 3. 모든 병실 조회
      const roomRepository = this.getRepository('rooms');
      const allRooms = await roomRepository.find();

      // 4. 모든 침대 조회
      const bedRepository = this.getRepository('beds');
      const allBeds = await bedRepository.find();

      // 5. 계층 구조로 조합
      const result = hospitals.map(hospital => {
        // 해당 병원의 병동들
        const wards = allWards.filter(w => w.hospital_id === hospital.id);

        const wardsWithRooms = wards.map(ward => {
          // 해당 병동의 병실들
          const rooms = allRooms.filter(r => r.ward_id === ward.id);

          const roomsWithBeds = rooms.map(room => {
            // 해당 병실의 침대들
            const beds = allBeds.filter(b => b.room_id === room.id);

            return {
              ...room,
              beds
            };
          });

          return {
            ...ward,
            rooms: roomsWithBeds
          };
        });

        return {
          ...hospital,
          wards: wardsWithRooms
        };
      });

      return result;
    } catch (error) {
      this.logger.error('Error in getAllHospitalsHierarchy:', error);
      throw error;
    }
  }

  /**
   * infusion_raw_logs 삽입 후 후처리
   * device 조회 → patient_bed_assignments 조회 → 업데이트 로직
   */
  private async processInfusionRawLog(rawLog: InfusionRawLog) {
    try {
      this.logger.log(`[PROCESS START] device_type: ${rawLog.device_type}, api: ${rawLog.api}, SN: ${rawLog.sn}`);

      // 분기 처리: v4 API는 스킵 (IR과 LOAD_CELL 모두 동일하게 처리)
      if (rawLog.api === 'v4') {
        this.logger.log(`[SKIP] Skipping processing - api: ${rawLog.api}`);
        return;
      }

      // 1. serial_number로 device 찾기
      this.logger.log(`[STEP 1] Searching device with SN: ${rawLog.sn}`);
      const deviceRepository = this.getRepository('devices');
      const device = await deviceRepository.findOne({
        where: { serial_number: rawLog.sn }
      });

      if (!device) {
        this.logger.warn(`[STEP 1] Device NOT found for serial_number: ${rawLog.sn}`);
        return;
      }

      // this.logger.log(`[STEP 1] Device FOUND!`);
      // this.logger.log(`[STEP 1] - Device ID: ${device.id}`);
      // this.logger.log(`[STEP 1] - Device Name: ${device.device_name}`);
      // this.logger.log(`[STEP 1] - Serial Number: ${device.serial_number}`);
      // this.logger.log(`[STEP 1] - Bed ID: ${device.bed_id}`);

      // 2. device_id와 bed_id로 patient_bed_assignments 조회
      this.logger.log(`[STEP 2] Searching patient_bed_assignments with device_id: ${device.id}, bed_id: ${device.bed_id}`);
      const assignmentRepository = this.getRepository('patient_bed_assignments');
      const assignment = await assignmentRepository.findOne({
        where: {
          device_id: device.id,
          bed_id: device.bed_id,
          released_at: IsNull(), // 아직 해제되지 않은 배정만 조회
        },
        relations: ['patient', 'bed', 'device'],
      });

      if (!assignment) {
        this.logger.warn(`[STEP 2] No active patient bed assignment found for device_id: ${device.id}, bed_id: ${device.bed_id}`);
        return;
      }

      // this.logger.log(`[STEP 2] Assignment found!`);
      // this.logger.log(`[STEP 2] - Assignment ID: ${assignment.id}`);
      // this.logger.log(`[STEP 2] - Patient ID: ${assignment.patient_id}`);
      // this.logger.log(`[STEP 2] - Bed ID: ${assignment.bed_id}`);
      // this.logger.log(`[STEP 2] - Device ID: ${assignment.device_id}`);
      // this.logger.log(`[STEP 2] - Released At: ${assignment.released_at}`);
      // this.logger.log(`[STEP 2] - Infusion Type: ${assignment.infusion_type}`);
      // this.logger.log(`[STEP 2] - Total Volume: ${assignment.infusion_total_volume} ml`);
      // this.logger.log(`[STEP 2] - Current Volume: ${assignment.infusion_current_volume} ml`);
      // this.logger.log(`[STEP 2] - Assigned At: ${assignment.assigned_at}`);
      // this.logger.log(`[STEP 3] Received data from raw log:`);
      // this.logger.log(`[STEP 3] - Weight: ${rawLog.weight} g`);
      // this.logger.log(`[STEP 3] - Injected Amount: ${rawLog.injected_amount} ml`);
      // this.logger.log(`[STEP 3] - GTT: ${rawLog.gtt}`);
      // this.logger.log(`[STEP 3] - Rest Minute: ${rawLog.rest_minute} min`);
      // this.logger.log(`[STEP 3] - Battery: ${rawLog.battery}%`);

      // STEP 4: devices 테이블 battery_percent, network_status, last_udpate_at 업데이트 (공통 처리)
      this.logger.log(`[STEP 4] Updating device battery and network status...`);
      await deviceRepository.update(device.id, {
        battery_percent: rawLog.battery,
        network_status: 'online',
        last_udpate_at: new Date(),
      });
      // this.logger.log(`[STEP 4] Updated device ID: ${device.id}`);
      // this.logger.log(`[STEP 4] - battery_percent: ${rawLog.battery}%`);
      // this.logger.log(`[STEP 4] - last_udpate_at: ${new Date()}`);

      // STEP 4.5: alert_type이 'disconnected'인 경우 null로 변경 (연결 복구)
      if (assignment.alert_type === 'disconnected') {
        this.logger.log(`[STEP 4.5] Assignment ${assignment.id} was disconnected, restoring connection...`);
        await assignmentRepository.update(assignment.id, {
          alert_type: null
        });
        this.logger.log(`[STEP 4.5] Assignment ${assignment.id} alert_type set to null (reconnected)`);

        // MQTT 발송: 연결 복구 알림
        const topic = `bed/${assignment.bed_id}/assignment/update`;
        const payload = {
          bed_id: assignment.bed_id,
          assignment_id: assignment.id,
          patient_id: assignment.patient_id,
          alert_type: null,
          updated_at: new Date().toISOString()
        };
        this.mqttService.publishMessage(topic, payload);
        this.logger.log(`[STEP 4.5] Published MQTT to ${topic}, alert_type: null (reconnected)`);
      }

      // device_type에 따른 후처리 로직
      if (rawLog.device_type === 'IR') {
        // IR 타입 후처리
        this.logger.log(`[POST-PROCESS] Processing IR device data...`);
        await this.processIRDeviceData(rawLog, assignment, device);
      } else if (rawLog.device_type === 'LOAD_CELL') {
        // LOAD_CELL 타입 후처리
        this.logger.log(`[POST-PROCESS] Processing LOAD_CELL device data...`);
        await this.processLoadCellDeviceData(rawLog, assignment, device);
      }

    } catch (error) {
      this.logger.error(`[ERROR] Failed to process infusion raw log: ${error.message}`);
      this.logger.error(error.stack);
    }
  }

  /**
   * IR 타입 디바이스 데이터 후처리
   * - 수액량 계산 및 업데이트
   * - 알림 생성 로직
   */
  private async processIRDeviceData(rawLog: InfusionRawLog, assignment: PatientBedAssignment, device: Device) {
    try {
      this.logger.log(`[IR POST-PROCESS] Starting IR device post-processing...`);

      const assignmentRepository = this.getRepository('patient_bed_assignments');

      // ========================================
      // 1. bed_id로 hospital_id 추적
      // ========================================
      const bedRepository = this.getRepository('beds');
      const bed = await bedRepository.findOne({
        where: { id: assignment.bed_id },
        relations: ['room', 'room.ward', 'room.ward.hospital']
      });

      if (!bed || !bed.room || !bed.room.ward) {
        this.logger.warn(`[IR POST-PROCESS] Bed hierarchy not found for bed_id: ${assignment.bed_id}`);
        return;
      }

      const hospitalId = bed.room.ward.hospital_id;
      const room = bed.room;

      // ========================================
      // 2. 해당 병동의 ward_settings 조회
      // ========================================
      const wardId = bed.room.ward.id;
      const wardSettingRepository = this.getRepository('ward_settings');
      const wardSettings = await wardSettingRepository.findOne({
        where: { ward_id: wardId }
      });

      if (!wardSettings) {
        this.logger.warn(`[IR POST-PROCESS] No ward_settings found for ward ${wardId}`);
        return;
      }

      // ========================================
      // 3. 누적 투여량 계산
      // ========================================
      // injected_amount는 디바이스에서 보내는 총 누적량이므로 그대로 사용
      const newCurrentVolume = rawLog.injected_amount || 0;

      // ========================================
      // 4. infusion_percentage 계산 (누적된 투여량 기준)
      // ========================================
      const infusion_percentage = assignment.infusion_total_volume > 0
        ? (newCurrentVolume / assignment.infusion_total_volume) * 100
        : 0;

      // ========================================
      // 5. alert_type 계산 (stop, fast, slow, almost_done)
      // ========================================
      let alertType = null;

      // assigned_at 시간 체크: 5분 미만이면 알림 생성하지 않음
      const assignedAt = new Date(assignment.assigned_at);
      const now = new Date();
      const timeDiffMinutes = (now.getTime() - assignedAt.getTime()) / (1000 * 60);

      let shouldCheckAlerts = true;
      if (timeDiffMinutes < 2) {
        this.logger.log(`[IR POST-PROCESS] Skipping alert check - less than 2 minutes since assigned_at (${timeDiffMinutes.toFixed(1)}/2.0 minutes)`);
        shouldCheckAlerts = false;
      }

      // infusion_cchr가 0이면 알림 생성하지 않음 (아직 보정되지 않음)
      if (!assignment.infusion_cchr || assignment.infusion_cchr === 0) {
        this.logger.log(`[IR POST-PROCESS] Skipping alert check - infusion_cchr is 0 or null`);
        shouldCheckAlerts = false;
      }

      if (shouldCheckAlerts) {
        // done 체크 (100% 이상 → 완료)
        if (infusion_percentage >= 100) {
          alertType = 'done';
        }
        // almost_done 체크 (threshold 이상 ~ 100% 미만 → 완료 임박)
        else if (infusion_percentage >= wardSettings.complete_threshold) {
          alertType = 'almost_done';
        }
        // stop 체크: cchr=0이면 즉시 stop
        else if (rawLog.cchr === 0) {
          this.logger.log(`[IR POST-PROCESS] cchr=0 detected for assignment ${assignment.id}, setting alert_type to stop`);
          alertType = 'stop';
        }
        // cchr > 0인 경우: fast/slow 체크
        else {
          // fast/slow 체크 (assignment.infusion_cchr 사용)
          const fastThreshold = assignment.infusion_cchr * (1 + wardSettings.fast_threshold / 100);
          const slowThreshold = assignment.infusion_cchr * (1 - Math.abs(wardSettings.slow_threshold) / 100);

          if (rawLog.cchr > fastThreshold) {
            alertType = 'fast';
          } else if (rawLog.cchr < slowThreshold && rawLog.cchr > 0) {
            alertType = 'slow';
          }
        }
      }

      // ========================================
      // 6. patient_bed_assignments 업데이트 (alert_type 포함)
      // ========================================

      const alertCategory = this.deriveAlertCategory(alertType);
      const updateData = {
        infusion_current_volume: newCurrentVolume,
        alert_type: alertType,
        alert_category: alertCategory,
      };

      this.logger.log(`[IR POST-PROCESS] Updating assignment ${assignment.id} - alert_type: ${alertType}, infusion_current_volume: ${newCurrentVolume}, infusion_percentage: ${infusion_percentage.toFixed(2)}%`);
      await assignmentRepository.update(assignment.id, updateData);
      this.logger.log(`[IR POST-PROCESS] Assignment updated successfully`);

      // 업데이트된 assignment 데이터 조회
      const updatedAssignment = await assignmentRepository.findOne({
        where: { id: assignment.id }
      });

      if (updatedAssignment) {
        // 계산된 값들
        const infusion_remaining_volume = (updatedAssignment.infusion_total_volume || 0) - (updatedAssignment.infusion_current_volume || 0);

        // ========================================
        // 6. MQTT 메시지 발행 (alert_type 포함)
        // ========================================
        const topic = `bed/${updatedAssignment.bed_id}/assignment/update`;
        const payload = {
          bed_id: updatedAssignment.bed_id,
          assignment_id: updatedAssignment.id,
          patient_id: updatedAssignment.patient_id,
          infusion_percentage: Math.round(infusion_percentage * 100) / 100,
          infusion_current_volume: updatedAssignment.infusion_current_volume,
          infusion_remaining_volume: infusion_remaining_volume,
          alert_type: alertType,
          updated_at: new Date().toISOString()
        };

        this.mqttService.publishMessage(topic, payload);
        this.logger.log(`[IR POST-PROCESS] Published MQTT to ${topic}, alert_type: ${alertType}`);

        // ========================================
        // 7. alert_type에 따라 notifications 생성 (alert_type이 변경된 경우에만)
        // ========================================
        const previousAlertType = assignment.alert_type || null;
        if (alertType && alertType !== previousAlertType) {
          this.logger.log(`[IR POST-PROCESS] Alert type changed: ${previousAlertType} → ${alertType}, creating notifications`);
          await this.createNotificationsByAlertType(alertType, assignment, device, bed, room, hospitalId);
        } else if (alertType && alertType === previousAlertType) {
          this.logger.log(`[IR POST-PROCESS] Alert type unchanged (${alertType}), skipping duplicate notification`);
        }
      }

    } catch (error) {
      this.logger.error(`[IR POST-PROCESS ERROR] ${error.message}`);
      this.logger.error(error.stack);
    }
  }

  /**
   * LOAD_CELL 타입 디바이스 데이터 후처리
   * - 무게 기반 수액량 계산 및 업데이트
   * - 알림 생성 로직
   */
  private async processLoadCellDeviceData(rawLog: InfusionRawLog, assignment: PatientBedAssignment, device: Device) {
    try {
      this.logger.log(`[LOAD_CELL POST-PROCESS] Starting LOAD_CELL device post-processing...`);

      const assignmentRepository = this.getRepository('patient_bed_assignments');

      // 초기 실행: 직전 측정값이 없는 경우
      if (assignment.last_measured_weight === null || assignment.last_measured_time === null) {
        this.logger.log(`[LOAD_CELL POST-PROCESS] First measurement - saving initial values`);
        await assignmentRepository.update(assignment.id, {
          last_measured_weight: rawLog.weight,
          last_measured_time: rawLog.time,
        });
        this.logger.log(`[LOAD_CELL POST-PROCESS] Initial weight: ${rawLog.weight}g, time: ${rawLog.time}`);
        return;
      }

      // 무게 변화량 계산 (Δml)
      const weightDiff = assignment.last_measured_weight - rawLog.weight;

      // 수액 교체 감지 (무게가 증가한 경우)
      if (weightDiff < 0) {
        this.logger.log(`[LOAD_CELL POST-PROCESS] IV bag replaced - weight increased`);
        await assignmentRepository.update(assignment.id, {
          last_measured_weight: rawLog.weight,
          last_measured_time: rawLog.time,
        });
        return;
      }

      // 시간 차이 계산 (마이크로초)
      const timeDiff = rawLog.time - assignment.last_measured_time;

      // 유량 계산 (ml/hr = cchr)
      // ml/hr = Δml / Δt_hr = (ml2 - ml1) / ((t2_μs - t1_μs) / 3,600,000,000)
      const flowRate = timeDiff > 0 ? (weightDiff * 3600000000) / timeDiff : 0;

      // 현재 주입량 계산 (이전 주입량 + 무게 감소량)
      const newCurrentVolume = (assignment.infusion_current_volume || 0) + weightDiff;

      // flowRate(ml/hr) = cchr (변환 불필요)

      // ========================================
      // fast/slow/stop 알림 체크
      // ========================================
      // rawLog에 cchr 값을 추가하여 checkSpeedAlerts 호출
      const rawLogWithCchr = { ...rawLog, cchr: flowRate };
      await this.checkSpeedAlerts(rawLogWithCchr, assignment, device);

      // 업데이트
      await assignmentRepository.update(assignment.id, {
        infusion_current_volume: newCurrentVolume,
        last_measured_weight: rawLog.weight,
        last_measured_time: rawLog.time,
      });

      // this.logger.log(`[LOAD_CELL POST-PROCESS] Updated assignment ID: ${assignment.id}`);
      // this.logger.log(`[LOAD_CELL POST-PROCESS] - Weight diff: ${weightDiff}g`);
      // this.logger.log(`[LOAD_CELL POST-PROCESS] - Time diff: ${timeDiff}μs`);
      // this.logger.log(`[LOAD_CELL POST-PROCESS] - Flow rate: ${flowRate.toFixed(2)} ml/hr`);
      // this.logger.log(`[LOAD_CELL POST-PROCESS] - infusion_current_volume: ${newCurrentVolume} ml`);
      // this.logger.log(`[LOAD_CELL POST-PROCESS] - assigned_at: ${new Date()}`);

      // 업데이트된 assignment 데이터 조회
      const updatedAssignment = await assignmentRepository.findOne({
        where: { id: assignment.id }
      });

      if (updatedAssignment) {
        // 계산된 값들
        const infusion_remaining_volume = (updatedAssignment.infusion_total_volume || 0) - (updatedAssignment.infusion_current_volume || 0);
        const infusion_percentage = updatedAssignment.infusion_total_volume > 0
          ? ((updatedAssignment.infusion_current_volume || 0) / updatedAssignment.infusion_total_volume) * 100
          : 0;

        // MQTT 메시지 발행
        const topic = `bed/${updatedAssignment.bed_id}/assignment/update`;
        const payload = {
          bed_id: updatedAssignment.bed_id,
          assignment_id: updatedAssignment.id,
          patient_id: updatedAssignment.patient_id,
          infusion_percentage: Math.round(infusion_percentage * 100) / 100, // 소수점 2자리
          infusion_current_volume: updatedAssignment.infusion_current_volume,
          infusion_remaining_volume: infusion_remaining_volume,
          alert_type: null, // TODO: 알림 로직 구현 시 추가
          updated_at: new Date().toISOString()
        };

        this.mqttService.publishMessage(topic, payload);
        this.logger.log(`[LOAD_CELL POST-PROCESS] Published MQTT message to topic: ${topic}`);

        // 알림 체크 및 생성
        await this.checkAndSendNotifications(updatedAssignment, device, infusion_percentage);
      }

    } catch (error) {
      this.logger.error(`[LOAD_CELL POST-PROCESS ERROR] ${error.message}`);
      this.logger.error(error.stack);
    }
  }

  /**
   * alert_type에 따라 해당 병원의 관리자, 간호사에게 notifications 생성
   *
   * @param alertType - 알림 타입 (stop, fast, slow, end)
   * @param assignment - 환자 침대 배정 정보
   * @param device - 디바이스 정보
   * @param bed - 침대 정보
   * @param room - 병실 정보
   * @param hospitalId - 병원 ID
   */
  private async createNotificationsByAlertType(
    alertType: string,
    assignment: PatientBedAssignment,
    device: Device,
    bed: any,
    room: any,
    hospitalId: number
  ) {
    try {
      this.logger.log(`[CREATE NOTIFICATIONS] Starting for alert_type: ${alertType}`);

      // ward_settings에서 enabled 확인 (병동 공통 설정)
      const wardId = room.ward_id;
      const wardSettingRepo = this.getRepository('ward_settings');
      const wardSettings = await wardSettingRepo.findOne({
        where: { ward_id: wardId }
      });

      if (!wardSettings) {
        this.logger.warn(`[CREATE NOTIFICATIONS] No ward_settings found for ward ${wardId}`);
        return;
      }

      // alert_type별 enabled 확인 (ward_settings 기준)
      // Note: mysql2 드라이버가 tinyint(1)을 boolean으로 반환할 수 있으므로 == 사용
      let isEnabled = false;
      switch (alertType) {
        case 'stop':
          isEnabled = wardSettings.stop_enabled == 1;
          break;
        case 'fast':
          isEnabled = wardSettings.fast_enabled == 1;
          break;
        case 'slow':
          isEnabled = wardSettings.slow_enabled == 1;
          break;
        case 'almost_done':
        case 'done':
          isEnabled = wardSettings.complete_enabled == 1;
          break;
      }

      if (!isEnabled) {
        this.logger.log(`[CREATE NOTIFICATIONS] ${alertType} notification disabled in ward_settings for ward ${wardId}`);
        return;
      }

      // 해당 병동의 admin, nurse 조회
      const userRepository = this.getRepository('users');
      const users = await userRepository.find({
        where: { hospital_id: hospitalId, ward_id: wardId }
      });

      const targetUsers = users.filter(user => user.role === 'admin' || user.role === 'nurse');

      if (targetUsers.length === 0) {
        this.logger.log(`[CREATE NOTIFICATIONS] No admin/nurse users found for hospital ${hospitalId}`);
        return;
      }

      // 알림 메시지 생성
      let title = '';
      let message = '';

      switch (alertType) {
        case 'stop':
          title = '수액 주입 정지';
          message = `${room.name}호-${bed.bed_number}번 병상의 수액 주입이 정지되었습니다.`;
          break;
        case 'fast':
          title = '수액 주입 속도 빠름';
          message = `${room.name}호-${bed.bed_number}번 병상의 수액 주입 속도가 빠릅니다.`;
          break;
        case 'slow':
          title = '수액 주입 속도 느림';
          message = `${room.name}호-${bed.bed_number}번 병상의 수액 주입 속도가 느립니다.`;
          break;
        case 'almost_done':
          title = '수액 투여 완료 임박';
          message = `${room.name}호-${bed.bed_number}번 병상의 수액 투여가 완료 임박입니다.`;
          break;
        case 'done':
          title = '수액 투여 완료';
          message = `${room.name}호-${bed.bed_number}번 병상의 수액 투여가 완료되었습니다.`;
          break;
      }

      // 각 사용자에게 알림 생성 (alert_type이 변경된 경우에만 호출되므로 항상 발송)
      for (const user of targetUsers) {
        // DB INSERT → insertData 내부에서 MQTT 자동 발송
        await this.insertData('notifications', {
          user_id: user.id,
          patient_bed_assignment_id: assignment.id,
          device_id: device.id,
          title: title,
          message: message,
          type: alertType,
          is_read: 0,
        });
        this.logger.log(`[CREATE NOTIFICATIONS] Created ${alertType} notification for user ${user.id}`);

        // FCM push 발송
        if (user.fcm_token) {
          const alertCategory = this.deriveAlertCategory(alertType);
          await this.fcmService.sendPush(user.fcm_token, title, message, {
            alert_category: alertCategory || '',
            alert_type: alertType,
          });
        }
      }

    } catch (error) {
      this.logger.error(`[CREATE NOTIFICATIONS ERROR] ${error.message}`);
      this.logger.error(error.stack);
    }
  }

  /**
   * 수액 속도 알림 체크 (fast/slow/stop)
   *
   * 디바이스의 cchr 데이터를 기반으로 fast/slow/stop 알림을 생성합니다.
   * ward_settings 1회 조회로 병동 공통 설정 기준 알림을 판단합니다.
   *
   * @param rawLog - 수신한 MQTT 데이터 (cchr 포함)
   * @param assignment - 환자 침대 배정 정보
   * @param device - 디바이스 정보
   */
  private async checkSpeedAlerts(
    rawLog: InfusionRawLog,
    assignment: PatientBedAssignment,
    device: Device
  ) {
    try {
      this.logger.log(`[SPEED ALERT CHECK] Starting for assignment ID: ${assignment.id}, cchr: ${rawLog.cchr}`);

      // released_at이 있으면 알림 불필요
      if (assignment.released_at) {
        this.logger.log(`[SPEED ALERT CHECK] Assignment already released, skipping`);
        return;
      }

      // cchr 값이 없으면 스킵
      if (rawLog.cchr === undefined || rawLog.cchr === null) {
        this.logger.log(`[SPEED ALERT CHECK] No cchr data, skipping`);
        return;
      }

      // assigned_at 시간 체크: 2분 미만이면 알림 생성하지 않음
      const assignedAt = new Date(assignment.assigned_at);
      const now = new Date();
      const timeDiffMinutes = (now.getTime() - assignedAt.getTime()) / (1000 * 60);

      if (timeDiffMinutes < 2) {
        this.logger.log(`[SPEED ALERT CHECK] Skipping - less than 2 minutes since assigned_at (${timeDiffMinutes.toFixed(1)}/2.0 minutes)`);
        return;
      }

      // infusion_cchr가 0이면 알림 생성하지 않음 (아직 보정되지 않음)
      if (!assignment.infusion_cchr || assignment.infusion_cchr === 0) {
        this.logger.log(`[SPEED ALERT CHECK] Skipping - infusion_cchr is 0 or null`);
        return;
      }

      // 1. bed_id로부터 계층 구조 조회
      const bedRepository = this.getRepository('beds');
      const bed = await bedRepository.findOne({
        where: { id: assignment.bed_id },
        relations: ['room', 'room.ward', 'room.ward.hospital']
      });

      if (!bed || !bed.room || !bed.room.ward) {
        this.logger.warn(`[SPEED ALERT CHECK] Bed hierarchy not found for bed_id: ${assignment.bed_id}`);
        return;
      }

      const ward = bed.room.ward;
      const room = bed.room;

      this.logger.log(`[SPEED ALERT CHECK] Hospital ID: ${ward.hospital_id}, Ward ID: ${ward.id}, Room: ${room.name}, Bed: ${bed.bed_number}`);

      // 2. ward_settings 1회 조회 (병동 공통 설정)
      const wardSettingRepository = this.getRepository('ward_settings');
      const wardSettings = await wardSettingRepository.findOne({
        where: { ward_id: ward.id }
      });

      if (!wardSettings) {
        this.logger.warn(`[SPEED ALERT CHECK] No ward_settings found for ward ${ward.id}`);
        return;
      }

      // 3. alert_type 결정 (ward_settings 기준)
      let alertType: string | null = null;
      let alertTitle = '';
      let alertMessage = '';

      // STOP 체크
      if (wardSettings.stop_enabled == 1 && rawLog.cchr === 0) {
        alertType = 'stop';
        alertTitle = '수액 주입 정지';
        alertMessage = `${room.name}호-${bed.bed_number}번 병상의 수액 주입이 정지되었습니다.`;
      }

      // FAST 체크
      if (!alertType && wardSettings.fast_enabled == 1) {
        const fastThreshold = assignment.infusion_cchr * (1 + wardSettings.fast_threshold / 100);
        this.logger.log(`[SPEED ALERT CHECK] Fast threshold: ${fastThreshold.toFixed(2)} (infusion_cchr: ${assignment.infusion_cchr}, fast_threshold: ${wardSettings.fast_threshold}%)`);

        if (rawLog.cchr > fastThreshold && rawLog.cchr >= 0 && rawLog.cchr <= 9999) {
          alertType = 'fast';
          alertTitle = '수액 주입 속도 빠름';
          alertMessage = `${room.name}호-${bed.bed_number}번 병상의 수액 주입 속도가 빠릅니다. (${Math.round(rawLog.cchr)} cc/hr)`;
        } else if (rawLog.cchr > 9999) {
          this.logger.warn(`[SPEED ALERT CHECK] FAST condition met but cchr value out of range (${rawLog.cchr}), notification not created`);
        }
      }

      // SLOW 체크
      if (!alertType && wardSettings.slow_enabled == 1) {
        const slowThreshold = assignment.infusion_cchr * (1 - Math.abs(wardSettings.slow_threshold) / 100);
        this.logger.log(`[SPEED ALERT CHECK] Slow threshold: ${slowThreshold.toFixed(2)} (infusion_cchr: ${assignment.infusion_cchr}, slow_threshold: -${Math.abs(wardSettings.slow_threshold)}%)`);

        if (rawLog.cchr < slowThreshold && rawLog.cchr > 0 && rawLog.cchr <= 9999) {
          alertType = 'slow';
          alertTitle = '수액 주입 속도 느림';
          alertMessage = `${room.name}호-${bed.bed_number}번 병상의 수액 주입 속도가 느립니다. (${Math.round(rawLog.cchr)} cc/hr)`;
        } else if (rawLog.cchr > 9999) {
          this.logger.warn(`[SPEED ALERT CHECK] SLOW condition met but cchr value out of range (${rawLog.cchr}), notification not created`);
        }
      }

      if (!alertType) {
        this.logger.log(`[SPEED ALERT CHECK] No alert condition met`);
        return;
      }

      // 이전 alert_type과 동일하면 스킵 (상태 변경 시에만 알림)
      const previousAlertType = assignment.alert_type || null;
      if (alertType === previousAlertType) {
        this.logger.log(`[SPEED ALERT CHECK] Alert type unchanged (${alertType}), skipping`);
        return;
      }

      this.logger.log(`[SPEED ALERT CHECK] Alert type changed: ${previousAlertType} → ${alertType}`);

      // 4. 해당 병동의 의료진 조회 (admin, nurse만)
      const userRepository = this.getRepository('users');
      const users = await userRepository.find({
        where: {
          hospital_id: ward.hospital_id,
          ward_id: ward.id,
        }
      });

      const targetUsers = users.filter(user =>
        user.role === 'admin' || user.role === 'nurse'
      );

      if (targetUsers.length === 0) {
        this.logger.log(`[SPEED ALERT CHECK] No users found for ward ${ward.id}`);
        return;
      }

      this.logger.log(`[SPEED ALERT CHECK] Found ${targetUsers.length} users for alert`);

      // 5. 각 사용자에게 알림 생성 (상태 변경이 확인되었으므로 항상 발송)
      for (const user of targetUsers) {
        await this.insertData('notifications', {
          user_id: user.id,
          patient_bed_assignment_id: assignment.id,
          device_id: device.id,
          title: alertTitle,
          message: alertMessage,
          type: alertType,
          is_read: 0,
        });
        this.logger.log(`[SPEED ALERT CHECK] ${alertType.toUpperCase()} notification created for user ${user.id}`);

        // FCM push 발송
        if (user.fcm_token) {
          const alertCategory = this.deriveAlertCategory(alertType);
          await this.fcmService.sendPush(user.fcm_token, alertTitle, alertMessage, {
            alert_category: alertCategory || '',
            alert_type: alertType,
          });
        }
      }

    } catch (error) {
      this.logger.error(`[SPEED ALERT CHECK ERROR] ${error.message}`);
      this.logger.error(error.stack);
    }
  }

  /**
   * 알림 체크 및 생성
   *
   * 수액 데이터 업데이트 시 호출되어 알림 조건을 체크하고 notifications 테이블에 저장합니다.
   *
   * 동작 흐름:
   * 1. released_at 체크 (이미 완료된 투여는 알림 불필요)
   * 2. bed_id로부터 계층 구조 조회 (bed → room → ward → hospital)
   * 3. 해당 병동의 의료진 조회 (admin, nurse만, super_admin 제외)
   * 4. ward_settings에서 complete_enabled/complete_threshold 조회
   * 5. 조건 충족 시 (infusion_percentage >= complete_threshold):
   *    - 중복 알림 방지 체크 (같은 assignment에 이미 보낸 알림이 있는지 확인)
   *    - notifications 테이블에 insertData로 저장
   *    - insertData 후처리에서 자동으로 MQTT 발송 (user/{user_id}/notification)
   *
   * @param assignment - 환자 침대 배정 정보
   * @param device - 디바이스 정보
   * @param infusionPercentage - 현재 수액 투여 퍼센트 (0-100)
   */
  private async checkAndSendNotifications(
    assignment: PatientBedAssignment,
    device: Device,
    infusionPercentage: number
  ) {
    try {
      this.logger.log(`[NOTIFICATION CHECK] Starting notification check for assignment ID: ${assignment.id}`);

      // released_at이 있으면 알림 불필요 (투여 완료 처리됨)
      if (assignment.released_at) {
        this.logger.log(`[NOTIFICATION CHECK] Assignment already released, skipping notification`);
        return;
      }

      // 1. bed_id로부터 계층 구조 조회
      const bedRepository = this.getRepository('beds');
      const bed = await bedRepository.findOne({
        where: { id: assignment.bed_id },
        relations: ['room', 'room.ward', 'room.ward.hospital']
      });

      if (!bed || !bed.room || !bed.room.ward) {
        this.logger.warn(`[NOTIFICATION CHECK] Bed hierarchy not found for bed_id: ${assignment.bed_id}`);
        return;
      }

      const ward = bed.room.ward;
      const room = bed.room;

      this.logger.log(`[NOTIFICATION CHECK] Hospital ID: ${ward.hospital_id}, Ward ID: ${ward.id}, Room: ${room.name}, Bed: ${bed.bed_number}`);

      // 2. ward_settings 조회 (병동 공통 설정)
      const wardSettingRepository = this.getRepository('ward_settings');
      const wardSettings = await wardSettingRepository.findOne({
        where: { ward_id: ward.id }
      });

      if (!wardSettings) {
        this.logger.warn(`[NOTIFICATION CHECK] No ward_settings found for ward ${ward.id}`);
        return;
      }

      // complete 알림 비활성화이거나 임계값 미달이면 스킵
      if (wardSettings.complete_enabled !== 1 || infusionPercentage < wardSettings.complete_threshold) {
        this.logger.log(`[NOTIFICATION CHECK] Complete alert not triggered: enabled=${wardSettings.complete_enabled}, ${infusionPercentage.toFixed(1)}% < ${wardSettings.complete_threshold}%`);
        return;
      }

      this.logger.log(`[NOTIFICATION CHECK] Complete threshold met: ${infusionPercentage.toFixed(1)}% >= ${wardSettings.complete_threshold}%`);

      // 3. 해당 병동의 의료진 조회 (admin, nurse만)
      const userRepository = this.getRepository('users');
      const users = await userRepository.find({
        where: {
          hospital_id: ward.hospital_id,
          ward_id: ward.id,
        }
      });

      const targetUsers = users.filter(user =>
        user.role === 'admin' || user.role === 'nurse'
      );

      if (targetUsers.length === 0) {
        this.logger.log(`[NOTIFICATION CHECK] No users found for ward ${ward.id}`);
        return;
      }

      this.logger.log(`[NOTIFICATION CHECK] Found ${targetUsers.length} users for notification`);

      // 4. 각 사용자에게 알림 생성 (중복 체크)
      const notificationRepository = this.getRepository('notifications');

      for (const user of targetUsers) {
        const unreadNotification = await notificationRepository.findOne({
          where: {
            patient_bed_assignment_id: assignment.id,
            user_id: user.id,
            type: 'almost_done',
            is_read: 0,
          }
        });

        if (unreadNotification) {
          this.logger.log(`[NOTIFICATION CHECK] User ${user.id} - ALMOST_DONE notification already exists, skipping duplicate`);
          continue;
        }

        const almostDoneTitle = '수액 투여 완료 임박';
        const almostDoneMessage = `${room.name}호-${bed.bed_number}번 병상의 수액이 ${Math.round(infusionPercentage)}% 진행 되었습니다.`;

        await this.insertData('notifications', {
          user_id: user.id,
          patient_bed_assignment_id: assignment.id,
          device_id: device.id,
          title: almostDoneTitle,
          message: almostDoneMessage,
          type: 'almost_done',
          is_read: 0,
        });

        this.logger.log(`[NOTIFICATION CHECK] Notification created for user ${user.id}`);

        // FCM push 발송
        if (user.fcm_token) {
          await this.fcmService.sendPush(user.fcm_token, almostDoneTitle, almostDoneMessage, {
            alert_category: 'caution',
            alert_type: 'almost_done',
          });
        }
      }

    } catch (error) {
      this.logger.error(`[NOTIFICATION CHECK ERROR] ${error.message}`);
      this.logger.error(error.stack);
    }
  }

  /**
   * 테스트용 함수: 알림 트리거
   *
   * assignment의 infusion_current_volume을 수동으로 조작하여 특정 퍼센트에 도달하게 만들고,
   * 알림 체크 로직을 테스트합니다.
   *
   * 사용 방법:
   * POST /api/test/trigger-notification
   * {
   *   "assignment_id": 1,
   *   "target_percentage": 96
   * }
   *
   * 동작:
   * 1. assignment 조회 및 유효성 검증
   * 2. infusion_current_volume을 목표 퍼센트에 맞게 계산 및 업데이트
   *    (예: total_volume=500ml, target=96% → current_volume=480ml)
   * 3. checkAndSendNotifications 호출하여 알림 로직 실행
   * 4. 결과 반환
   *
   * @param assignmentId - patient_bed_assignment ID
   * @param targetPercentage - 목표 퍼센트 (0-100)
   * @returns 테스트 결과 및 업데이트된 데이터 정보
   */
  async testNotification(assignmentId: number, targetPercentage: number) {
    try {
      this.logger.log(`[TEST] Starting notification test for assignment ${assignmentId}, target: ${targetPercentage}%`);

      // 1. assignment 조회
      const assignmentRepository = this.getRepository('patient_bed_assignments');
      const assignment = await assignmentRepository.findOne({
        where: { id: assignmentId },
        relations: ['device', 'bed', 'bed.room', 'bed.room.ward']
      });

      if (!assignment) {
        throw new HttpException(
          `Assignment with id ${assignmentId} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      this.logger.log(`[TEST] Assignment found: ID ${assignment.id}`);
      this.logger.log(`[TEST] Total volume: ${assignment.infusion_total_volume} ml`);
      this.logger.log(`[TEST] Current volume (before): ${assignment.infusion_current_volume} ml`);

      // 2. 목표 퍼센트에 해당하는 current_volume 계산
      const targetCurrentVolume = (assignment.infusion_total_volume * targetPercentage) / 100;

      this.logger.log(`[TEST] Target current volume: ${targetCurrentVolume} ml (${targetPercentage}%)`);

      // 3. assignment 업데이트
      await assignmentRepository.update(assignmentId, {
        infusion_current_volume: targetCurrentVolume,
        assigned_at: new Date()
      });

      this.logger.log(`[TEST] Updated assignment current volume to ${targetCurrentVolume} ml`);

      // 4. device 조회
      const deviceRepository = this.getRepository('devices');
      const device = await deviceRepository.findOne({
        where: { id: assignment.device_id }
      });

      if (!device) {
        throw new HttpException(
          `Device with id ${assignment.device_id} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      // 5. 업데이트된 assignment 다시 조회
      const updatedAssignment = await assignmentRepository.findOne({
        where: { id: assignmentId }
      });

      // 6. 알림 체크 함수 호출
      await this.checkAndSendNotifications(updatedAssignment, device, targetPercentage);

      this.logger.log(`[TEST] Notification check completed`);

      return {
        success: true,
        message: 'Notification test completed',
        data: {
          assignment_id: assignmentId,
          target_percentage: targetPercentage,
          target_current_volume: targetCurrentVolume,
          total_volume: assignment.infusion_total_volume,
          device_id: device.id,
          bed_id: assignment.bed_id
        }
      };

    } catch (error) {
      this.logger.error(`[TEST ERROR] ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  /**
   * 환자 침대 배정 Upsert (업데이트 또는 생성)
   *
   * bed_id가 일치하고 device_id, assigned_at, released_at이 모두 null인 데이터가 있으면:
   * - 기존 데이터 업데이트 (device_id, infusion_type, infusion_total_volume, infusion_gtt, assigned_at)
   * - devices 테이블 업데이트 (bed_id)
   *
   * 그렇지 않으면:
   * - 새로운 데이터 생성 (insertData 호출)
   *
   * @param data - patient_bed_assignment 데이터
   * @returns 생성 또는 업데이트된 assignment
   */
  async upsertPatientBedAssignment(data: any): Promise<any> {
    try {
      this.logger.log(`[UPSERT ASSIGNMENT] Starting upsert for bed_id: ${data.bed_id}, device_id: ${data.device_id}`);

      // 전처리: bed의 hospital_id와 device의 hospital_id 일치 검증
      if (data.bed_id && data.device_id) {
        const bedRepository = this.getRepository('beds');
        const deviceRepository = this.getRepository('devices');

        // bed_id로 역추적하여 hospital_id 조회
        const bed = await bedRepository.findOne({
          where: { id: data.bed_id },
          relations: ['room', 'room.ward']
        });

        if (!bed) {
          throw new HttpException('침대 정보를 찾을 수 없습니다', HttpStatus.NOT_FOUND);
        }

        if (!bed.room?.ward) {
          throw new HttpException('침대의 병동 정보를 찾을 수 없습니다', HttpStatus.BAD_REQUEST);
        }

        const bedHospitalId = bed.room.ward.hospital_id;

        // device_id로 device 조회
        const device = await deviceRepository.findOne({
          where: { id: data.device_id }
        });

        if (!device) {
          throw new HttpException('디바이스 정보를 찾을 수 없습니다', HttpStatus.NOT_FOUND);
        }

        // hospital_id 일치 검증
        if (device.hospital_id !== bedHospitalId) {
          this.logger.warn(`[UPSERT ASSIGNMENT] Hospital ID mismatch - bed hospital_id: ${bedHospitalId}, device hospital_id: ${device.hospital_id}`);
          throw new HttpException('해당 병원에서 관리하는 기기 정보가 아닙니다', HttpStatus.BAD_REQUEST);
        }

        this.logger.log(`[UPSERT ASSIGNMENT] Hospital ID validation passed - hospital_id: ${bedHospitalId}`);
      }

      const assignmentRepository = this.getRepository('patient_bed_assignments');

      // 1. bed_id가 일치하고 device_id, assigned_at, released_at이 모두 null인 기존 데이터 찾기
      const existingAssignment = await assignmentRepository.findOne({
        where: {
          bed_id: data.bed_id,
          device_id: IsNull(),
          assigned_at: IsNull(),
          released_at: IsNull(),
        }
      });

      if (existingAssignment) {
        // 기존 데이터가 있으면 업데이트
        this.logger.log(`[UPSERT ASSIGNMENT] Found existing assignment ID: ${existingAssignment.id}, updating...`);

        await assignmentRepository.update(existingAssignment.id, {
          device_id: data.device_id,
          assigned_at: new Date(),
        });

        // devices 테이블 업데이트 (bed_id 역추적하여 hospital_id, ward_id, room_id도 업데이트)
        if (data.device_id) {
          const deviceRepository = this.getRepository('devices');
          const bedRepository = this.getRepository('beds');

          // bed_id로 역추적하여 hospital_id, ward_id, room_id 조회
          const bed = await bedRepository.findOne({
            where: { id: data.bed_id },
            relations: ['room', 'room.ward']
          });

          if (bed?.room?.ward) {
            await deviceRepository.update(data.device_id, {
              bed_id: data.bed_id,
              room_id: bed.room.id,
              ward_id: bed.room.ward.id,
              hospital_id: bed.room.ward.hospital_id,
              last_udpate_at: new Date(),
            });
            this.logger.log(`[UPSERT ASSIGNMENT] Updated device ${data.device_id} - bed_id: ${data.bed_id}, room_id: ${bed.room.id}, ward_id: ${bed.room.ward.id}, hospital_id: ${bed.room.ward.hospital_id}`);
          } else {
            // bed 정보가 없으면 bed_id만 업데이트
            await deviceRepository.update(data.device_id, {
              bed_id: data.bed_id,
              last_udpate_at: new Date(),
            });
            this.logger.log(`[UPSERT ASSIGNMENT] Updated device ${data.device_id} - bed_id: ${data.bed_id} (no bed hierarchy found)`);
          }
        }

        // beds 테이블 status 업데이트
        if (data.bed_id) {
          const bedRepository = this.getRepository('beds');
          await bedRepository.update(data.bed_id, { status: 'occupied' });
          this.logger.log(`[UPSERT ASSIGNMENT] Updated bed ${data.bed_id} status to occupied`);
        }

        // 업데이트된 데이터 조회
        const updatedAssignment = await assignmentRepository.findOne({
          where: { id: existingAssignment.id },
          relations: ['bed', 'bed.room', 'bed.room.ward']
        });

        this.logger.log(`[UPSERT ASSIGNMENT] Successfully updated assignment ID: ${existingAssignment.id}`);

        // usage_count 증가
        if (data.infusion_type) {
          try {
            const infusionRepository = this.getRepository('infusions');
            const infusion = await infusionRepository.findOne({ where: { name: data.infusion_type, is_active: true } });
            if (infusion) {
              await infusionRepository.increment({ id: infusion.id }, 'usage_count', 1);
              this.logger.log(`[UPSERT ASSIGNMENT] usage_count incremented for infusion "${data.infusion_type}" (id=${infusion.id})`);
            }
          } catch (usageError) {
            this.logger.error(`[UPSERT ASSIGNMENT] usage_count update failed: ${usageError.message}`);
          }
        }

        // MQTT 발송: hospital의 admin, nurse에게 페이지 새로고침 알림
        if (updatedAssignment?.bed?.room?.ward) {
          const hospitalId = updatedAssignment.bed.room.ward.hospital_id;
          await this.sendAssignmentRefreshNotification(hospitalId, {
            assignment_id: updatedAssignment.id,
            bed_id: updatedAssignment.bed_id,
            patient_id: updatedAssignment.patient_id,
            action: 'update'
          });
        }


        return updatedAssignment;

      } else {
        // 기존 데이터가 없으면 새로 생성
        this.logger.log(`[UPSERT ASSIGNMENT] No existing assignment found, creating new...`);

        // assigned_at을 현재 시간으로 설정
        const createData = {
          ...data,
          assigned_at: new Date()
        };

        const result = await this.insertData('patient_bed_assignments', createData);

        // -----------------------------------------usage_count 증가 cchr 추가  ------------------------ 0612
        if (data.device_id && data.infusion_total_volume && data.infusion_cchr) {
    const deviceRepository = this.getRepository('devices');
    // device_id로 기기의 시리얼 번호를 찾습니다.
    deviceRepository.findOne({ where: { id: data.device_id } }).then(targetDevice => {
      if (targetDevice && targetDevice.serial_number) {
        // 기기로 용량과 속도를 전송합니다.
        // 추가로 누적투여량 0으로 변경하고 수액 교체 파라미터도 같이 전송
        this.mqttService.sendDeviceSetting(targetDevice.serial_number, {
          totalVolume: data.infusion_total_volume,
          flowRate: data.infusion_cchr,

          infusion_current_volume: 0,
          // 수액 교체 버튼 파라미터 
          infusion_change_button: true

        });
        this.logger.log(`[TEST]1 기기(${targetDevice.serial_number})에 신규 수액 배정 -> 누적총량 0 리셋 명령 전송됨!`);
        this.logger.log(`[UPSERT ASSIGNMENT] 기기(${targetDevice.serial_number})로 용량 및 속도 전송 완료!`);
      }
    }).catch(err => {
      this.logger.error(`[UPSERT ASSIGNMENT] 기기 정보 조회 실패: ${err.message}`);
    });
  }
        // ------------------------------------------------------------------------------------

        if (data.infusion_type) {
          try {
            const infusionRepository = this.getRepository('infusions');
            const infusion = await infusionRepository.findOne({ where: { name: data.infusion_type, is_active: true } });
            if (infusion) {
              await infusionRepository.increment({ id: infusion.id }, 'usage_count', 1);
              this.logger.log(`[UPSERT ASSIGNMENT] usage_count incremented for infusion "${data.infusion_type}" (id=${infusion.id})`);
            }
          } catch (usageError) {
            this.logger.error(`[UPSERT ASSIGNMENT] usage_count update failed: ${usageError.message}`);
          }
        }

        // MQTT 발송: hospital의 admin, nurse에게 페이지 새로고침 알림
        const bedRepository = this.getRepository('beds');
        const bed = await bedRepository.findOne({
          where: { id: data.bed_id },
          relations: ['room', 'room.ward']
        });

        if (bed?.room?.ward) {
          const hospitalId = bed.room.ward.hospital_id;
          await this.sendAssignmentRefreshNotification(hospitalId, {
            assignment_id: result.id,
            bed_id: result.bed_id,
            patient_id: result.patient_id,
            action: 'create'
          });
        }

        return result;
      }

    } catch (error) {
      this.logger.error(`[UPSERT ASSIGNMENT ERROR] ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  /**
   * assignment 새로고침 MQTT 알림 발송 (공통 헬퍼)
   *
   * 해당 병원의 admin, nurse에게 assignment 새로고침 알림을 MQTT로 발송합니다.
   *
   * @param hospitalId - 병원 ID
   * @param payload - MQTT payload
   */
  private async sendAssignmentRefreshNotification(hospitalId: number, payload: any) {
    try {
      const userRepository = this.getRepository('users');
      const users = await userRepository.find({
        where: { hospital_id: hospitalId }
      });

      const targetUsers = users.filter(user => user.role === 'super_admin' || user.role === 'admin' || user.role === 'nurse');

      for (const user of targetUsers) {
        const topic = `user/${user.id}/assignment/refresh`;
        this.mqttService.publishMessage(topic, payload);
      }

      this.logger.log(`[ASSIGNMENT REFRESH] Sent notification to ${targetUsers.length} users in hospital ${hospitalId}`);
    } catch (error) {
      this.logger.error(`[ASSIGNMENT REFRESH ERROR] ${error.message}`);
    }
  }

  /**
   * 가상 데이터 생성: patient_bed_assignments
   *
   * 프론트엔드에서 hospital_id, ward_id를 받아서 랜덤 데이터를 생성합니다.
   * - ward_id가 null이면 해당 병원의 모든 병동에서 병실 선택
   * - ward_id가 있으면 해당 병동의 병실만 선택
   * - 랜덤한 환자 이름으로 patient 생성
   * - device_id는 null
   * - infusion_type, infusion_total_volume은 랜덤 값
   *
   * @param hospitalId - 병원 ID (필수)
   * @param wardId - 병동 ID (선택)
   * @returns 생성된 assignment 정보
   */
  async generateMockAssignment(hospitalId: number, wardId?: number) {
    try {
      this.logger.log(`[MOCK] Generating mock assignment for hospital ${hospitalId}, ward ${wardId || 'all'}`);

      // 1. 병실들 조회 (ward_id가 있으면 해당 병동만, 없으면 병원의 모든 병동)
      const roomRepository = this.getRepository('rooms');
      let rooms: Room[];

      if (wardId) {
        // ward_id가 지정된 경우: 해당 병동의 병실만 조회
        rooms = await roomRepository.find({
          where: { ward_id: wardId }
        });
      } else {
        // ward_id가 null인 경우: 해당 병원의 모든 병동의 병실 조회
        const wardRepository = this.getRepository('wards');
        const wards = await wardRepository.find({
          where: { hospital_id: hospitalId }
        });

        if (wards.length === 0) {
          return {
            success: false,
            statusCode: 404,
            message: `No wards found for hospital ${hospitalId}`
          };
        }

        const wardIds = wards.map(w => w.id);
        rooms = await roomRepository
          .createQueryBuilder('room')
          .where('room.ward_id IN (:...wardIds)', { wardIds })
          .getMany();
      }

      if (rooms.length === 0) {
        return {
          success: false,
          statusCode: 404,
          message: wardId ? `No rooms found for ward ${wardId}` : `No rooms found for hospital ${hospitalId}`
        };
      }

      // 2. 모든 병실의 available 침대들 조회
      const bedRepository = this.getRepository('beds');
      const roomIds = rooms.map(r => r.id);
      const availableBeds = await bedRepository
        .createQueryBuilder('bed')
        .where('bed.room_id IN (:...roomIds)', { roomIds })
        .andWhere('bed.status = :status', { status: 'available' })
        .getMany();

      if (availableBeds.length === 0) {
        throw new HttpException(
          '사용 가능한 병상이 없습니다',
          HttpStatus.CONFLICT
        );
      }

      // 3. 랜덤하게 빈 침대 선택
      const randomBed = availableBeds[Math.floor(Math.random() * availableBeds.length)];
      this.logger.log(`[MOCK] Selected bed: ${randomBed.bed_number} (ID: ${randomBed.id})`);

      // 4. 선택된 침대의 병실 정보 조회
      const randomRoom = rooms.find(r => r.id === randomBed.room_id);
      this.logger.log(`[MOCK] Selected room: ${randomRoom.name} (ID: ${randomRoom.id})`);

      // 5. 랜덤한 환자 이름 생성
      const lastNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
      const firstNames = ['민수', '지혜', '서준', '하은', '도윤', '서연', '예준', '수빈', '시우', '지민'];
      const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const patientName = `${randomLastName}${randomFirstName}`;

      // 6. 랜덤한 차트번호 생성 (timestamp 기반)
      const chartNumber = `P${Date.now()}`;

      // 7. 환자 생성 (인적사항 랜덤 생성)
      const sexOptions = ['M', 'F'];
      const randomSex = sexOptions[Math.floor(Math.random() * sexOptions.length)];
      const randomAge = Math.floor(Math.random() * 66) + 20; // 20~85세
      const now = new Date();
      const birthYear = now.getFullYear() - randomAge;
      const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const birthDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      const dob = `${birthYear}-${birthMonth}-${birthDay}`;

      const deptCodes = ['NUR01', 'GS01', 'IM01', 'OS01', 'NS01', 'CS01', 'UR01', 'OB01', 'PD01', 'EM01'];
      const randomDept = deptCodes[Math.floor(Math.random() * deptCodes.length)];

      const docNames = ['이승훈', '박지영', '김태호', '정민서', '최동혁', '강수진', '윤재석', '한미라'];
      const residentNames = ['송현우', '오지은', '배성민', '류하늘', '신예린', '고준형'];
      const nurseNames = ['김수연', '이지원', '박하늘', '최유진', '정다은', '강서윤'];
      const randomDoc = docNames[Math.floor(Math.random() * docNames.length)];
      const randomResident = residentNames[Math.floor(Math.random() * residentNames.length)];
      const randomPaNurse = nurseNames[Math.floor(Math.random() * nurseNames.length)];
      const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const seq = String(Math.floor(Math.random() * 900) + 100);
      const adm = `ADM${today}${seq}`;

      const patientRepository = this.getRepository('patients');
      const patient = await patientRepository.save({
        name: patientName,
        chart_number: chartNumber,
        sex: randomSex,
        age: randomAge,
        dob,
        dept: randomDept,
        doc: randomDoc,
        resident: randomResident,
        pa_nurse: randomPaNurse,
        adm,
      });
      this.logger.log(`[MOCK] Created patient: ${patient.name} (ID: ${patient.id})`);

      // 7-2. patient_vitals 생성
      const vitalRepository = this.getRepository('patient_vitals');
      const randomHeight = (Math.random() * 40 + 150).toFixed(1); // 150.0~190.0
      const randomWeight = (Math.random() * 50 + 45).toFixed(1);  // 45.0~95.0
      const vitalTime = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      await vitalRepository.save({
        patient_id: patient.id,
        adm,
        date: today,
        time: vitalTime,
        nurse_key: null,
        height: parseFloat(randomHeight),
        weight: parseFloat(randomWeight),
      });
      this.logger.log(`[MOCK] Created patient_vital: height=${randomHeight}, weight=${randomWeight}`);

      // 8. patient_bed_assignments 생성 (랜덤 수액 1~2개)
      // DB에서 활성 수액 목록 조회
      const infusionRepository = this.getRepository('infusions');
      const infusionMasters = await infusionRepository.find({ where: { is_active: true } });

      // DB에 수액 데이터가 없으면 폴백
      const infusionOptions = infusionMasters.length > 0
        ? infusionMasters.map(inf => ({
            id: inf.id,
            type: `${inf.name} ${inf.default_volume || 500}ml`,
            code: inf.code,
            volume: inf.default_volume || 500,
            defaultCchr: inf.default_cchr || 164.10,
          }))
        : [
            { id: null, type: '생리식염수 500ml', code: 'NS', volume: 500, defaultCchr: 164.10 },
            { id: null, type: '5% 포도당 500ml', code: 'DW', volume: 500, defaultCchr: 164.10 },
            { id: null, type: '하트만용액 500ml', code: 'HD', volume: 500, defaultCchr: 262.56 },
          ];
      const cchrOptions = [131.28, 164.10, 196.92, 229.74, 262.56, 328.20, 393.84];

      const infusionCount = Math.random() < 0.6 ? 1 : 2; // 60% 확률 1개, 40% 확률 2개
      const assignmentRepository = this.getRepository('patient_bed_assignments');
      const assignments = [];

      for (let i = 0; i < infusionCount; i++) {
        const infusion = infusionOptions[Math.floor(Math.random() * infusionOptions.length)];
        const cchr = cchrOptions[Math.floor(Math.random() * cchrOptions.length)];
        const currentVolume = Math.floor(Math.random() * infusion.volume * 0.7); // 0~70% 진행

        const assignment = await assignmentRepository.save({
          patient_id: patient.id,
          bed_id: randomBed.id,
          device_id: null,
          drug_order_id: null,
          infusion_id: infusion.id || null,
          infusion_type: infusion.type,
          infusion_code: infusion.code,
          infusion_total_volume: infusion.volume,
          infusion_current_volume: currentVolume,
          infusion_cchr: cchr,
          status: 'infusing',
          is_active: true,
          assigned_at: now,
          started_at: now,
          released_at: null,
        });
        assignments.push(assignment);
        this.logger.log(`[MOCK] Created assignment: ID ${assignment.id}, ${infusion.type}`);
      }

      // 9. bed status를 occupied로 변경
      await bedRepository.update(randomBed.id, { status: 'occupied' });
      this.logger.log(`[MOCK] Updated bed ${randomBed.id} status to occupied`);

      return {
        success: true,
        message: 'Mock assignment created successfully',
        data: {
          patient: {
            id: patient.id,
            name: patient.name,
            chart_number: patient.chart_number,
            sex: randomSex,
            age: randomAge,
          },
          bed: {
            id: randomBed.id,
            bed_number: randomBed.bed_number
          },
          room: {
            id: randomRoom.id,
            name: randomRoom.name
          },
          assignments: assignments.map(a => ({
            assignment_id: a.id,
            infusion_id: a.infusion_id,
            infusion_type: a.infusion_type,
            infusion_code: a.infusion_code,
            total_volume: a.infusion_total_volume,
            current_volume: a.infusion_current_volume,
            cchr: a.infusion_cchr,
            status: a.status,
          }))
        }
      };

    } catch (error) {
      this.logger.error(`[MOCK ERROR] ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  /**
   * 기존 환자에게 수액 추가
   * 같은 patient_id + bed_id에 새 patient_bed_assignments 행 추가 (최대 3개 제한)
   */
  async addInfusion(data: {
    patient_id: number;
    bed_id: number;
    infusion_type: string;
    infusion_code?: string;
    infusion_id?: number;
    infusion_total_volume: number;
    infusion_gtt?: number;
    infusion_cchr?: number;
    drug_order_id?: number;
  }) {
    // cchr 값을 직접 사용 (gtt가 있으면 변환)
    let infusionCchr: number | undefined;
    if (data.infusion_cchr !== undefined) {
      infusionCchr = data.infusion_cchr;
    } else if (data.infusion_gtt !== undefined) {
      infusionCchr = Math.round(data.infusion_gtt * 3.282 * 100) / 100;
    }
    const assignmentRepository = this.getRepository('patient_bed_assignments');

    // 빈 assignment 찾기 (환자 배정 시 생성된 infusion_type 없는 레코드)
    const emptyAssignment = await assignmentRepository.findOne({
      where: {
        patient_id: data.patient_id,
        bed_id: data.bed_id,
        released_at: IsNull(),
        infusion_type: IsNull(),
      },
    });

    // 현재 active 수액 개수 체크 (실제 수액이 있는 것만 카운트)
    const activeCount = await assignmentRepository.count({
      where: {
        patient_id: data.patient_id,
        bed_id: data.bed_id,
        released_at: IsNull(),
        infusion_type: Not(IsNull()),
      }
    });

    if (activeCount >= 3) {
      throw new HttpException(
        '환자당 최대 3개 수액까지만 동시 투여 가능합니다.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let assignment;

    if (emptyAssignment) {
      // 빈 assignment 재활용 → UPDATE
      await assignmentRepository.update(emptyAssignment.id, {
        drug_order_id: data.drug_order_id || null,
        infusion_id: data.infusion_id || null,
        infusion_type: data.infusion_type,
        infusion_code: data.infusion_code || null,
        infusion_total_volume: data.infusion_total_volume,
        infusion_current_volume: 0,
        infusion_cchr: infusionCchr || 164.10,
        status: 'pending',
        is_active: true,
      });
      assignment = await assignmentRepository.findOne({ where: { id: emptyAssignment.id } });
      this.logger.log(`[ADD_INFUSION] Reused empty assignment ${emptyAssignment.id} for patient_id=${data.patient_id}, infusion=${data.infusion_type}, infusion_id=${data.infusion_id}`);
    } else {
      // 빈 assignment 없음 → 새 INSERT
      const now = new Date();
      assignment = await assignmentRepository.save({
        patient_id: data.patient_id,
        bed_id: data.bed_id,
        device_id: null,
        drug_order_id: data.drug_order_id || null,
        infusion_id: data.infusion_id || null,
        infusion_type: data.infusion_type,
        infusion_code: data.infusion_code || null,
        infusion_total_volume: data.infusion_total_volume,
        infusion_current_volume: 0,
        infusion_cchr: infusionCchr || 164.10,
        status: 'pending',
        is_active: true,
        assigned_at: now,
        released_at: null,
      });
      this.logger.log(`[ADD_INFUSION] Created new assignment ${assignment.id} for patient_id=${data.patient_id}, infusion=${data.infusion_type}, infusion_id=${data.infusion_id}`);
    }

    // MQTT 알림 발송: assignment refresh
    if (data.bed_id) {
      try {
        const bedRepository = this.getRepository('beds');
        const bed = await bedRepository.findOne({
          where: { id: data.bed_id },
          relations: ['room', 'room.ward']
        });
        if (bed?.room?.ward?.hospital_id) {
          await this.sendAssignmentRefreshNotification(bed.room.ward.hospital_id, {
            assignment_id: assignment.id,
            bed_id: data.bed_id,
            patient_id: data.patient_id,
            action: 'add_infusion'
          });
        }
      } catch (mqttError) {
        this.logger.error(`[ADD_INFUSION] MQTT notification failed: ${mqttError.message}`);
      }
    }

    // usage_count 증가
    try {
      const infusionRepository = this.getRepository('infusions');
      if (data.infusion_id) {
        await infusionRepository.increment({ id: data.infusion_id }, 'usage_count', 1);
        this.logger.log(`[ADD_INFUSION] usage_count incremented for infusion_id=${data.infusion_id}`);
      } else if (data.infusion_type) {
        const infusion = await infusionRepository.findOne({ where: { name: data.infusion_type, is_active: true } });
        if (infusion) {
          await infusionRepository.increment({ id: infusion.id }, 'usage_count', 1);
          this.logger.log(`[ADD_INFUSION] usage_count incremented for infusion name="${data.infusion_type}" (id=${infusion.id})`);
        }
      }
    } catch (usageError) {
      this.logger.error(`[ADD_INFUSION] usage_count update failed: ${usageError.message}`);
    }

    return {
      success: true,
      message: '수액이 추가되었습니다.',
      data: {
        assignment_id: assignment.id,
        patient_id: data.patient_id,
        bed_id: data.bed_id,
        infusion_id: assignment.infusion_id,
        infusion_type: assignment.infusion_type,
        infusion_code: assignment.infusion_code,
        total_volume: assignment.infusion_total_volume,
        cchr: assignment.infusion_cchr,
        status: assignment.status,
        active_infusion_count: activeCount + 1,
      }
    };
  }
}