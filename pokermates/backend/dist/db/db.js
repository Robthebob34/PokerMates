"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Log the database URL for debugging
console.log('Connecting to database at:', process.env.DATABASE_URL);
// Initialize Prisma Client with error handling
const prisma = new client_1.PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});
// Add error handling for database connection
prisma.$connect()
    .then(() => {
    console.log('Successfully connected to the database');
})
    .catch((error) => {
    console.error('Error connecting to the database:', error);
    process.exit(1);
});
// Handle process termination
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});
exports.default = prisma;
//# sourceMappingURL=db.js.map