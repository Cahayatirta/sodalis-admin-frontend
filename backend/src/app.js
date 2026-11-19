import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env.js';

import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import userRoutes from './routes/userRoutes.js';
import loanRoutes from './routes/loanRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Allowed CORS origins: React Vite frontend
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  env.frontendUrl,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev, or specific origin
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Standard parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for KYC uploads and assets
app.use('/uploads', express.static(path.resolve('public/uploads')));
app.use(express.static(path.resolve('public')));

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'Sodalis Micro-Finance Admin Underwriting Terminal API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/loans', loanRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

