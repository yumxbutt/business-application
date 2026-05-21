require('dotenv').config();

const { connectDB, sequelize } = require('../config/database');
const { refreshAllContactBalances } = require('../services/contact-balance.service');

const run = async () => {
  const connected = await connectDB();
  if (!connected) {
    console.error('Sync aborted: database connection failed.');
    process.exit(1);
  }

  const count = await refreshAllContactBalances();
  console.log(`Contact balance sync completed. Contacts processed: ${count}`);
  await sequelize.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Contact balance sync failed:', error);
  try {
    await sequelize.close();
  } catch {
    // ignore close errors
  }
  process.exit(1);
});