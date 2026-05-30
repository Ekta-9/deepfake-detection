require('dotenv').config();
const express  = require('express');
const { initDb } = require('./config/db');
const authRoutes     = require('./routes/auth');
const analysisRoutes = require('./routes/analysis');

const app = express();

app.use(express.json());

// Health — public
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api',      analysisRoutes);

// Global error fallback
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT || '8080');

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialise database:', err.message);
    process.exit(1);
  });
