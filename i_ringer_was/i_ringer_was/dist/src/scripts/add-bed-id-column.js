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
async function addBedIdColumn() {
    try {
        await AppDataSource.initialize();
        console.log('데이터베이스 연결 성공');
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        const columns = await queryRunner.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'devices' 
      AND COLUMN_NAME = 'bed_id'
    `, [process.env.DB_DATABASE]);
        if (columns.length === 0) {
            console.log('bed_id 컬럼이 존재하지 않습니다. 추가를 시작합니다...');
            try {
                await queryRunner.query('ALTER TABLE devices ADD COLUMN bed_id INT NULL');
                console.log('✅ bed_id 컬럼이 성공적으로 추가되었습니다.');
            }
            catch (error) {
                console.error('❌ bed_id 컬럼 추가 실패:', error.message);
            }
        }
        else {
            console.log('bed_id 컬럼이 이미 존재합니다.');
        }
        const tableStructure = await queryRunner.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'devices'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_DATABASE]);
        console.log('\n현재 devices 테이블 구조:');
        console.log('================================');
        tableStructure.forEach(column => {
            console.log(`${column.COLUMN_NAME}: ${column.COLUMN_TYPE} ${column.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'}`);
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
addBedIdColumn();
//# sourceMappingURL=add-bed-id-column.js.map