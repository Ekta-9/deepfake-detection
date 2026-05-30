const router  = require('express').Router();
const multer  = require('multer');
const { authenticate }        = require('../middleware/auth');
const { pool }                = require('../config/db');
const { predictFromMlService } = require('../services/mlClient');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are accepted'));
    }
  },
});

// POST /api/analyze
router.post('/analyze', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const prediction = await predictFromMlService(req.file);

    const { rows } = await pool.query(
      `INSERT INTO analyses (user_id, score, label, confidence, gradcam_b64)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [req.user.id, prediction.score, prediction.label,
       prediction.confidence, prediction.gradcam_b64]
    );

    res.json({
      id:         rows[0].id,
      score:      prediction.score,
      label:      prediction.label,
      confidence: prediction.confidence,
      gradcamB64: prediction.gradcam_b64,
      createdAt:  rows[0].created_at,
    });
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(err.status || 500).json({ message: err.message || 'Analysis failed' });
  }
});

// GET /api/analyses
router.get('/analyses', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, score, label, confidence, created_at
       FROM analyses
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(rows.map(r => ({
      id:         r.id,
      score:      r.score,
      label:      r.label,
      confidence: r.confidence,
      createdAt:  r.created_at,
    })));
  } catch (err) {
    console.error('History error:', err.message);
    res.status(500).json({ message: 'Failed to fetch history' });
  }
});

// Multer error handler
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File too large (max 15MB)' });
  }
  if (err.message) {
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: 'Unexpected error' });
});

module.exports = router;
