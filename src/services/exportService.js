const fs   = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify');
const pool = require('../db');
const { upsertWatermark } = require('./watermarkService');
const logger = require('../logger');

const OUTPUT_DIR = path.join(__dirname, '../../output');

// Helper: stream query results to a CSV file
async function writeCSV(filename, rows, columns) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(OUTPUT_DIR, filename);
    const writeStream = fs.createWriteStream(filePath);
    const stringifier = stringify({ header: true, columns });
    stringifier.pipe(writeStream);
    rows.forEach(row => stringifier.write(row));
    stringifier.end();
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

async function runExport({ jobId, consumerId, exportType, filename }) {
  const start = Date.now();
  logger.info('export_started', { jobId, consumerId, exportType });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let rows = [];
    let maxUpdatedAt = null;

    if (exportType === 'full') {
      const result = await client.query(
        'SELECT id, name, email, created_at, updated_at, is_deleted FROM users WHERE is_deleted = FALSE ORDER BY updated_at ASC'
      );
      rows = result.rows;

    } else {
      // Both incremental and delta need the watermark
      const wm = await client.query(
        'SELECT last_exported_at FROM watermarks WHERE consumer_id = $1',
        [consumerId]
      );
      const since = wm.rows[0]?.last_exported_at || new Date(0);

      const result = await client.query(
        `SELECT id, name, email, created_at, updated_at, is_deleted
         FROM users
         WHERE updated_at > $1
         ORDER BY updated_at ASC`,
        [since]
      );
      rows = result.rows;
    }

    if (rows.length > 0) {
      maxUpdatedAt = rows[rows.length - 1].updated_at;
    }

    // Add operation column for delta exports
    if (exportType === 'delta') {
      rows = rows.map(row => ({
        operation: row.is_deleted
          ? 'DELETE'
          : row.created_at.getTime() === row.updated_at.getTime()
            ? 'INSERT'
            : 'UPDATE',
        ...row,
      }));
    }

    // Define CSV columns per export type
    const baseColumns = ['id', 'name', 'email', 'created_at', 'updated_at', 'is_deleted'];
    const columns = exportType === 'delta' ? ['operation', ...baseColumns] : baseColumns;

    await writeCSV(filename, rows, columns);

    // Update watermark atomically — only after file is written
    if (maxUpdatedAt) {
      await upsertWatermark(client, consumerId, maxUpdatedAt);
    } else if (exportType === 'full') {
      // Full export with 0 rows: set watermark to NOW()
      await upsertWatermark(client, consumerId, new Date());
    }

    await client.query('COMMIT');

    logger.info('export_completed', {
      jobId,
      rowsExported: rows.length,
      duration: Date.now() - start,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('export_failed', { jobId, error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { runExport };