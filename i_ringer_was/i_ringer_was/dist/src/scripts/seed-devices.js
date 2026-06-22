"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const dotenv = require("dotenv");
dotenv.config();
const AppDataSource = new typeorm_1.DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [],
    synchronize: false,
    logging: true,
});
function generateRandomCode(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
const usedSerialNumbers = new Set();
function generateUniqueSerialNumber() {
    let serial;
    do {
        serial = `iringer-${generateRandomCode(4)}`;
    } while (usedSerialNumbers.has(serial));
    usedSerialNumbers.add(serial);
    return serial;
}
function generateBatteryPercent() {
    return Math.floor(Math.random() * 91) + 10;
}
function generateNetworkStatus() {
    const rand = Math.random();
    if (rand < 0.8)
        return 'online';
    else if (rand < 0.95)
        return 'offline';
    else
        return 'unknown';
}
function generateFirmwareVersion() {
    const major = Math.floor(Math.random() * 3) + 1;
    const minor = Math.floor(Math.random() * 10);
    const patch = Math.floor(Math.random() * 10);
    return `${major}.${minor}.${patch}`;
}
function generateLastUpdateTime() {
    const now = new Date();
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);
    const updateTime = new Date(now);
    updateTime.setDate(updateTime.getDate() - daysAgo);
    updateTime.setHours(updateTime.getHours() - hoursAgo);
    updateTime.setMinutes(updateTime.getMinutes() - minutesAgo);
    return updateTime;
}
function generateDeviceName(index, location) {
    const prefixes = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'];
    const prefix = prefixes[index % prefixes.length];
    return `${prefix}-${location}`;
}
async function seed() {
    try {
        await AppDataSource.initialize();
        console.log('데이터베이스 연결 성공');
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        const existingDevices = await queryRunner.query('SELECT COUNT(*) as count FROM devices');
        console.log(`기존 디바이스 데이터: ${existingDevices[0].count}개`);
        const hospitals = await queryRunner.query(`
      SELECT DISTINCT h.id, h.name 
      FROM hospitals h
      JOIN wards w ON h.id = w.hospital_id
      JOIN rooms r ON w.id = r.ward_id
      ORDER BY h.id
    `);
        let totalAdded = 0;
        let deviceIndex = 0;
        for (const hospital of hospitals) {
            const deviceCount = Math.floor(Math.random() * 6) + 5;
            console.log(`\n${hospital.name} (ID: ${hospital.id}): ${deviceCount}개 디바이스 생성 예정`);
            for (let i = 0; i < deviceCount; i++) {
                const serialNumber = generateUniqueSerialNumber();
                const deviceName = generateDeviceName(deviceIndex++, hospital.name.substring(0, 3));
                const networkStatus = generateNetworkStatus();
                const batteryPercent = generateBatteryPercent();
                const firmwareVersion = generateFirmwareVersion();
                const lastUpdateAt = generateLastUpdateTime();
                try {
                    await queryRunner.query(`INSERT INTO devices (
              device_name, 
              serial_number, 
              network_status, 
              battery_percent, 
              last_udpate_at, 
              firmware_version, 
              created_at, 
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`, [
                        deviceName,
                        serialNumber,
                        networkStatus,
                        batteryPercent,
                        lastUpdateAt,
                        firmwareVersion
                    ]);
                    console.log(`  디바이스 추가됨: ${serialNumber} (${deviceName}) - 배터리: ${batteryPercent}%, 상태: ${networkStatus}, FW: ${firmwareVersion}`);
                    totalAdded++;
                }
                catch (error) {
                    console.log(`  디바이스 추가 실패: ${serialNumber} - ${error.message}`);
                }
            }
        }
        console.log(`\n총 ${totalAdded}개의 새로운 디바이스가 추가되었습니다.`);
        const deviceStats = await queryRunner.query(`
      SELECT 
        network_status,
        COUNT(*) as count,
        AVG(battery_percent) as avg_battery
      FROM devices
      GROUP BY network_status
    `);
        console.log('\n네트워크 상태별 디바이스 현황:');
        deviceStats.forEach((stat) => {
            console.log(`  ${stat.network_status}: ${stat.count}개 (평균 배터리: ${Math.round(stat.avg_battery)}%)`);
        });
        const firmwareStats = await queryRunner.query(`
      SELECT 
        firmware_version,
        COUNT(*) as count
      FROM devices
      GROUP BY firmware_version
      ORDER BY firmware_version DESC
      LIMIT 10
    `);
        console.log('\n펌웨어 버전 분포 (상위 10개):');
        firmwareStats.forEach((stat) => {
            console.log(`  v${stat.firmware_version}: ${stat.count}개`);
        });
        const batteryStats = await queryRunner.query(`
      SELECT 
        CASE 
          WHEN battery_percent < 20 THEN '낮음 (< 20%)'
          WHEN battery_percent < 50 THEN '보통 (20-50%)'
          WHEN battery_percent < 80 THEN '양호 (50-80%)'
          ELSE '우수 (80%+)'
        END as battery_status,
        COUNT(*) as count
      FROM devices
      GROUP BY battery_status
      ORDER BY 
        CASE battery_status
          WHEN '낮음 (< 20%)' THEN 1
          WHEN '보통 (20-50%)' THEN 2
          WHEN '양호 (50-80%)' THEN 3
          WHEN '우수 (80%+)' THEN 4
        END
    `);
        console.log('\n배터리 상태 분포:');
        batteryStats.forEach((stat) => {
            console.log(`  ${stat.battery_status}: ${stat.count}개`);
        });
        const sampleDevices = await queryRunner.query(`
      SELECT 
        id,
        device_name,
        serial_number,
        network_status,
        battery_percent,
        firmware_version,
        last_udpate_at
      FROM devices
      ORDER BY id DESC
      LIMIT 10
    `);
        console.log('\n최근 추가된 디바이스 (10개):');
        sampleDevices.forEach((device) => {
            const lastUpdate = device.last_udpate_at ?
                new Date(device.last_udpate_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) :
                'N/A';
            console.log(`  [ID: ${device.id}] ${device.serial_number} (${device.device_name})`);
            console.log(`    상태: ${device.network_status}, 배터리: ${device.battery_percent}%, FW: v${device.firmware_version}`);
            console.log(`    최종 업데이트: ${lastUpdate}`);
        });
        const finalCount = await queryRunner.query('SELECT COUNT(*) as count FROM devices');
        console.log(`\n전체 디바이스 수: ${finalCount[0].count}개`);
        await queryRunner.release();
    }
    catch (error) {
        console.error('에러 발생:', error);
    }
    finally {
        await AppDataSource.destroy();
    }
}
seed();
//# sourceMappingURL=seed-devices.js.map