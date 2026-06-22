import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Device } from '../entities/device.entity';
import { InfusionRawLog } from '../entities/infusion-raw-log.entity';
import { PatientBedAssignment } from '../entities/patient-bed-assignment.entity';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class DeviceStatusScheduler {
  private readonly logger = new Logger(DeviceStatusScheduler.name);
  private readonly timeoutSeconds: number;

  constructor(
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => MqttService))
    private readonly mqttService: MqttService,
    private readonly configService: ConfigService,
  ) {
    // .env에서 타임아웃 설정 읽기 (기본값: 120초)
    this.timeoutSeconds = this.configService.get<number>('DEVICE_TIMEOUT_SECONDS', 120);
    this.logger.log(`[DEVICE TIMEOUT CONFIG] Timeout set to ${this.timeoutSeconds} seconds`);
  }

  /**
   * 디바이스 온라인 상태 체크 스케줄러
   *
   * 매 1분마다 실행되어 다음 작업을 수행:
   * 1. network_status가 'online'인 모든 디바이스 조회
   * 2. 각 디바이스의 serial_number로 타임아웃 시간 내 infusion_raw_logs 데이터 확인
   *    (타임아웃 시간은 .env의 DEVICE_TIMEOUT_SECONDS 설정값 사용)
   * 3. 타임아웃 시간 내 데이터가 없으면 network_status를 'offline'으로 변경
   *
   * DB 연결 에러 발생 시 최대 3회 재시도
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkDeviceStatus() {
    await this.checkDeviceStatusWithRetry(3);
  }

  /**
   * 측정 중인 디바이스의 타임아웃 체크 및 disconnected 처리 스케줄러
   *
   * 매 1분마다 실행되어 다음 작업을 수행:
   * 1. released_at이 null인 active assignment 조회
   * 2. 각 assignment의 device serial_number로 타임아웃 시간 내 데이터 확인
   *    (타임아웃 시간은 .env의 DEVICE_TIMEOUT_SECONDS 설정값 사용)
   * 3. 타임아웃 시간 내 데이터가 없으면 alert_type을 'disconnected'로 변경
   * 4. patient_bed_assignments 업데이트 및 MQTT 발송
   */
  // 실행 주기 변경: 30초마다 실행하려면 @Cron('*/30 * * * * *')로 변경
  @Cron(CronExpression.EVERY_MINUTE)
  async checkInfusionDataTimeout() {
    await this.checkInfusionDataTimeoutWithRetry(3);
  }

  /**
   * 재시도 로직이 포함된 디바이스 상태 체크
   *
   * @param maxRetries - 최대 재시도 횟수
   * @param currentAttempt - 현재 시도 횟수
   */
  private async checkDeviceStatusWithRetry(maxRetries: number, currentAttempt: number = 1) {
    try {
      this.logger.log('[DEVICE STATUS CHECK] Starting device status check...');

      const deviceRepository = this.dataSource.getRepository(Device);
      const logRepository = this.dataSource.getRepository(InfusionRawLog);

      // 1. network_status가 'online'인 모든 디바이스 조회
      const onlineDevices = await deviceRepository.find({
        where: { network_status: 'online' }
      });

      if (onlineDevices.length === 0) {
        this.logger.log('[DEVICE STATUS CHECK] No online devices found');
        return;
      }

      this.logger.log(`[DEVICE STATUS CHECK] Found ${onlineDevices.length} online devices`);

      // 타임아웃 기준 시간 계산 (.env에서 설정한 값 사용)
      const timeoutDate = new Date();
      timeoutDate.setSeconds(timeoutDate.getSeconds() - this.timeoutSeconds);

      let offlineCount = 0;

      // 2. 각 디바이스별로 최근 데이터 확인
      for (const device of onlineDevices) {
        // 해당 디바이스의 타임아웃 시간 내 로그 조회
        const recentLog = await logRepository
          .createQueryBuilder('log')
          .where('log.sn = :sn', { sn: device.serial_number })
          .andWhere('log.created_at >= :timeoutDate', { timeoutDate })
          .orderBy('log.created_at', 'DESC')
          .limit(1)
          .getOne();

        // 3. 타임아웃 시간 내 데이터가 없으면 offline으로 변경
        if (!recentLog) {
          await deviceRepository.update(device.id, {
            network_status: 'offline'
          });
          offlineCount++;
          this.logger.log(`[DEVICE STATUS CHECK] Device ${device.id} (SN: ${device.serial_number}) set to OFFLINE - No data in last 2 minutes`);
        }
      }

      this.logger.log(`[DEVICE STATUS CHECK] Completed - ${offlineCount} devices set to offline`);

    } catch (error) {
      // DB 연결 에러인 경우 재시도
      if (error.code === 'ECONNRESET' || error.errno === -54) {
        if (currentAttempt < maxRetries) {
          this.logger.warn(`[DEVICE STATUS CHECK] DB connection error, retrying... (${currentAttempt}/${maxRetries})`);
          // 1초 대기 후 재시도
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.checkDeviceStatusWithRetry(maxRetries, currentAttempt + 1);
        } else {
          this.logger.error(`[DEVICE STATUS CHECK ERROR] Max retries reached (${maxRetries}). Giving up.`);
        }
      }

      this.logger.error(`[DEVICE STATUS CHECK ERROR] ${error.message}`);
      this.logger.error(error.stack);
    }
  }

  /**
   * 재시도 로직이 포함된 수액 데이터 타임아웃 체크
   *
   * @param maxRetries - 최대 재시도 횟수
   * @param currentAttempt - 현재 시도 횟수
   */
  private async checkInfusionDataTimeoutWithRetry(maxRetries: number, currentAttempt: number = 1) {
    try {
      this.logger.log('[INFUSION TIMEOUT CHECK] Starting infusion data timeout check...');

      const assignmentRepository = this.dataSource.getRepository(PatientBedAssignment);
      const deviceRepository = this.dataSource.getRepository(Device);
      const logRepository = this.dataSource.getRepository(InfusionRawLog);

      // 1. released_at이 null인 active assignment 조회 (device_id가 있는 것)
      const activeAssignments = await assignmentRepository
        .createQueryBuilder('assignment')
        .leftJoinAndSelect('assignment.device', 'device')
        .leftJoinAndSelect('assignment.bed', 'bed')
        .where('assignment.released_at IS NULL')
        .andWhere('assignment.device_id IS NOT NULL')
        .getMany();

      if (activeAssignments.length === 0) {
        this.logger.log('[INFUSION TIMEOUT CHECK] No active assignments found');
        return;
      }

      this.logger.log(`[INFUSION TIMEOUT CHECK] Found ${activeAssignments.length} active assignments`);

      // 타임아웃 기준 시간 계산 (.env에서 설정한 값 사용)
      const timeoutDate = new Date();
      timeoutDate.setSeconds(timeoutDate.getSeconds() - this.timeoutSeconds);

      let stopCount = 0;

      // 2. 각 assignment별로 최근 데이터 확인
      for (const assignment of activeAssignments) {
        if (!assignment.device_id) {
          continue;
        }

        // device 조회
        const device = await deviceRepository.findOne({
          where: { id: assignment.device_id }
        });

        if (!device) {
          this.logger.warn(`[INFUSION TIMEOUT CHECK] Device not found for assignment ${assignment.id}`);
          continue;
        }

        // 해당 디바이스의 타임아웃 시간 내 로그 조회
        const recentLog = await logRepository
          .createQueryBuilder('log')
          .where('log.sn = :sn', { sn: device.serial_number })
          .andWhere('log.created_at >= :timeoutDate', { timeoutDate })
          .orderBy('log.created_at', 'DESC')
          .limit(1)
          .getOne();

        // 기기 연결 후 2분 이내에는 알림 생성하지 않음
        if (assignment.assigned_at) {
          const assignedAt = new Date(assignment.assigned_at);
          const nowTime = new Date();
          const timeDiffMinutes = (nowTime.getTime() - assignedAt.getTime()) / (1000 * 60);
          if (timeDiffMinutes < 2) {
            this.logger.log(`[INFUSION TIMEOUT CHECK] Skipping assignment ${assignment.id} - less than 2 minutes since assigned_at (${timeDiffMinutes.toFixed(1)} min)`);
            continue;
          }
        }

        // 3. 타임아웃 시간 내 데이터가 없으면 disconnected 처리
        if (!recentLog) {
          const alreadyDisconnected = assignment.alert_type === 'disconnected';

          if (!alreadyDisconnected) {
            // 최초 disconnected: DB 업데이트 + MQTT 발송
            await assignmentRepository.update(assignment.id, {
              alert_type: 'disconnected'
            });
            stopCount++;
            this.logger.log(`[INFUSION TIMEOUT CHECK] Assignment ${assignment.id} set to DISCONNECTED - No data in last ${this.timeoutSeconds} seconds (device SN: ${device.serial_number})`);
          } else {
            this.logger.log(`[INFUSION TIMEOUT CHECK] Assignment ${assignment.id} still DISCONNECTED, re-sending MQTT (device SN: ${device.serial_number})`);
          }

          // MQTT 발송 (최초든 지속이든 항상 발송)
          const topic = `bed/${assignment.bed_id}/assignment/update`;
          const payload = {
            bed_id: assignment.bed_id,
            assignment_id: assignment.id,
            patient_id: assignment.patient_id,
            alert_type: 'disconnected',
            updated_at: new Date().toISOString()
          };

          this.mqttService.publishMessage(topic, payload);
          this.logger.log(`[INFUSION TIMEOUT CHECK] Published MQTT to ${topic}, alert_type: disconnected`);
        }
      }

      this.logger.log(`[INFUSION TIMEOUT CHECK] Completed - ${stopCount} assignments set to disconnected`);

    } catch (error) {
      // DB 연결 에러인 경우 재시도
      if (error.code === 'ECONNRESET' || error.errno === -54) {
        if (currentAttempt < maxRetries) {
          this.logger.warn(`[INFUSION TIMEOUT CHECK] DB connection error, retrying... (${currentAttempt}/${maxRetries})`);
          // 1초 대기 후 재시도
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.checkInfusionDataTimeoutWithRetry(maxRetries, currentAttempt + 1);
        } else {
          this.logger.error(`[INFUSION TIMEOUT CHECK ERROR] Max retries reached (${maxRetries}). Giving up.`);
        }
      }

      this.logger.error(`[INFUSION TIMEOUT CHECK ERROR] ${error.message}`);
      this.logger.error(error.stack);
    }
  }

  /**
   * infusion_cchr 자동 보정 스케줄러
   *
   * 매 1분마다 실행되어 다음 작업을 수행:
   * 1. released_at이 null인 진행 중 assignment 조회
   * 2. infusion_cchr가 정확히 0.00인 항목만 대상
   * 3. assigned_at으로부터 5분 이상 경과한 경우에만 처리
   *    (5분 미만인 경우 데이터 수집 대기)
   * 4. assigned_at 이후의 실제 측정된 cchr 값을 최대 20개까지 수집
   *    (15초 간격으로 데이터 삽입 → 20개 = 5분 분량)
   * 5. 수집된 cchr 값들의 평균을 계산하여 infusion_cchr 업데이트
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async updateMissingInfusionCchr() {
    await this.updateMissingInfusionCchrWithRetry(3);
  }

  /**
   * 재시도 로직이 포함된 infusion_cchr 보정
   *
   * @param maxRetries - 최대 재시도 횟수
   * @param currentAttempt - 현재 시도 횟수
   */
  private async updateMissingInfusionCchrWithRetry(maxRetries: number, currentAttempt: number = 1) {
    try {
      this.logger.log('[CCHR UPDATE] Starting infusion_cchr update check...');

      const assignmentRepository = this.dataSource.getRepository(PatientBedAssignment);
      const deviceRepository = this.dataSource.getRepository(Device);
      const logRepository = this.dataSource.getRepository(InfusionRawLog);

      // 1. released_at이 null이고 infusion_cchr가 정확히 0.00인 assignment 조회
      const targetAssignments = await assignmentRepository
        .createQueryBuilder('assignment')
        .where('assignment.released_at IS NULL')
        .andWhere('assignment.infusion_cchr = 0.00')
        .andWhere('assignment.device_id IS NOT NULL')
        .andWhere('assignment.assigned_at IS NOT NULL')
        .getMany();

      if (targetAssignments.length === 0) {
        this.logger.log('[CCHR UPDATE] No assignments found with infusion_cchr = 0.00');
        return;
      }

      this.logger.log(`[CCHR UPDATE] Found ${targetAssignments.length} assignments with infusion_cchr = 0.00`);

      let updateCount = 0;

      // 2. 각 assignment 처리
      for (const assignment of targetAssignments) {
        // device 조회
        const device = await deviceRepository.findOne({
          where: { id: assignment.device_id }
        });

        if (!device) {
          this.logger.warn(`[CCHR UPDATE] Device not found for assignment ${assignment.id}`);
          continue;
        }

        // assigned_at 이후의 cchr 데이터를 최대 20개 조회 (15초 간격 × 20 = 5분)
        const assignedAt = new Date(assignment.assigned_at);
        const now = new Date();
        const timeDiffMinutes = (now.getTime() - assignedAt.getTime()) / (1000 * 60);

        this.logger.log(`[CCHR UPDATE] Processing Assignment ${assignment.id}:`);
        this.logger.log(`  - device_id: ${assignment.device_id}`);
        this.logger.log(`  - serial_number: ${device.serial_number}`);
        this.logger.log(`  - assigned_at: ${assignedAt.toISOString()}`);
        this.logger.log(`  - time elapsed: ${timeDiffMinutes.toFixed(1)} minutes`);

        // 2분이 지나지 않았으면 스킵 (데이터 수집 대기)
        if (timeDiffMinutes < 2) {
          this.logger.log(`[CCHR UPDATE] Assignment ${assignment.id} - Waiting for 2 minutes to collect data (${timeDiffMinutes.toFixed(1)}/2.0 minutes)`);
          continue;
        }

        // assigned_at 이후의 cchr 데이터를 시간순으로 최대 20개 조회
        const cchrLogs = await logRepository
          .createQueryBuilder('log')
          .select('log.cchr')
          .where('log.sn = :sn', { sn: device.serial_number })
          .andWhere('log.created_at >= :assignedAt', { assignedAt })
          .andWhere('log.cchr IS NOT NULL')
          .andWhere('log.cchr > 0')
          .orderBy('log.created_at', 'ASC')
          .limit(20)
          .getMany();

        this.logger.log(`  - found ${cchrLogs.length} cchr records`);

        if (cchrLogs.length === 0) {
          this.logger.log(`[CCHR UPDATE] Assignment ${assignment.id} - No valid cchr data found in first 5 minutes`);
          continue;
        }

        // cchr 평균 계산
        const cchrSum = cchrLogs.reduce((sum, log) => {
          const cchrValue = Number(log.cchr);
          return sum + (isNaN(cchrValue) ? 0 : cchrValue);
        }, 0);
        const cchrAverage = cchrSum / cchrLogs.length;

        // NaN 체크 및 로깅
        if (isNaN(cchrAverage) || !isFinite(cchrAverage)) {
          this.logger.error(`[CCHR UPDATE] Assignment ${assignment.id} - Invalid cchr average: ${cchrAverage}`);
          continue;
        }

        // infusion_cchr 업데이트 (소수점 2자리로 반올림)
        const roundedCchr = Math.round(cchrAverage * 100) / 100;

        this.logger.log(`[CCHR UPDATE] Assignment ${assignment.id} - Calculated cchr average: ${roundedCchr} (from ${cchrLogs.length} samples)`);

        await assignmentRepository.update(assignment.id, {
          infusion_cchr: roundedCchr
        });

        updateCount++;
        this.logger.log(`[CCHR UPDATE] Assignment ${assignment.id} updated - infusion_cchr: 0.00 → ${roundedCchr} (calculated from ${cchrLogs.length} samples)`);
      }

      this.logger.log(`[CCHR UPDATE] Completed - ${updateCount} assignments updated`);

    } catch (error) {
      // DB 연결 에러인 경우 재시도
      if (error.code === 'ECONNRESET' || error.errno === -54) {
        if (currentAttempt < maxRetries) {
          this.logger.warn(`[CCHR UPDATE] DB connection error, retrying... (${currentAttempt}/${maxRetries})`);
          // 1초 대기 후 재시도
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.updateMissingInfusionCchrWithRetry(maxRetries, currentAttempt + 1);
        } else {
          this.logger.error(`[CCHR UPDATE ERROR] Max retries reached (${maxRetries}). Giving up.`);
        }
      }

      this.logger.error(`[CCHR UPDATE ERROR] ${error.message}`);
      this.logger.error(error.stack);
    }
  }
}
