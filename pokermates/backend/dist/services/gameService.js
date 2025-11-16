"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.gameService = {
    async startGame(roomId) {
        return await prisma.$transaction(async (tx) => {
            // Check if there's already an active game
            const activeGame = await tx.game.findFirst({
                where: {
                    roomId,
                    status: 'IN_PROGRESS',
                },
            });
            if (activeGame) {
                throw new Error('A game is already in progress');
            }
            // Get all players in the room
            const players = await tx.roomPlayer.findMany({
                where: { roomId },
                include: { user: true },
            });
            if (players.length < 2) {
                throw new Error('Need at least 2 players to start a game');
            }
            // Create a new game
            const game = await tx.game.create({
                data: {
                    roomId,
                    status: 'IN_PROGRESS',
                    smallBlind: 10,
                    bigBlind: 20,
                    pot: 0,
                    currentBet: 0,
                    communityCards: "[]",
                },
            });
            // Create a new hand for the game
            const hand = await tx.hand.create({
                data: {
                    gameId: game.id,
                    status: 'PRE_FLOP',
                },
            });
            // Deal cards to players and create player hands
            const deck = createShuffledDeck();
            const playerHands = [];
            for (const player of players) {
                const card1 = deck.pop();
                const card2 = deck.pop();
                if (!card1 || !card2) {
                    throw new Error('Not enough cards in the deck');
                }
                // Create player hand with required fields
                const playerHand = await tx.playerHand.create({
                    data: {
                        handId: hand.id,
                        playerId: player.id,
                        userId: player.userId, // Assuming player has a userId field
                        cards: JSON.stringify([card1, card2]),
                        betAmount: 0,
                        isFolded: false,
                        isAllIn: false,
                    },
                });
                playerHands.push({ playerHand, player });
            }
            // Deal the flop (first 3 community cards)
            const flopCards = [deck.pop(), deck.pop(), deck.pop()];
            // Check if we have valid flop cards
            if (flopCards.some(card => !card)) {
                throw new Error('Not enough cards in the deck for the flop');
            }
            // Update the game with the flop
            await tx.game.update({
                where: { id: game.id },
                data: {
                    communityCards: JSON.stringify(flopCards),
                },
            });
            // Set the first player to act (the one after the big blind)
            if (players.length === 0) {
                throw new Error('No players in the game');
            }
            const firstToActIndex = 2 % players.length;
            const firstToActPlayer = players[firstToActIndex];
            if (!firstToActPlayer) {
                throw new Error('Could not determine first player to act');
            }
            const firstToAct = firstToActPlayer.id;
            return {
                game: {
                    ...game,
                    communityCards: flopCards,
                },
                hand: {
                    ...hand,
                    playerHands,
                },
                currentPlayer: firstToAct,
            };
        });
    },
    async playerAction(handId, playerId, action, amount) {
        if (action === 'raise' && amount === undefined) {
            throw new Error('Amount is required for raise action');
        }
        if (amount !== undefined && amount < 0) {
            throw new Error('Amount cannot be negative');
        }
        return await prisma.$transaction(async (tx) => {
            // Get the current game state
            const hand = await tx.hand.findUnique({
                where: { id: handId },
                include: {
                    game: true,
                    playerHands: true,
                },
            });
            if (!hand) {
                throw new Error('Hand not found');
            }
            const playerHand = hand.playerHands.find((ph) => ph.playerId === playerId);
            if (!playerHand) {
                throw new Error('Player not in this hand');
            }
            if (playerHand.isFolded) {
                throw new Error('Player has already folded');
            }
            if (playerHand.isAllIn) {
                throw new Error('Player is already all-in');
            }
            // Process the player's action
            switch (action) {
                case 'fold':
                    await tx.playerHand.update({
                        where: { id: playerHand.id },
                        data: { isFolded: true },
                    });
                    break;
                case 'check':
                    // Can only check if no bet has been made in the current round
                    if (hand.game.currentBet > 0) {
                        throw new Error('Cannot check when there is a bet');
                    }
                    break;
                case 'call':
                    const callAmount = hand.game.currentBet - playerHand.betAmount;
                    if (callAmount <= 0) {
                        throw new Error('No bet to call');
                    }
                    // Update player's bet amount
                    await tx.playerHand.update({
                        where: { id: playerHand.id },
                        data: {
                            betAmount: hand.game.currentBet,
                        },
                    });
                    // Update the game's pot
                    await tx.game.update({
                        where: { id: hand.game.id },
                        data: {
                            pot: { increment: callAmount }
                        }
                    });
                    break;
                case 'raise':
                    if (amount === undefined) {
                        throw new Error('Raise amount is required');
                    }
                    const totalBet = playerHand.betAmount + amount;
                    if (totalBet <= hand.game.currentBet) {
                        throw new Error('Raise must be higher than current bet');
                    }
                    // Update player's bet amount
                    await tx.playerHand.update({
                        where: { id: playerHand.id },
                        data: {
                            betAmount: totalBet,
                        },
                    });
                    // Update player's chips in RoomPlayer
                    await tx.roomPlayer.update({
                        where: { id: playerHand.playerId },
                        data: {
                            chips: { decrement: amount },
                        },
                    });
                    // Update the game's current bet
                    await tx.game.update({
                        where: { id: hand.game.id },
                        data: { currentBet: totalBet },
                    });
                    break;
            }
            // Determine the next player with proper typing
            const activePlayers = hand.playerHands.filter((ph) => !ph.isFolded && !ph.isAllIn);
            const currentPlayerIndex = activePlayers.findIndex((ph) => ph.playerId === playerId);
            const nextPlayerIndex = (currentPlayerIndex + 1) % activePlayers.length;
            const nextPlayer = activePlayers[nextPlayerIndex];
            const nextPlayerId = nextPlayer?.playerId || '';
            // Update the game with the next player to act
            await tx.game.update({
                where: { id: hand.game.id },
                data: { currentTurn: nextPlayerId },
            });
            // Check if the betting round is complete
            const allPlayersActed = activePlayers.every((ph) => ph.betAmount === hand.game.currentBet || ph.isAllIn);
            let updatedGame = { ...hand.game };
            // If betting round is complete, move to the next phase
            if (allPlayersActed) {
                let nextStatus;
                switch (hand.status) {
                    case 'PRE_FLOP': {
                        nextStatus = 'FLOP';
                        // Deal the turn (4th community card)
                        const turnCard = 'As'; // In a real game, this would be from the deck
                        const currentCards = hand.game.communityCards ? JSON.parse(hand.game.communityCards) : [];
                        updatedGame.communityCards = JSON.stringify([...currentCards, turnCard]);
                        break;
                    }
                    case 'FLOP':
                        {
                            nextStatus = 'TURN';
                            // Deal the river (5th community card)
                            const riverCard = 'Ks'; // In a real game, this would be from the deck
                            const currentCards = hand.game.communityCards ? JSON.parse(hand.game.communityCards) : [];
                            updatedGame.communityCards = JSON.stringify([...currentCards, riverCard]);
                            break;
                        }
                        break;
                    case 'TURN':
                        nextStatus = 'RIVER';
                        break;
                    case 'RIVER':
                        nextStatus = 'SHOWDOWN';
                        // Determine the winner(s) in a real game
                        break;
                    default:
                        nextStatus = 'COMPLETED';
                }
                // Reset the current bet for the next round
                updatedGame.currentBet = 0;
                await tx.hand.update({
                    where: { id: handId },
                    data: { status: nextStatus },
                });
                // Reset all player bet amounts for the next round
                await tx.playerHand.updateMany({
                    where: { handId },
                    data: { betAmount: 0 },
                });
            }
            return {
                game: updatedGame,
                nextPlayer: nextPlayerId,
                isRoundComplete: allPlayersActed,
            };
        });
    },
};
// Helper function to create a shuffled deck of cards
function createShuffledDeck() {
    const suits = ['h', 'd', 'c', 's'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    // Create a deck of cards
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push(`${rank}${suit}`);
        }
    }
    // Shuffle the deck using Fisher-Yates algorithm
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        // Use a temporary variable to avoid potential type issues with array destructuring
        const temp = deck[i];
        deck[i] = deck[j];
        deck[j] = temp;
    }
    return deck;
}
//# sourceMappingURL=gameService.js.map