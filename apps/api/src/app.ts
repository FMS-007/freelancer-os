import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { errorHandler, notFound } from './middleware/errorHandler';
import router from './routes';

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many auth requests, please try again later.' },
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authLimiter, router.auth);
app.use('/api/v1/users', router.users);
app.use('/api/v1/templates', router.templates);
app.use('/api/v1/proposals', router.proposals);
app.use('/api/v1/ai', router.ai);
app.use('/api/v1/alerts', router.alerts);
app.use('/api/v1/records', router.records);
app.use('/api/v1/analytics', router.analytics);
app.use('/api/v1/scraper', router.scraper);
app.use('/api/v1/notifications', router.notifications);
app.use('/api/v1/connections', router.connections);

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
