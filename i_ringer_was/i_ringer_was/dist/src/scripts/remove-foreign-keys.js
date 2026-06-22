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
async function removeForeignKeys() {
    try {
        await AppDataSource.initialize();
        console.log('데이터베이스 연결 성공');
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        const foreignKeys = await queryRunner.query(`
      SELECT 
        TABLE_NAME,
        CONSTRAINT_NAME,
        REFERENCED_TABLE_NAME
      FROM 
        information_schema.KEY_COLUMN_USAGE
      WHERE 
        TABLE_SCHEMA = ? 
        AND REFERENCED_TABLE_NAME IS NOT NULL
        AND TABLE_NAME IN ('hospitals', 'wards', 'rooms', 'beds')
      ORDER BY 
        TABLE_NAME, CONSTRAINT_NAME
    `, [process.env.DB_DATABASE]);
        console.log(`\n발견된 외래키 제약 조건: ${foreignKeys.length}개`);
        console.log('===================================');
        for (const fk of foreignKeys) {
            console.log(`테이블: ${fk.TABLE_NAME}`);
            console.log(`  제약조건명: ${fk.CONSTRAINT_NAME}`);
            console.log(`  참조테이블: ${fk.REFERENCED_TABLE_NAME}`);
        }
        if (foreignKeys.length === 0) {
            console.log('\nhospitals, wards, rooms, beds 테이블에 외래키 제약 조건이 없습니다.');
        }
        else {
            console.log('\n외래키 제약 조건 제거 시작...');
            console.log('===================================');
            for (const fk of foreignKeys) {
                try {
                    await queryRunner.query(`ALTER TABLE ${fk.TABLE_NAME} DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
                    console.log(`✅ 제거 성공: ${fk.TABLE_NAME}.${fk.CONSTRAINT_NAME}`);
                }
                catch (error) {
                    console.log(`❌ 제거 실패: ${fk.TABLE_NAME}.${fk.CONSTRAINT_NAME} - ${error.message}`);
                }
            }
            const remainingForeignKeys = await queryRunner.query(`
        SELECT 
          TABLE_NAME,
          CONSTRAINT_NAME,
          REFERENCED_TABLE_NAME
        FROM 
          information_schema.KEY_COLUMN_USAGE
        WHERE 
          TABLE_SCHEMA = ? 
          AND REFERENCED_TABLE_NAME IS NOT NULL
          AND TABLE_NAME IN ('hospitals', 'wards', 'rooms', 'beds')
      `, [process.env.DB_DATABASE]);
            console.log(`\n제거 후 남은 외래키 제약 조건: ${remainingForeignKeys.length}개`);
            if (remainingForeignKeys.length === 0) {
                console.log('✅ 모든 외래키 제약 조건이 성공적으로 제거되었습니다.');
            }
            else {
                console.log('⚠️  일부 외래키 제약 조건이 남아 있습니다:');
                for (const fk of remainingForeignKeys) {
                    console.log(`  - ${fk.TABLE_NAME}.${fk.CONSTRAINT_NAME}`);
                }
            }
        }
        console.log('\n다른 테이블에서 hospitals, wards, rooms, beds를 참조하는 외래키 확인...');
        console.log('===================================');
        const referencingForeignKeys = await queryRunner.query(`
      SELECT 
        TABLE_NAME,
        CONSTRAINT_NAME,
        REFERENCED_TABLE_NAME
      FROM 
        information_schema.KEY_COLUMN_USAGE
      WHERE 
        TABLE_SCHEMA = ? 
        AND REFERENCED_TABLE_NAME IN ('hospitals', 'wards', 'rooms', 'beds')
      ORDER BY 
        REFERENCED_TABLE_NAME, TABLE_NAME
    `, [process.env.DB_DATABASE]);
        if (referencingForeignKeys.length > 0) {
            console.log(`발견된 참조 외래키: ${referencingForeignKeys.length}개`);
            console.log('\n참조하는 외래키 제거 시작...');
            for (const fk of referencingForeignKeys) {
                try {
                    await queryRunner.query(`ALTER TABLE ${fk.TABLE_NAME} DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
                    console.log(`✅ 제거 성공: ${fk.TABLE_NAME}.${fk.CONSTRAINT_NAME} -> ${fk.REFERENCED_TABLE_NAME}`);
                }
                catch (error) {
                    console.log(`❌ 제거 실패: ${fk.TABLE_NAME}.${fk.CONSTRAINT_NAME} - ${error.message}`);
                }
            }
            const remainingReferencingFKs = await queryRunner.query(`
        SELECT 
          TABLE_NAME,
          CONSTRAINT_NAME,
          REFERENCED_TABLE_NAME
        FROM 
          information_schema.KEY_COLUMN_USAGE
        WHERE 
          TABLE_SCHEMA = ? 
          AND REFERENCED_TABLE_NAME IN ('hospitals', 'wards', 'rooms', 'beds')
      `, [process.env.DB_DATABASE]);
            console.log(`\n제거 후 남은 참조 외래키: ${remainingReferencingFKs.length}개`);
            if (remainingReferencingFKs.length === 0) {
                console.log('✅ 모든 참조 외래키가 성공적으로 제거되었습니다.');
            }
        }
        else {
            console.log('참조하는 외래키가 없습니다.');
        }
        console.log('\n===================================');
        console.log('외래키 제약 조건 제거 작업 완료!');
        await queryRunner.release();
    }
    catch (error) {
        console.error('에러 발생:', error);
    }
    finally {
        await AppDataSource.destroy();
    }
}
removeForeignKeys();
//# sourceMappingURL=remove-foreign-keys.js.map