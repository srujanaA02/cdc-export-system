const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { runExport } = require('../services/exportService');
const { getWatermark } = require('../services/watermarkService');

const router = Router();

// Middleware: require X-Consumer-ID header
function requireConsumer(req, res, next) {
  const consumerId = req.headers['x-consumer-id'];
  if (!consumerId) return res.status(400).json({ error: 'X-Consumer-ID header required' });
  req.consumerId = consumerId;
  next();
}

// Factory for POST /exports/:type
function exportHandler(exportType) {
  return (req, res) => {
    const { consumerId } = req;
    const jobId    = uuidv4();
    const ts       = Date.now();
    const filename = `${exportType}_${consumerId}_${ts}.csv`;

    // Respond immediately with 202, then run export in the background
    res.status(202).json({ jobId, status: 'started', exportType, outputFilename: filename });

    // Fire-and-forget background job
    runExport({ jobId, consumerId, exportType, filename }).catch(() => {});
  };
}

router.post('/exports/full',        requireConsumer, exportHandler('full'));
router.post('/exports/incremental', requireConsumer, exportHandler('incremental'));
router.post('/exports/delta',       requireConsumer, exportHandler('delta'));

// GET /exports/watermark
router.get('/exports/watermark', requireConsumer, async (req, res) => {
  try {
    const wm = await getWatermark(req.consumerId);
    if (!wm) return res.status(404).json({ error: 'No watermark found for this consumer' });
    res.json({ consumerId: wm.consumer_id, lastExportedAt: wm.last_exported_at });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;