import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Ward } from '../entities/ward.entity';
import { Room } from '../entities/room.entity';
import { Bed } from '../entities/bed.entity';
import { Patient } from '../entities/patient.entity';
import { PatientBedAssignment } from '../entities/patient-bed-assignment.entity';
import { Device } from '../entities/device.entity';
import { DrugOrder } from '../entities/drug-order.entity';
import { PatientVital } from '../entities/patient-vital.entity';

@Injectable()
export class EmrService {
  constructor(private readonly dataSource: DataSource) {}

  async getMyWard(userId: number) {
    const userRepo = this.dataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });

    if (!user) {
      return { success: false, message: '사용자를 찾을 수 없습니다' };
    }

    if (!user.ward_id) {
      return { success: false, message: '배정된 병동이 없습니다' };
    }

    const wardRepo = this.dataSource.getRepository(Ward);
    const ward = await wardRepo.findOne({ where: { id: user.ward_id } });

    if (!ward) {
      return { success: false, message: '병동 정보를 찾을 수 없습니다' };
    }

    // 병동의 rooms → beds → active assignments → patients 조회
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        'r.id as roomId',
        'r.name as roomName',
        'r.code as roomCode',
        'r.type as roomType',
        'b.id as bedId',
        'b.bed_number as bedNumber',
        'b.status as bedStatus',
        'pba.id as assignmentId',
        'pba.patient_id as patientId',
        'pba.device_id as deviceId',
        'pba.drug_order_id as drugOrderId',
        'pba.infusion_type as infusionType',
        'pba.infusion_total_volume as totalVolume',
        'pba.infusion_current_volume as currentVolume',
        'pba.infusion_gtt as infusionGtt',
        'pba.infusion_cchr as infusionCchr',
        'pba.alert_type as alertType',
        'pba.assigned_at as assignedAt',
        'p.id as pId',
        'p.name as patientName',
        'p.chart_number as chartNumber',
        'p.sex as sex',
        'p.age as age',
        'p.dept as dept',
        'p.doc as doc',
        'p.resident as resident',
        'p.pa_nurse as paNurse',
        'p.adm as adm',
      ])
      .from(Room, 'r')
      .innerJoin(Bed, 'b', 'b.room_id = r.id')
      .leftJoin(
        PatientBedAssignment,
        'pba',
        'pba.bed_id = b.id AND pba.released_at IS NULL',
      )
      .leftJoin(Patient, 'p', 'p.id = pba.patient_id')
      .where('r.ward_id = :wardId', { wardId: user.ward_id })
      .orderBy('r.name', 'ASC')
      .addOrderBy('b.bed_number', 'ASC');

    const results = await queryBuilder.getRawMany();

    // device_id, drug_order_id 수집
    const deviceIds = [...new Set(results.map(r => r.deviceId).filter(Boolean))];
    const drugOrderIds = [...new Set(results.map(r => r.drugOrderId).filter(Boolean))];

    // 디바이스 정보 조회
    const deviceMap = new Map<number, any>();
    if (deviceIds.length > 0) {
      const deviceRepo = this.dataSource.getRepository(Device);
      const devices = await deviceRepo
        .createQueryBuilder('d')
        .where('d.id IN (:...ids)', { ids: deviceIds })
        .getMany();
      devices.forEach(d => deviceMap.set(d.id, d));
    }

    // 투약 정보 조회
    const drugOrderMap = new Map<number, any>();
    if (drugOrderIds.length > 0) {
      const drugOrderRepo = this.dataSource.getRepository(DrugOrder);
      const orders = await drugOrderRepo
        .createQueryBuilder('do')
        .where('do.id IN (:...ids)', { ids: drugOrderIds })
        .getMany();
      orders.forEach(o => drugOrderMap.set(o.id, o));
    }

    // Room별 그룹핑
    const roomsMap = new Map<number, any>();

    results.forEach(row => {
      if (!roomsMap.has(row.roomId)) {
        roomsMap.set(row.roomId, {
          room_id: row.roomId,
          room_name: row.roomName,
          room_code: row.roomCode,
          room_type: row.roomType,
          beds: [],
        });
      }

      const room = roomsMap.get(row.roomId)!;

      const bedData: any = {
        bed_id: row.bedId,
        bed_number: row.bedNumber,
        bed_status: row.bedStatus,
      };

      if (row.patientId) {
        const percentage = row.totalVolume
          ? Math.round((row.currentVolume / row.totalVolume) * 100)
          : 0;

        const device = row.deviceId ? deviceMap.get(row.deviceId) : null;
        const drugOrder = row.drugOrderId ? drugOrderMap.get(row.drugOrderId) : null;

        bedData.patient = {
          id: row.pId,
          name: row.patientName,
          chart_number: row.chartNumber,
          sex: row.sex,
          age: row.age,
          dept: row.dept,
          doc: row.doc,
          resident: row.resident,
          pa_nurse: row.paNurse,
          adm: row.adm,
        };

        bedData.assignment = {
          id: row.assignmentId,
          infusion_type: row.infusionType,
          total_volume: row.totalVolume,
          current_volume: row.currentVolume,
          infusion_gtt: row.infusionGtt,
          infusion_cchr: row.infusionCchr,
          infusion_percentage: percentage,
          alert_type: row.alertType,
          assigned_at: row.assignedAt,
          drug_order: drugOrder
            ? {
                id: drugOrder.id,
                order_code: drugOrder.order_code,
                order_name: drugOrder.order_name,
                order_date: drugOrder.order_date,
                dc_yn: drugOrder.dc_yn,
                qty: drugOrder.qty,
                method_name: drugOrder.method_name,
                is_fluid: drugOrder.is_fluid,
              }
            : null,
          device: device
            ? {
                id: device.id,
                device_name: device.device_name,
                serial_number: device.serial_number,
                status: device.network_status || 'unknown',
                battery_percent: device.battery_percent || 0,
                last_udpate_at: device.last_udpate_at,
              }
            : null,
        };
      }

      room.beds.push(bedData);
    });

    return {
      success: true,
      data: {
        ward: {
          id: ward.id,
          name: ward.name,
          code: ward.code,
        },
        rooms: Array.from(roomsMap.values()),
      },
    };
  }

  async getPatientOrders(
    patientId: number,
    query?: { dc_yn?: string; order_date?: string },
  ) {
    const repo = this.dataSource.getRepository(DrugOrder);
    const qb = repo
      .createQueryBuilder('do')
      .where('do.patient_id = :patientId', { patientId });

    if (query?.dc_yn) {
      qb.andWhere('do.dc_yn = :dcYn', { dcYn: query.dc_yn });
    }

    if (query?.order_date) {
      qb.andWhere('do.order_date = :orderDate', { orderDate: query.order_date });
    }

    qb.orderBy('do.order_date', 'DESC').addOrderBy('do.id', 'DESC');

    const orders = await qb.getMany();

    return {
      success: true,
      data: orders,
    };
  }

  async getPatientVitals(patientId: number) {
    const repo = this.dataSource.getRepository(PatientVital);
    const vitals = await repo.find({
      where: { patient_id: patientId },
      order: { date: 'DESC', time: 'DESC' },
    });

    return {
      success: true,
      data: vitals,
    };
  }
}
