const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/database');
const { bootstrapDatabase } = require('./config/bootstrap');

// Load environment variables
dotenv.config();

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Allow any localhost/127.0.0.1 origin (all ports) in development
const isLocalhostOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isLocalhostOrigin(origin) || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is running', timestamp: new Date() });
});

// Routes placeholder
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/branches', require('./routes/branch.routes'));
app.use('/api/access-rights', require('./routes/access-rights.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/contacts', require('./routes/contact.routes'));
app.use('/api/ledger', require('./routes/ledger.routes'));
app.use('/api/sales', require('./routes/sales.routes'));
app.use('/api/purchases', require('./routes/purchase.routes'));
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/financials', require('./routes/financial.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/payment-accounts', require('./routes/payment-account.routes'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
connectDB().then(async (connected) => {
  if (!connected) {
    console.error('Startup aborted: please check database credentials in backend/.env');
    return;
  }

  await bootstrapDatabase();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
