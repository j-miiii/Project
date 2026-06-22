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

async function renameNameToNickname() {
  try {
    await AppDataSource.initialize();
    console.log('데이터베이스 연결 성공');

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    // 먼저 컬럼이 존재하는지 확인
    const nameColumn = await queryRunner.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'name'
    `, [process.env.DB_DATABASE]);

    const nicknameColumn = await queryRunner.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'nickname'
    `, [process.env.DB_DATABASE]);

    if (nameColumn.length > 0 && nicknameColumn.length === 0) {
      console.log('name 컬럼을 nickname으로 변경합니다...');
      
      try {
        // 컬럼명 변경
        await queryRunner.query(`
          ALTER TABLE users 
          CHANGE COLUMN name nickname VARCHAR(100) NOT NULL
        `);
        console.log('✅ name 컬럼이 nickname으로 성공적으로 변경되었습니다.');
      } catch (error) {
        console.error('❌ 컬럼명 변경 실패:', error.message);
      }
    } else if (nicknameColumn.length > 0) {
      console.log('nickname 컬럼이 이미 존재합니다.');
    } else {
      console.log('name 컬럼이 존재하지 않습니다.');
    }

    // 변경 후 테이블 구조 확인
    const tableStructure = await queryRunner.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'users'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_DATABASE]);

    console.log('\n현재 users 테이블 구조:');
    console.log('================================');
    tableStructure.forEach(column => {
      console.log(`${column.COLUMN_NAME}: ${column.COLUMN_TYPE} ${column.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    await queryRunner.release();

  } catch (error) {
    console.error('에러 발생:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

renameNameToNickname();