import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
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

// 병실 번호 생성 함수
function generateRoomNumbers(wardName: string, count: number, startIndex: number): string[] {
  const rooms: string[] = [];
  const prefix = getWardPrefix(wardName);
  
  for (let i = 0; i < count; i++) {
    const roomNumber = `${prefix}${(startIndex + i + 101).toString()}`;
    rooms.push(roomNumber);
  }
  
  return rooms;
}

// 병동별 접두사 생성
function getWardPrefix(wardName: string): string {
  const prefixMap: { [key: string]: string } = {
    '내과병동': 'IM',
    '외과병동': 'GS',
    '산부인과병동': 'OB',
    '소아과병동': 'PD',
    '심장내과병동': 'CD',
    '정형외과병동': 'OS',
    '신경과병동': 'NR',
    '응급의학과병동': 'EM',
    '중환자실': 'ICU',
    '일반병동A': 'GA',
    '일반병동B': 'GB',
    '특실병동': 'VIP',
    '호흡기내과병동': 'PL',
    '소화기내과병동': 'GI',
    '비뇨기과병동': 'UR',
    '이비인후과병동': 'ENT',
    '재활의학과병동': 'RM',
    '정신건강의학과병동': 'PS',
    '안과병동': 'OP',
    '피부과병동': 'DM',
    '종양내과병동': 'ON',
    '혈액내과병동': 'HM',
    '감염내과병동': 'ID',
    '류마티스내과병동': 'RH',
    '신경외과병동': 'NS',
    '흉부외과병동': 'CS',
    '성형외과병동': 'PRS',
    '구강외과병동': 'OS2',
    '신장내과병동': 'NP',
    '내분비내과병동': 'EN',
    '가정의학과병동': 'FM',
    '통증의학과병동': 'PM',
    '응급실': 'ER',
    '수술실': 'OR',
    '회복실': 'RR',
    '분만실': 'DR',
    '간호간병통합병동': 'CN',
    '완화의료병동': 'PC',
    '재활병동': 'RH2',
    '격리병동': 'ISO',
    'VIP병동': 'VIP2',
    '국제진료병동': 'INT',
    '소아중환자실': 'PICU',
    '신생아중환자실': 'NICU'
  };

  // 매핑이 없으면 병동명 첫 글자들로 생성
  if (!prefixMap[wardName]) {
    const chars = wardName.replace(/병동|실/g, '').substring(0, 2);
    return chars.toUpperCase();
  }

  return prefixMap[wardName];
}

// 랜덤 숫자 생성 (min ~ max 사이)
function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log('데이터베이스 연결 성공');

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    // 모든 병동 가져오기
    const wards = await queryRunner.query(`
      SELECT w.id, w.name as ward_name, h.name as hospital_name
      FROM wards w
      JOIN hospitals h ON w.hospital_id = h.id
      ORDER BY w.id
    `);
    console.log(`총 ${wards.length}개 병동 발견`);

    // 기존 병실 데이터 확인
    const existingRooms = await queryRunner.query('SELECT COUNT(*) as count FROM rooms');
    console.log(`기존 병실 데이터: ${existingRooms[0].count}개`);

    let totalAdded = 0;
    let roomStartIndex = 0;

    // 각 병동별로 병실 추가
    for (const ward of wards) {
      const roomCount = getRandomNumber(1, 5); // 1~5개 병실
      console.log(`\n${ward.hospital_name} - ${ward.ward_name} (ID: ${ward.id}): ${roomCount}개 병실 생성`);

      // 해당 병동의 기존 병실 확인
      const existingWardRooms = await queryRunner.query(
        'SELECT * FROM rooms WHERE ward_id = ?',
        [ward.id]
      );

      if (existingWardRooms.length > 0) {
        console.log(`  이미 ${existingWardRooms.length}개의 병실이 존재합니다. 건너뜁니다.`);
        continue;
      }

      // 병실 이름 생성
      const roomNames = generateRoomNumbers(ward.ward_name, roomCount, roomStartIndex);
      roomStartIndex += roomCount; // 다음 병동을 위해 인덱스 증가

      // 병실 추가
      for (let i = 0; i < roomCount; i++) {
        const bedCount = getRandomNumber(2, 5); // 2~5개 병상
        const roomName = roomNames[i];

        try {
          await queryRunner.query(
            'INSERT INTO rooms (ward_id, name, bed_count, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            [ward.id, roomName, bedCount]
          );
          console.log(`  병실 추가됨: ${roomName} (병상 수: ${bedCount})`);
          totalAdded++;
        } catch (error) {
          console.log(`  병실 추가 실패: ${roomName} - ${error.message}`);
        }
      }
    }

    console.log(`\n총 ${totalAdded}개의 새로운 병실이 추가되었습니다.`);

    // 병동별 병실 통계 출력
    const roomStats = await queryRunner.query(`
      SELECT 
        h.name as hospital_name,
        w.name as ward_name, 
        COUNT(r.id) as room_count,
        SUM(r.bed_count) as total_beds
      FROM hospitals h
      JOIN wards w ON h.id = w.hospital_id
      LEFT JOIN rooms r ON w.id = r.ward_id
      GROUP BY h.id, h.name, w.id, w.name
      ORDER BY h.id, w.id
    `);
    
    console.log('\n병동별 병실 현황:');
    let currentHospital = '';
    roomStats.forEach((row) => {
      if (currentHospital !== row.hospital_name) {
        console.log(`\n[${row.hospital_name}]`);
        currentHospital = row.hospital_name;
      }
      console.log(`  ${row.ward_name}: ${row.room_count || 0}개 병실, ${row.total_beds || 0}개 병상`);
    });

    // 전체 병실 통계
    const totalStats = await queryRunner.query(`
      SELECT 
        COUNT(*) as total_rooms,
        SUM(bed_count) as total_beds,
        AVG(bed_count) as avg_beds_per_room
      FROM rooms
    `);
    
    console.log('\n전체 통계:');
    console.log(`  총 병실 수: ${totalStats[0].total_rooms}개`);
    console.log(`  총 병상 수: ${totalStats[0].total_beds}개`);
    console.log(`  병실당 평균 병상: ${parseFloat(totalStats[0].avg_beds_per_room).toFixed(1)}개`);

    // 샘플 데이터 출력
    const sampleRooms = await queryRunner.query(`
      SELECT 
        r.id,
        r.name as room_name,
        r.bed_count,
        w.name as ward_name,
        h.name as hospital_name
      FROM rooms r
      JOIN wards w ON r.ward_id = w.id
      JOIN hospitals h ON w.hospital_id = h.id
      ORDER BY r.id DESC
      LIMIT 20
    `);
    
    console.log('\n최근 추가된 병실 (20개):');
    sampleRooms.forEach((room) => {
      console.log(`  [ID: ${room.id}] ${room.room_name} - ${room.hospital_name} ${room.ward_name} (병상: ${room.bed_count}개)`);
    });

    await queryRunner.release();

  } catch (error) {
    console.error('에러 발생:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

seed();