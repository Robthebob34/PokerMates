import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Log the database URL for debugging
console.log('Connecting to database at:', process.env.DATABASE_URL);

// Initialize Prisma Client with error handling
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Add error handling for database connection
prisma.$connect()
  .then(() => {
    console.log('Successfully connected to the database');
  })
  .catch((error: Error) => {
    console.error('Error connecting to the database:', error);
    process.exit(1);
  });

// Handle process termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
