import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('Testing database connection...');
console.log('Database URL:', process.env.DATABASE_URL);

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  try {
    // Test the database connection
    await prisma.$connect();
    console.log('✅ Successfully connected to the database');
    
    // Test a simple query
    const users = await prisma.user.findMany();
    console.log(`✅ Found ${users.length} users in the database`);
    
    return true;
  } catch (error) {
    console.error('❌ Error connecting to the database:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testConnection()
  .then(success => {
    console.log(success ? '✅ Test completed successfully' : '❌ Test failed');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
