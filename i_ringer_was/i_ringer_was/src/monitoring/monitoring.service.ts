import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { PatientBedAssignment } from '../entities/patient-bed-assignment.entity';
import { Bed } from '../entities/bed.entity';
import { Room } from '../entities/room.entity';
import { Ward } from '../entities/ward.entity';
import { Hospital } from '../entities/hospital.entity';
import { Device } from '../entities/device.entity';
import { User } from '../entities/user.entity';
import { NurseRoomAssignment } from '../entities/nurse-room-assignment.entity';
import { InfusionRawLog } from '../entities/infusion-raw-log.entity';
import { Infusion } from '../entities/infusion.entity';
import { MqttService } from '../mqtt/mqtt.service';


export interface MonitoringFilters {
  hospitalId?: number;
  wardId?: number;
  roomIds?: number[];
}

export interface BedData {
  bed_id: number;
  bed_number: string;
  bed_status: string;
  patient_info?: {
    id: number;
    name: string;
    chart_number: string;
    gender: string | null;
    age: number | null;
  };
  assignments?: any[];
}

export interface RoomNurseData {
  id: number;
  nickname: string;
  employee_number: string | null;
  profile_image: string;
}

export interface RoomData {
  room_id: number;
  room_number: string;
  nurse: RoomNurseData | null;
  beds: BedData[];
}

export interface WardData {
  ward_id: number;
  ward_name: string;
  rooms: RoomData[];
}

export interface HospitalData {
  hospital_id: number;
  hospital_name: string;
  wards: WardData[];
}

@Injectable()
export class MonitoringService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => MqttService))
    private readonly mqttService: MqttService
  ) {}

  /**
   * [개발용] 침대 ID로 전체 정보 조회
   *
   * bed_id를 기반으로 침대, 병실, 병동, 병원 정보 및 담당 간호사 정보를 조회합니다.
   *
   * @param bedId - 침대 ID
   * @returns 침대, 병실, 병동, 병원, 간호사 정보
   */
  async getBedInfo(bedId: number) {
    // 1. bed 조회 (관계 포함)
    const bedRepository = this.dataSource.getRepository(Bed);
    const bed = await bedRepository.findOne({
      where: { id: bedId },
      relations: ['room', 'room.ward', 'room.ward.hospital']
    });

    if (!bed) {
      return {
        success: false,
        statusCode: 404,
        message: `Bed with id ${bedId} not found`
      };
    }

    if (!bed.room || !bed.room.ward || !bed.room.ward.hospital) {
      return {
        success: false,
        statusCode: 404,
        message: `Incomplete hierarchy for bed ${bedId}`
      };
    }

    // 2. 해당 병동의 간호사 조회
    const userRepository = this.dataSource.getRepository(User);
    const nurses = await userRepository.find({
      where: {
        hospital_id: bed.room.ward.hospital_id,
        ward_id: bed.room.ward_id
      }
    });

    // admin, nurse만 필터링
    const filteredNurses = nurses
      .filter(user => user.role === 'admin' || user.role === 'nurse')
      .map(user => ({
        id: user.id,
        nickname: user.nickname,
        auth_id: user.auth_id,
        role: user.role
      }));

    return {
      success: true,
      data: {
        bed: {
          id: bed.id,
          bed_number: bed.bed_number,
          status: bed.status
        },
        room: {
          id: bed.room.id,
          name: bed.room.name
        },
        ward: {
          id: bed.room.ward.id,
          name: bed.room.ward.name
        },
        hospital: {
          id: bed.room.ward.hospital.id,
          name: bed.room.ward.hospital.name
        },
        nurses: filteredNurses
      }
    };
  }

  /**
   * 여러 투여 완료 일괄 처리
   *
   * 여러 patient_bed_assignments를 일괄로 완료 처리합니다.
   * 각 ID별로 성공/실패를 개별적으로 처리하고 결과를 반환합니다.
   *
   * @param assignmentIds - patient_bed_assignment ID 배열
   * @returns 각 ID별 처리 결과
   */
  async releaseBulkAssignments(assignmentIds: number[]) {
    const results = [];
    const successfulAssignmentIds = [];

    for (const assignmentId of assignmentIds) {
      const result = await this.releaseAssignment(assignmentId);
      results.push({
        assignment_id: assignmentId,
        ...result
      });

      // 성공한 assignment ID 수집
      if (result.success) {
        successfulAssignmentIds.push(assignmentId);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    const hasFailures = failedCount > 0;

    // 성공한 assignment가 있으면 MQTT 발송
    if (successfulAssignmentIds.length > 0) {
      await this.sendBulkReleaseRefreshNotification(successfulAssignmentIds);
    }

    return {
      success: true,
      message: `Bulk release completed: ${successCount} succeeded, ${failedCount} failed`,
      data: {
        total: results.length,
        succeeded: successCount,
        failed: failedCount,
        hasFailures: hasFailures,
        results: results
      }
    };
  }

  /**
   * 투여 완료 처리
   *
   * patient_bed_assignments의 특정 투여를 완료 처리합니다.
   *
   * 처리 흐름:
   * 1. assignment 조회 및 유효성 검증
   *    - 존재하지 않으면 404 에러
   *    - released_at이 이미 설정되어 있으면 409 에러 (이미 완료 처리됨)
   * 2. device 조회 및 bed_id null로 업데이트
   *    - device가 없으면 404 에러
   * 3. assignment의 released_at을 현재 시간으로 업데이트
   * 4. bed의 status를 'available'로 복구
   * 5. 성공 시 200 응답
   *
   * @param assignmentId - patient_bed_assignment ID
   * @returns 완료 처리 결과
   */
  async clearInfusion(assignmentId: number) {
    const assignmentRepository = this.dataSource.getRepository(PatientBedAssignment);
    const assignment = await assignmentRepository.findOne({
      where: { id: assignmentId }
    });

    if (!assignment) {
      return {
        success: false,
        statusCode: 404,
        message: `Assignment with id ${assignmentId} not found`
      };
    }

    // 수액 관련 필드만 NULL로 초기화 (환자-침상 연결 유지)
    await assignmentRepository.update(assignmentId, {
      infusion_id: null,
      infusion_type: null,
      infusion_code: null,
      infusion_total_volume: null,
      infusion_cchr: null,
      infusion_current_volume: null,
      started_at: null,
      stopped_at: null,
      status: 'pending',
      alert_type: null,
      alert_category: null,
      first_zero_cchr_at: null,
      last_measured_weight: null,
      last_measured_time: null,
    });

    // device 연결도 해제 (수액이 없으면 기기도 분리) + 위치 정보 초기화 (hospital, ward는 유지)
    if (assignment.device_id) {
      const deviceRepository = this.dataSource.getRepository(Device);
      await deviceRepository.update(assignment.device_id, {
        bed_id: null,
        room_id: null,
        last_udpate_at: new Date()
      });
      await assignmentRepository.update(assignmentId, {
        device_id: null,
      });
    }

    // MQTT 알림 발송
    if (assignment.bed_id) {
      try {
        const bedRepository = this.dataSource.getRepository(Bed);
        const bed = await bedRepository.findOne({
          where: { id: assignment.bed_id },
          relations: ['room', 'room.ward']
        });
        if (bed?.room?.ward?.hospital_id) {
          await this.sendAssignmentRefreshNotification(bed.room.ward.hospital_id, {
            assignment_id: assignmentId,
            bed_id: assignment.bed_id,
            action: 'clear_infusion'
          });
        }
      } catch (mqttError) {
        console.error(`[CLEAR INFUSION] MQTT notification failed: ${mqttError.message}`);
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: `Infusion cleared for assignment ${assignmentId}`,
      data: {
        assignment_id: assignmentId,
      }
    };
  }

  async releaseAssignment(assignmentId: number) {
    // 1. assignment 조회
    const assignmentRepository = this.dataSource.getRepository(PatientBedAssignment);
    const assignment = await assignmentRepository.findOne({
      where: { id: assignmentId }
    });

    if (!assignment) {
      return {
        success: false,
        statusCode: 404,
        message: `Assignment with id ${assignmentId} not found`
      };
    }

    // released_at 이미 설정되어 있는지 확인
    if (assignment.released_at) {
      return {
        success: false,
        statusCode: 409,
        message: `Assignment with id ${assignmentId} is already released`
      };
    }

    // 2. device 조회 및 bed_id null로 업데이트
    if (assignment.device_id) {
      const deviceRepository = this.dataSource.getRepository(Device);
      const device = await deviceRepository.findOne({
        where: { id: assignment.device_id }
      });

      if (!device) {
        return {
          success: false,
          statusCode: 404,
          message: `Device with id ${assignment.device_id} not found`
        };
      }

      // device의 위치 정보 초기화 (hospital_id, ward_id는 유지)
      await deviceRepository.update(assignment.device_id, {
        bed_id: null,
        room_id: null,
        last_udpate_at: new Date()
      });
    }

    // 3. assignment의 released_at을 현재 시간으로 업데이트
    await assignmentRepository.update(assignmentId, {
      released_at: new Date()
    });

    // 4. bed의 status를 'available'로 복구
    if (assignment.bed_id) {
      const bedRepository = this.dataSource.getRepository(Bed);
      await bedRepository.update(assignment.bed_id, {
        status: 'available'
      });
    }

    // MQTT 알림 발송
    if (assignment.bed_id) {
      try {
        const bedRepository = this.dataSource.getRepository(Bed);
        const bed = await bedRepository.findOne({
          where: { id: assignment.bed_id },
          relations: ['room', 'room.ward']
        });
        if (bed?.room?.ward?.hospital_id) {
          await this.sendAssignmentRefreshNotification(bed.room.ward.hospital_id, {
            assignment_id: assignmentId,
            bed_id: assignment.bed_id,
            action: 'release'
          });
        }
      } catch (mqttError) {
        console.error(`[ASSIGNMENT RELEASE] MQTT notification failed: ${mqttError.message}`);
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: `Assignment ${assignmentId} successfully released`,
      data: {
        assignment_id: assignmentId,
        released_at: new Date()
      }
    };
  }

  async getMonitoringData(filters: MonitoringFilters) {
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        'h.id as hospitalId',
        'h.name as hospitalName',
        'w.id as wardId',
        'w.name as wardName',
        'r.id as roomId',
        'r.name as roomNumber',
        'b.id as bedId',
        'b.bed_number as bedNumber',
        'b.status as bedStatus',
        'pba.id as assignmentId',
        'pba.patient_id as patientId',
        'pba.assigned_at as assignedAt',
        'pba.infusion_type as infusionType',
        'pba.infusion_total_volume as totalVolume',
        'pba.infusion_current_volume as currentVolume',
        'pba.infusion_cchr as infusionCchr',
        'pba.alert_type as alertType',
        'p.name as patientName',
        'p.chart_number as registrationNumber',
        'p.sex as patientGender',
        'p.age as patientAge',
      ])
      .from(Ward, 'w')
      .innerJoin(Hospital, 'h', 'h.id = w.hospital_id')
      .innerJoin(Room, 'r', 'r.ward_id = w.id')
      .innerJoin(Bed, 'b', 'b.room_id = r.id')
      .leftJoin(
        PatientBedAssignment,
        'pba',
        'pba.bed_id = b.id AND pba.released_at IS NULL'
      )
      .leftJoin(Patient, 'p', 'p.id = pba.patient_id');

    // Apply filters
    if (filters.hospitalId) {
      queryBuilder.andWhere('h.id = :hospitalId', {
        hospitalId: filters.hospitalId
      });
    }

    if (filters.wardId) {
      queryBuilder.andWhere('w.id = :wardId', {
        wardId: filters.wardId
      });
    }

    if (filters.roomIds && filters.roomIds.length > 0) {
      queryBuilder.andWhere('r.id IN (:...roomIds)', {
        roomIds: filters.roomIds
      });
    }

    queryBuilder
      .orderBy('h.id', 'ASC')
      .addOrderBy('w.id', 'ASC')
      .addOrderBy('r.name', 'ASC')
      .addOrderBy('b.bed_number', 'ASC');

    const results = await queryBuilder.getRawMany();

    // Group data by hospital, ward, and room
    const hospitalsMap = new Map<number, HospitalData>();
    const bedIds: number[] = [];

    results.forEach(row => {
      bedIds.push(row.bedId);

      // Get or create hospital
      if (!hospitalsMap.has(row.hospitalId)) {
        hospitalsMap.set(row.hospitalId, {
          hospital_id: row.hospitalId,
          hospital_name: row.hospitalName,
          wards: []
        });
      }
      const hospital = hospitalsMap.get(row.hospitalId)!;

      // Find or create ward in hospital
      let ward = hospital.wards.find(w => w.ward_id === row.wardId);
      if (!ward) {
        ward = {
          ward_id: row.wardId,
          ward_name: row.wardName,
          rooms: []
        };
        hospital.wards.push(ward);
      }

      // Find or create room in ward
      let room = ward.rooms.find(r => r.room_id === row.roomId);
      if (!room) {
        room = {
          room_id: row.roomId,
          room_number: row.roomNumber,
          nurse: null,
          beds: []
        };
        ward.rooms.push(room);
      }

      // Create bed data
      const bedData: BedData = {
        bed_id: row.bedId,
        bed_number: row.bedNumber,
        bed_status: row.bedStatus,
      };

      // Add patient info if assigned
      if (row.patientId) {
        bedData.patient_info = {
          id: row.patientId,
          name: row.patientName,
          chart_number: row.registrationNumber,
          gender: row.patientGender || null,
          age: row.patientAge || null,
        };
      }

      room.beds.push(bedData);
    });

    // 각 room의 담당 간호사 조회 (nurse_room_assignments)
    const allRoomIds = [...new Set(results.map(r => r.roomId).filter(id => id))];
    if (allRoomIds.length > 0) {
      const nurseAssignmentRepo = this.dataSource.getRepository(NurseRoomAssignment);
      const nurseAssignments = await nurseAssignmentRepo
        .createQueryBuilder('nra')
        .leftJoinAndSelect('nra.user', 'user')
        .where('nra.room_id IN (:...roomIds)', { roomIds: allRoomIds })
        .andWhere('nra.is_active = :isActive', { isActive: true })
        .getMany();

      // roomId별 담당 간호사 매핑 (1명)
      const nurseByRoomId = new Map<number, RoomNurseData>();
      nurseAssignments.forEach(nra => {
        if (nra.user && !nurseByRoomId.has(nra.room_id)) {
          nurseByRoomId.set(nra.room_id, {
            id: nra.user.id,
            nickname: nra.user.nickname,
            employee_number: nra.user.employee_number || null,
            profile_image: nra.user.profile_image || '/images/default_profile.png',
          });
        }
      });

      // 각 room에 nurse 할당
      hospitalsMap.forEach(hospital => {
        hospital.wards.forEach(ward => {
          ward.rooms.forEach(room => {
            room.nurse = nurseByRoomId.get(room.room_id) || null;
          });
        });
      });
    }

    // patient_bed_assignments 조회 및 추가 (released_at이 null인 것만)
    if (bedIds.length > 0) {
      // patient_bed_assignments에서 bed_id 조회
      const assignmentRepository = this.dataSource.getRepository(PatientBedAssignment);
      const assignments = await assignmentRepository
        .createQueryBuilder('pba')
        .where('pba.bed_id IN (:...bedIds)', { bedIds })
        .andWhere('pba.released_at IS NULL')
        .getMany();

      // infusion_code가 없는 assignment에 대해 infusions 테이블로 fallback 매칭
      const needCodeAssignments = assignments.filter(a => !a.infusion_code && a.infusion_type);
      if (needCodeAssignments.length > 0) {
        const infusionRepo = this.dataSource.getRepository(Infusion);
        const infusions = await infusionRepo.find();
        needCodeAssignments.forEach(a => {
          // 1) 정확 매칭
          const exact = infusions.find(inf => inf.name === a.infusion_type);
          if (exact) { a.infusion_code = exact.code; return; }
          // 2) infusion name이 assignment type을 포함하는 경우 (예: "생리식염수" → "생리식염수 0.9%")
          const partial = infusions.find(inf => inf.name.includes(a.infusion_type));
          if (partial) { a.infusion_code = partial.code; return; }
        });
      }

      // device_id 수집 (있는 것만)
      const deviceIds = [...new Set(assignments.map(a => a.device_id).filter(id => id))];

      // deviceId를 키로 하는 Map 생성
      const deviceMap = new Map<number, Device>();

      if (deviceIds.length > 0) {
        // device_id로 devices 조회
        const deviceRepository = this.dataSource.getRepository(Device);
        const devices = await deviceRepository
          .createQueryBuilder('device')
          .where('device.id IN (:...deviceIds)', { deviceIds })
          .getMany();

        devices.forEach(device => {
          deviceMap.set(device.id, device);
        });
      }

      // bedId별로 assignment 그룹화 (device가 없어도 포함)
      const assignmentsByBedId = new Map<number, PatientBedAssignment[]>();
      assignments.forEach(assignment => {
        if (!assignmentsByBedId.has(assignment.bed_id)) {
          assignmentsByBedId.set(assignment.bed_id, []);
        }
        assignmentsByBedId.get(assignment.bed_id)!.push(assignment);
      });

      // 각 device의 최근 측정 cchr 조회
      const measuredCchrMap = new Map<number, number | null>();
      if (deviceIds.length > 0) {
        const rawLogRepository = this.dataSource.getRepository(InfusionRawLog);
        const latestLogs = await rawLogRepository
          .createQueryBuilder('log')
          .select(['log.sn', 'log.cchr'])
          .innerJoin(Device, 'device', 'device.serial_number = log.sn')
          .where('device.id IN (:...deviceIds)', { deviceIds })
          .andWhere('log.cchr IS NOT NULL')
          .andWhere('log.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)')
          .orderBy('log.created_at', 'DESC')
          .getMany();

        // device serial_number → device_id 매핑
        const snToDeviceId = new Map<string, number>();
        deviceMap.forEach((device, id) => {
          snToDeviceId.set(device.serial_number, id);
        });

        // 각 device별 가장 최근 cchr (첫 번째 결과가 최신)
        latestLogs.forEach(log => {
          const devId = snToDeviceId.get(log.sn);
          if (devId && !measuredCchrMap.has(devId)) {
            measuredCchrMap.set(devId, log.cchr);
          }
        });
      }

      // 각 bed에 assignment 정보 추가
      hospitalsMap.forEach(hospital => {
        hospital.wards.forEach(ward => {
          ward.rooms.forEach(room => {
            room.beds.forEach(bed => {
              const bedAssignments = assignmentsByBedId.get(bed.bed_id) || [];
              bed.assignments = bedAssignments.map(assignment => {
                const percentage = assignment.infusion_total_volume
                  ? Math.floor((assignment.infusion_current_volume / assignment.infusion_total_volume) * 100)
                  : 0;

                const device = assignment.device_id ? deviceMap.get(assignment.device_id) : null;
                const measuredCchr = assignment.device_id ? (measuredCchrMap.get(assignment.device_id) ?? null) : null;

                return {
                  ...assignment,
                  infusion_cchr: assignment.infusion_cchr ?? null,
                  measured_cchr: measuredCchr,
                  infusion_percentage: percentage,
                  device: device ? {
                    id: device.id,
                    device_name: device.device_name,
                    serial_number: device.serial_number,
                    status: device.network_status || 'unknown',
                    batteryLevel: device.battery_percent || 0,
                    firmware_version: device.firmware_version,
                    last_udpate_at: device.last_udpate_at,
                  } : null
                };
              });
            });
          });
        });
      });
    }

    // If only one hospital is returned, return wards directly
    // Otherwise return hospitals array
    const hospitalsArray = Array.from(hospitalsMap.values());

    if (hospitalsArray.length === 1) {
      return {
        success: true,
        hospital_id: hospitalsArray[0].hospital_id,
        hospital_name: hospitalsArray[0].hospital_name,
        data: hospitalsArray[0].wards,
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      data: hospitalsArray,
      timestamp: new Date(),
    };
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
      const userRepository = this.dataSource.getRepository(User);
      const users = await userRepository.find({
        where: { hospital_id: hospitalId }
      });

      const targetUsers = users.filter(user => user.role === 'admin' || user.role === 'nurse');

      for (const user of targetUsers) {
        const topic = `user/${user.id}/assignment/refresh`;
        this.mqttService.publishMessage(topic, payload);
      }

      console.log(`[ASSIGNMENT REFRESH] Sent notification to ${targetUsers.length} users in hospital ${hospitalId}`);
    } catch (error) {
      console.error(`[ASSIGNMENT REFRESH ERROR] ${error.message}`);
    }
  }

  /**
   * 일괄 투여 완료 후 새로고침 알림 발송
   *
   * 성공적으로 완료 처리된 assignment들의 hospital_id별로 그룹화하여
   * 해당 병원의 admin, nurse에게 새로고침 알림을 MQTT로 발송합니다.
   *
   * @param assignmentIds - 성공적으로 완료 처리된 assignment ID 배열
   */
  private async sendBulkReleaseRefreshNotification(assignmentIds: number[]) {
    try {
      const assignmentRepository = this.dataSource.getRepository(PatientBedAssignment);

      // 1. assignment들의 bed 정보 조회 (hospital_id 추출용)
      const assignments = await assignmentRepository
        .createQueryBuilder('assignment')
        .leftJoinAndSelect('assignment.bed', 'bed')
        .leftJoinAndSelect('bed.room', 'room')
        .leftJoinAndSelect('room.ward', 'ward')
        .where('assignment.id IN (:...ids)', { ids: assignmentIds })
        .getMany();

      // 2. hospital_id별로 그룹화
      const hospitalAssignmentsMap = new Map<number, number[]>();

      for (const assignment of assignments) {
        if (assignment.bed?.room?.ward?.hospital_id) {
          const hospitalId = assignment.bed.room.ward.hospital_id;
          if (!hospitalAssignmentsMap.has(hospitalId)) {
            hospitalAssignmentsMap.set(hospitalId, []);
          }
          hospitalAssignmentsMap.get(hospitalId).push(assignment.id);
        }
      }

      // 3. 각 병원별로 admin, nurse에게 MQTT 발송
      for (const [hospitalId, releasedAssignmentIds] of hospitalAssignmentsMap.entries()) {
        await this.sendAssignmentRefreshNotification(hospitalId, {
          assignment_ids: releasedAssignmentIds,
          action: 'bulk_release',
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('[BULK RELEASE ERROR] Failed to send refresh notification:', error);
    }
  }

}