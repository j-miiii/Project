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
function getRandomStatus() {
    const rand = Math.random();
    if (rand < 0.70)
        return 'available';
    else if (rand < 0.95)
        return 'occupied';
    else
        return 'maintenance';
}
async function seed() {
    try {
        await AppDataSource.initialize();
        console.log('데이터베이스 연결 성공');
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        const rooms = await queryRunner.query(`
      SELECT 
        r.id as room_id,
        r.name as room_name,
        r.bed_count,
        w.name as ward_name,
        h.name as hospital_name
      FROM rooms r
      JOIN wards w ON r.ward_id = w.id
      JOIN hospitals h ON w.hospital_id = h.id
      ORDER BY r.id
    `);
        console.log(`총 ${rooms.length}개 병실 발견`);
        const existingBeds = await queryRunner.query('SELECT COUNT(*) as count FROM beds');
        console.log(`기존 침상 데이터: ${existingBeds[0].count}개`);
        let totalAdded = 0;
        let statusCount = {
            available: 0,
            occupied: 0,
            maintenance: 0
        };
        for (const room of rooms) {
            console.log(`\n${room.hospital_name} - ${room.ward_name} - ${room.room_name}: ${room.bed_count}개 침상 생성`);
            const existingRoomBeds = await queryRunner.query('SELECT * FROM beds WHERE room_id = ?', [room.room_id]);
            if (existingRoomBeds.length > 0) {
                console.log(`  이미 ${existingRoomBeds.length}개의 침상이 존재합니다. 건너뜁니다.`);
                continue;
            }
            for (let i = 1; i <= room.bed_count; i++) {
                const bedNumber = i.toString();
                const status = getRandomStatus();
                try {
                    await queryRunner.query('INSERT INTO beds (room_id, bed_number, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [room.room_id, bedNumber, status]);
                    console.log(`  침상 추가됨: ${room.room_name}-${bedNumber} (상태: ${status})`);
                    totalAdded++;
                    statusCount[status]++;
                }
                catch (error) {
                    console.log(`  침상 추가 실패: ${room.room_name}-${bedNumber} - ${error.message}`);
                }
            }
        }
        console.log(`\n총 ${totalAdded}개의 새로운 침상이 추가되었습니다.`);
        console.log('\n침상 상태별 통계:');
        console.log(`  사용 가능(available): ${statusCount.available}개`);
        console.log(`  사용 중(occupied): ${statusCount.occupied}개`);
        console.log(`  유지보수(maintenance): ${statusCount.maintenance}개`);
        const totalStats = await queryRunner.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM beds
      GROUP BY status
    `);
        console.log('\n전체 침상 상태 현황:');
        totalStats.forEach((stat) => {
            console.log(`  ${stat.status}: ${stat.count}개`);
        });
        const hospitalStats = await queryRunner.query(`
      SELECT 
        h.name as hospital_name,
        COUNT(b.id) as total_beds,
        SUM(CASE WHEN b.status = 'available' THEN 1 ELSE 0 END) as available_beds,
        SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END) as occupied_beds,
        SUM(CASE WHEN b.status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_beds
      FROM hospitals h
      JOIN wards w ON h.id = w.hospital_id
      JOIN rooms r ON w.id = r.ward_id
      LEFT JOIN beds b ON r.id = b.room_id
      GROUP BY h.id, h.name
      ORDER BY h.id
    `);
        console.log('\n병원별 침상 현황:');
        hospitalStats.forEach((stat) => {
            console.log(`\n${stat.hospital_name}:`);
            console.log(`  전체: ${stat.total_beds}개`);
            console.log(`  사용 가능: ${stat.available_beds}개`);
            console.log(`  사용 중: ${stat.occupied_beds}개`);
            console.log(`  유지보수: ${stat.maintenance_beds}개`);
            const occupancyRate = stat.total_beds > 0 ?
                ((stat.occupied_beds / stat.total_beds) * 100).toFixed(1) : '0.0';
            console.log(`  병상 가동률: ${occupancyRate}%`);
        });
        const sampleBeds = await queryRunner.query(`
      SELECT 
        b.id,
        CONCAT(r.name, '-', b.bed_number) as bed_name,
        b.status,
        w.name as ward_name,
        h.name as hospital_name
      FROM beds b
      JOIN rooms r ON b.room_id = r.id
      JOIN wards w ON r.ward_id = w.id
      JOIN hospitals h ON w.hospital_id = h.id
      ORDER BY b.id DESC
      LIMIT 20
    `);
        console.log('\n최근 추가된 침상 (20개):');
        sampleBeds.forEach((bed) => {
            console.log(`  [ID: ${bed.id}] ${bed.bed_name} - ${bed.hospital_name} ${bed.ward_name} (상태: ${bed.status})`);
        });
        const finalCount = await queryRunner.query('SELECT COUNT(*) as count FROM beds');
        console.log(`\n전체 침상 수: ${finalCount[0].count}개`);
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
//# sourceMappingURL=seed-beds.js.map