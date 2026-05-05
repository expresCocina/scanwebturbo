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

// CORS — always allow production + localhost
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://webscan.turbobrandcol.com',
  'https://scanwebturbo.vercel.app',
];
const extraOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];
const allowedOrigins = [...new Set([...defaultOrigins, ...extraOrigins])];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`CORS blocked: ${origin}`);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight requests for all routes
app.options('*', cors());

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
