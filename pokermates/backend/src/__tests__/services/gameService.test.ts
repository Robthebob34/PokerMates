// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { gameService } from '../../services/gameService.js';

// Mock test utilities
const mockDescribe = (name: string, fn: () => void) => fn();
const mockIt = (name: string, fn: () => Promise<void>) => fn();
const mockExpect = (value: any) => ({
  toBe: (expected: any) => console.assert(value === expected, `Expected ${expected}, got ${value}`),
  toBeDefined: () => console.assert(value !== undefined, 'Expected value to be defined'),
  toHaveLength: (length: number) => console.assert(
    Array.isArray(value) ? value.length === length : value?.length === length, 
    `Expected length ${length}, got ${Array.isArray(value) ? value.length : value?.length}`
  )
});

const prisma = new PrismaClient();

// Simple test runner
async function runTests() {
  let testRoomId: string = '';
  const testPlayerIds: string[] = [];
  let testGameId: string = '';

  async function cleanup() {
    if (testGameId) {
      await prisma.game.deleteMany({
        where: { roomId: testRoomId },
      });
    }
    
    if (testPlayerIds.length > 0) {
      await prisma.roomPlayer.deleteMany({
        where: { id: { in: testPlayerIds } },
      });
    }
    
    if (testRoomId) {
      await prisma.room.delete({
        where: { id: testRoomId },
      });
    }
  }

  try {
    console.log('Setting up test data...');
    
    // Create a test room
    const room = await prisma.room.create({
      data: {
        code: `TEST-${Date.now()}`,
        name: 'Test Room',
      },
    });
    testRoomId = room.id;

    // Create test users and add them to the room
    for (let i = 0; i < 4; i++) {
      const user = await prisma.user.create({
        data: {
          username: `testuser${Date.now()}-${i}`,
        },
      });

      const roomPlayer = await prisma.roomPlayer.create({
        data: {
          userId: user.id,
          roomId: testRoomId,
          isHost: i === 0, // First player is host
          chips: 1000,
        },
      });

      testPlayerIds.push(roomPlayer.id);
    }

    console.log('Running startGame tests...');
    
    // Test 1: Start a new game
    console.log('Test 1: Starting a new game...');
    const result = await gameService.startGame(testRoomId);
    testGameId = result.game.id;
    
    // Verify game was created
    console.assert(result.game.roomId === testRoomId, 'Game room ID should match');
    console.assert(result.game.status === 'IN_PROGRESS', 'Game status should be IN_PROGRESS');
    
    // Verify hand was created
    console.assert(!!result.hand, 'Hand should be defined');
    console.assert(result.hand.status === 'PRE_FLOP', 'Hand status should be PRE_FLOP');
    
    // Verify player hands
    console.assert(
      result.hand.playerHands.length === 4, 
      `Expected 4 player hands, got ${result.hand.playerHands.length}`
    );
    
    // Verify each player's hand
    result.hand.playerHands.forEach((hand: any) => {
      const cards = JSON.parse(hand.playerHand.cards);
      console.assert(cards.length === 2, 'Each player should have 2 cards');
      console.assert(hand.playerHand.betAmount === 0, 'Initial bet amount should be 0');
      console.assert(hand.playerHand.isFolded === false, 'Player should not be folded initially');
    });
    
    // Test 2: Try to start another game (should fail)
    console.log('\nTest 2: Trying to start another game...');
    try {
      await gameService.startGame(testRoomId);
      console.error('Error: Expected startGame to throw an error but it did not');
    } catch (error) {
      console.assert(
        error.message.includes('already in progress'), 
        `Expected 'already in progress' error, got: ${error.message}`
      );
      console.log('Successfully prevented starting a second game');
    }
    
    console.log('\nAll tests completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    console.log('\nCleaning up test data...');
    await cleanup();
    await prisma.$disconnect();
    console.log('Cleanup complete');
  }
}

// Run the tests
runTests().catch(console.error);
