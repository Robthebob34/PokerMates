-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RoomPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "chips" INTEGER NOT NULL DEFAULT 1000,
    "buyIn" INTEGER NOT NULL DEFAULT 0,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoomPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RoomPlayer" ("chips", "createdAt", "id", "isHost", "roomId", "updatedAt", "userId") SELECT "chips", "createdAt", "id", "isHost", "roomId", "updatedAt", "userId" FROM "RoomPlayer";
DROP TABLE "RoomPlayer";
ALTER TABLE "new_RoomPlayer" RENAME TO "RoomPlayer";
CREATE UNIQUE INDEX "RoomPlayer_userId_roomId_key" ON "RoomPlayer"("userId", "roomId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
