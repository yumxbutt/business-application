require('dotenv').config();

const { connectDB, sequelize } = require('../config/database');
const { bootstrapDatabase } = require('../config/bootstrap');
const { refreshAllContactBalances } = require('../services/contact-balance.service');

const run = async () => {
  const connected = await connectDB();

  if (!connected) {
    console.error('Database setup aborted: connection failed.');
    process.exit(1);
  }

  await bootstrapDatabase({ alter: true });
  await refreshAllContactBalances();
  console.log('Database setup completed successfully.');
  await sequelize.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Database setup failed:', error);

  try {
    await sequelize.close();
  } catch {
    // ignore close errors
  }

  process.exit(1);
});