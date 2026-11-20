import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { testDatabaseConnection } from './config/db';
import authRoutes from './routes/auth';
import analyzeRoutes from './routes/analyze';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'TacticalReplayAI Server is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/analyze', analyzeRoutes);

app.listen(PORT, async () => {
  await testDatabaseConnection();
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});