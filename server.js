import express from 'express';
import cors from 'cors';
import { connectDB } from './db/connection.js';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import dashboardRoutes from './routes/dashboard.js';
import invoiceRoutes from './routes/invoices.js';
import paymentRoutes from './routes/payments.js';
import activityRoutes from './routes/activity.js';
import clientDataRoutes from './routes/clientData.js';
import projectRoutes from './routes/projects.js';
import supportRoutes from './routes/support.js';

const app = express();

// Middleware
const normalizeOrigin = (origin) => (origin || '').replace(/\/$/, '');
const allowedOrigins = config.corsOrigins.map(normalizeOrigin);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests and explicitly allowed browser origins.
    const normalized = normalizeOrigin(origin);
    if (!origin || allowedOrigins.includes(normalized)) {
      callback(null, true);
      return;
    }
    console.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/client', clientDataRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/support', supportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AFS Backend API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
