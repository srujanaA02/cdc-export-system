const pool = require('../db');

async function getWatermark(consumerId) {
  const { rows } = await pool.query(
    'SELECT * FROM watermarks WHERE consumer_id = $1',
    [consumerId]
  );
  return rows[0] || null;
}

// Sets watermark only on success — called inside the same transaction as export
async function upsertWatermark(client, consumerId, lastExportedAt) {
  await client.query(`
    INSERT INTO watermarks (consumer_id, last_exported_at, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (consumer_id)
    DO UPDATE SET last_exported_at = $2, updated_at = NOW()
  `, [consumerId, lastExportedAt]);
}

module.exports = { getWatermark, upsertWatermark };