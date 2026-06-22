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

const hospitalData = [
  { name: '서울대학교병원' },
  { name: '삼성서울병원' },
  { name: '서울아산병원' },
  { name: '연세대학교 세브란스병원' },
  { name: '가톨릭대학교 서울성모병원' },
  { name: '서울특별시 보라매병원' },
  { name: '고려대학교 안암병원' },
  { name: '이화여자대학교 목동병원' },
  { name: '한양대학교병원' },
  { name: '경희대학교병원' }
];

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log('데이터베이스 연결 성공');

    // 직접 SQL 쿼리로 데이터 삽입
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    // 기존 병원 데이터 확인
    const existingHospitals = await queryRunner.query('SELECT * FROM hospitals');
    console.log(`기존 병원 데이터: ${existingHospitals.length}개`);

    // 새로운 병원 데이터 삽입
    for (const data of hospitalData) {
      const existing = await queryRunner.query(
        'SELECT * FROM hospitals WHERE name = ?',
        [data.name]
      );
      
      if (existing.length === 0) {
        await queryRunner.query(
          'INSERT INTO hospitals (name, created_at, udpated_at) VALUES (?, NOW(), NOW())',
          [data.name]
        );
        console.log(`병원 추가됨: ${data.name}`);
      } else {
        console.log(`이미 존재하는 병원: ${data.name}`);
      }
    }

    console.log('병원 더미 데이터 생성 완료');
    
    // 최종 병원 목록 출력
    const allHospitals = await queryRunner.query('SELECT * FROM hospitals ORDER BY id');
    console.log('\n전체 병원 목록:');
    allHospitals.forEach((hospital, index) => {
      console.log(`${index + 1}. [ID: ${hospital.id}] ${hospital.name}`);
    });

    await queryRunner.release();

  } catch (error) {
    console.error('에러 발생:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

seed();