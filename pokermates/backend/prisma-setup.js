import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Run Prisma generate
try {
  console.log('Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('Running migrations...');
  execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
  
  console.log('Prisma setup completed successfully!');
} catch (error) {
  console.error('Error during Prisma setup:', error);
  process.exit(1);
}
