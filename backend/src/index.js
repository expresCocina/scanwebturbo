require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const analyzeRoutes = require('./routes/analyze');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 4000;

// =====================================================
// MIDDLEWARE
// =====================================================

// Security headers
app.use(helmet());

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por ventana
  message: 'Demasiadas peticiones desde esta IP, intenta más tarde'
});
app.use('/api/', limiter);

// =====================================================
// ROUTES
// =====================================================

app.use('/health', healthRoutes);
app.use('/api/analyze', analyzeRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'WebScan Analysis Worker',
    version: '1.0.0',
    status: 'running',
    company: 'TurboBrand Colombia'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   WebScan Analysis Worker            ║');
  console.log('║   TurboBrand Colombia                 ║');
  console.log('╠═══════════════════════════════════════╣');
  console.log(`║   Port: ${PORT}                         ║`);
  console.log(`║   Environment: ${process.env.NODE_ENV || 'development'}         ║`);
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
