import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// 예) postgres://scanner:scanner@db:5432/secret_scanner
// 연결은 첫 쿼리 시점에 lazy 하게 이뤄지므로, DB가 없어도 서버 부팅은 가능하다.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function pingDb() {
  const { rows } = await pool.query('SELECT NOW() AS now');
  return rows[0].now;
}
