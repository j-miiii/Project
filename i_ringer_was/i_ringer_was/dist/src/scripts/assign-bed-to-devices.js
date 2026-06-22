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
async function assignBedToDevices() {
    try {
        await AppDataSource.initialize();
        console.log('데이터베이스 연결 성공');
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        const availableBeds = await queryRunner.query(`
      SELECT b.id, b.bed_number, r.name as room_name, w.name as ward_name, h.name as hospital_name
      FROM beds b
      JOIN rooms r ON b.room_id = r.id
      JOIN wards w ON r.ward_id = w.id
      JOIN hospitals h ON w.hospital_id = h.id
      WHERE b.status = 'available'
      ORDER BY RAND()
    `);
        console.log(`사용 가능한 침상 수: ${availableBeds.length}개`);
        const devicesWithoutBed = await queryRunner.query(`
      SELECT id, device_name, serial_number
      FROM devices
      WHERE bed_id IS NULL
      ORDER BY id
    `);
        console.log(`bed_id가 없는 디바이스 수: ${devicesWithoutBed.length}개`);
        const assignmentCount = Math.min(availableBeds.length, devicesWithoutBed.length);
        let assignedCount = 0;
        for (let i = 0; i < assignmentCount && i < 20; i++) {
            const device = devicesWithoutBed[i];
            const bed = availableBeds[i];
            try {
                await queryRunner.query('UPDATE devices SET bed_id = ? WHERE id = ?', [bed.id, device.id]);
                await queryRunner.query('UPDATE beds SET status = ? WHERE id = ?', ['occupied', bed.id]);
                console.log(`✅ 디바이스 ${device.serial_number} → ${bed.hospital_name} ${bed.ward_name} ${bed.room_name} ${bed.bed_number}번 침상`);
                assignedCount++;
            }
            catch (error) {
                console.error(`❌ 할당 실패 디바이스 ID ${device.id}:`, error.message);
            }
        }
        console.log(`\n총 ${assignedCount}개 디바이스에 침상을 할당했습니다.`);
        const deviceStats = await queryRunner.query(`
      SELECT 
        COUNT(*) as total_devices,
        COUNT(bed_id) as devices_with_bed,
        COUNT(CASE WHEN bed_id IS NULL THEN 1 END) as devices_without_bed
      FROM devices
    `);
        console.log('\n디바이스 침상 할당 현황:');
        console.log(`  전체 디바이스: ${deviceStats[0].total_devices}개`);
        console.log(`  침상 할당됨: ${deviceStats[0].devices_with_bed}개`);
        console.log(`  침상 미할당: ${deviceStats[0].devices_without_bed}개`);
        const sampleDevices = await queryRunner.query(`
      SELECT 
        d.id,
        d.serial_number,
        d.device_name,
        d.bed_id,
        b.bed_number,
        r.name as room_name,
        w.name as ward_name,
        h.name as hospital_name
      FROM devices d
      LEFT JOIN beds b ON d.bed_id = b.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN wards w ON r.ward_id = w.id
      LEFT JOIN hospitals h ON w.hospital_id = h.id
      WHERE d.bed_id IS NOT NULL
      ORDER BY d.id DESC
      LIMIT 10
    `);
        console.log('\n최근 할당된 디바이스 샘플 (10개):');
        sampleDevices.forEach(device => {
            console.log(`  [${device.serial_number}] ${device.hospital_name} - ${device.ward_name} - ${device.room_name} - ${device.bed_number}번 침상`);
        });
        await queryRunner.release();
    }
    catch (error) {
        console.error('에러 발생:', error);
    }
    finally {
        await AppDataSource.destroy();
    }
}
assignBedToDevices();
//# sourceMappingURL=assign-bed-to-devices.js.map