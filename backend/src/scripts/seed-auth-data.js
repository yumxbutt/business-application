require('dotenv').config();

const { connectDB, sequelize } = require('../config/database');
const { bootstrapDatabase } = require('../config/bootstrap');

const run = async () => {
  const connected = await connectDB();

  if (!connected) {
    console.error('Seed aborted: database connection failed.');
    process.exit(1);
  }

  await bootstrapDatabase();
  console.log('Auth users seeded successfully.');
  await sequelize.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Seed failed:', error);
  try {
    await sequelize.close();
  } catch {
    // ignore close errors
  }
  process.exit(1);
});
