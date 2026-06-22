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
const wardTypes = [
    ['내과병동', '외과병동', '산부인과병동', '소아과병동'],
    ['심장내과병동', '정형외과병동', '신경과병동', '응급의학과병동'],
    ['중환자실', '일반병동A', '일반병동B', '특실병동'],
    ['호흡기내과병동', '소화기내과병동', '비뇨기과병동', '이비인후과병동'],
    ['재활의학과병동', '정신건강의학과병동', '안과병동', '피부과병동'],
    ['종양내과병동', '혈액내과병동', '감염내과병동', '류마티스내과병동'],
    ['신경외과병동', '흉부외과병동', '성형외과병동', '구강외과병동'],
    ['신장내과병동', '내분비내과병동', '가정의학과병동', '통증의학과병동'],
    ['응급실', '수술실', '회복실', '분만실'],
    ['간호간병통합병동', '완화의료병동', '재활병동', '격리병동'],
    ['VIP병동', '국제진료병동', '소아중환자실', '신생아중환자실']
];
async function seed() {
    try {
        await AppDataSource.initialize();
        console.log('데이터베이스 연결 성공');
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        const hospitals = await queryRunner.query('SELECT id, name FROM hospitals ORDER BY id');
        console.log(`총 ${hospitals.length}개 병원 발견`);
        const existingWards = await queryRunner.query('SELECT * FROM wards');
        console.log(`기존 병동 데이터: ${existingWards.length}개`);
        let wardTypeIndex = 0;
        let totalAdded = 0;
        for (const hospital of hospitals) {
            console.log(`\n${hospital.name} (ID: ${hospital.id}) 처리 중...`);
            const hospitalWards = await queryRunner.query('SELECT * FROM wards WHERE hospital_id = ?', [hospital.id]);
            if (hospitalWards.length >= 4) {
                console.log(`  이미 ${hospitalWards.length}개의 병동이 존재합니다. 건너뜁니다.`);
                continue;
            }
            const wardsToAdd = wardTypes[wardTypeIndex % wardTypes.length];
            wardTypeIndex++;
            for (let i = 0; i < 4; i++) {
                const wardName = wardsToAdd[i];
                const existing = await queryRunner.query('SELECT * FROM wards WHERE hospital_id = ? AND name = ?', [hospital.id, wardName]);
                if (existing.length === 0) {
                    await queryRunner.query('INSERT INTO wards (hospital_id, name, created_at, udpated_at) VALUES (?, ?, NOW(), NOW())', [hospital.id, wardName]);
                    console.log(`  병동 추가됨: ${wardName}`);
                    totalAdded++;
                }
                else {
                    console.log(`  이미 존재하는 병동: ${wardName}`);
                }
            }
        }
        console.log(`\n총 ${totalAdded}개의 새로운 병동이 추가되었습니다.`);
        const finalWards = await queryRunner.query(`
      SELECT h.name as hospital_name, COUNT(w.id) as ward_count
      FROM hospitals h
      LEFT JOIN wards w ON h.id = w.hospital_id
      GROUP BY h.id, h.name
      ORDER BY h.id
    `);
        console.log('\n병원별 병동 현황:');
        finalWards.forEach((row) => {
            console.log(`  ${row.hospital_name}: ${row.ward_count}개 병동`);
        });
        const sampleWards = await queryRunner.query(`
      SELECT w.id, w.name as ward_name, h.name as hospital_name
      FROM wards w
      JOIN hospitals h ON w.hospital_id = h.id
      ORDER BY h.id, w.id
      LIMIT 20
    `);
        console.log('\n병동 목록 (처음 20개):');
        sampleWards.forEach((ward) => {
            console.log(`  [ID: ${ward.id}] ${ward.hospital_name} - ${ward.ward_name}`);
        });
        const totalWardsCount = await queryRunner.query('SELECT COUNT(*) as count FROM wards');
        console.log(`\n전체 병동 수: ${totalWardsCount[0].count}개`);
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
//# sourceMappingURL=seed-wards.js.map