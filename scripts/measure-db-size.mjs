import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const count = await p.lead.count();
  console.log('Records:', count);

  const tableSize = await p.$queryRawUnsafe(`
    SELECT 
      pg_size_pretty(pg_total_relation_size('leads')) as total_size,
      pg_size_pretty(pg_relation_size('leads')) as table_size,
      pg_size_pretty(pg_indexes_size('leads')) as index_size,
      pg_total_relation_size('leads') as total_bytes,
      pg_relation_size('leads') as table_bytes,
      pg_indexes_size('leads') as index_bytes
  `);
  const row = tableSize[0];
  const total_bytes = Number(row.total_bytes);
  const table_bytes = Number(row.table_bytes);
  const index_bytes = Number(row.index_bytes);
  console.log('Table leads:', row.total_size, '(data:', row.table_size, '+ indexes:', row.index_size + ')');

  const dbRow = await p.$queryRawUnsafe(`
    SELECT 
      pg_database_size(current_database()) as db_bytes,
      pg_size_pretty(pg_database_size(current_database())) as db_size
  `);
  console.log('DB total:', dbRow[0].db_size);

  // Bytes per record
  const perRecord = Math.round(total_bytes / count);
  const perRecordData = Math.round(table_bytes / count);
  const perRecordIndex = Math.round(index_bytes / count);
  console.log(`Bytes per record: ${perRecord} total (data: ${perRecordData} + indexes: ${perRecordIndex})`);
  console.log('Bytes per record (with indexes):', perRecord);

  // Projections
  const rates = [100000, 150000, 200000];
  const months = [1, 3, 6, 12, 24];

  console.log('\n=== PROJECTIONS ===');
  for (const rate of rates) {
    console.log(`\n--- ${(rate/1000)}k records/month ---`);
    for (const m of months) {
      const totalRecords = rate * m;
      const sizeMB = Math.round((totalRecords * perRecord) / (1024 * 1024));
      const sizeGB = (sizeMB / 1024).toFixed(2);
      console.log(`  ${m} month(s): ${totalRecords.toLocaleString()} records = ${sizeMB >= 1024 ? sizeGB + ' GB' : sizeMB + ' MB'}`);
    }
  }
}

main().catch(console.error).finally(() => p.$disconnect());
