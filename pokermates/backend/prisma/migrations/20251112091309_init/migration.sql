-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxPlayers" INTEGER NOT NULL DEFAULT 8,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RoomPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "chips" INTEGER NOT NULL DEFAULT 1000,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoomPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "smallBlind" INTEGER NOT NULL DEFAULT 10,
    "bigBlind" INTEGER NOT NULL DEFAULT 20,
    "currentTurn" TEXT,
    "pot" INTEGER NOT NULL DEFAULT 0,
    "currentBet" INTEGER NOT NULL DEFAULT 0,
    "communityCards" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Game_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRE_FLOP',
    "winnerId" TEXT,
    "winningHand" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Hand_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerHand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "cards" TEXT NOT NULL DEFAULT '[]',
    "isFolded" BOOLEAN NOT NULL DEFAULT false,
    "betAmount" INTEGER NOT NULL DEFAULT 0,
    "isAllIn" BOOLEAN NOT NULL DEFAULT false,
    "handRank" INTEGER,
    "handName" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "PlayerHand_handId_fkey" FOREIGN KEY ("handId") REFERENCES "Hand" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerHand_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "RoomPlayer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerHand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlayer_userId_roomId_key" ON "RoomPlayer"("userId", "roomId");

-- CreateIndex
CREATE INDEX "Game_roomId_idx" ON "Game"("roomId");

-- CreateIndex
CREATE INDEX "Hand_gameId_idx" ON "Hand"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerHand_handId_playerId_key" ON "PlayerHand"("handId", "playerId");
