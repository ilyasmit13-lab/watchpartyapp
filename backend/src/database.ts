import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database;
const DB_PATH = process.env.DB_PATH || './database.sqlite';

export async function initDb() {
    db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS parties (
            id TEXT PRIMARY KEY,
            created_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            party_id TEXT,
            user_id TEXT,
            user_name TEXT,
            text TEXT,
            created_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS users (
             id TEXT PRIMARY KEY,
             push_token TEXT
        );
    `);
    try {
        await db.exec(`ALTER TABLE messages ADD COLUMN user_name TEXT;`);
    } catch {
        // Column already exists on upgraded databases.
    }
    console.log(`[DB] Initialized at ${DB_PATH}`);
}

export async function saveMessage(partyId: string, userId: string, userName: string, text: string) {
    const result = await db.run(
        'INSERT INTO messages (party_id, user_id, user_name, text, created_at) VALUES (?, ?, ?, ?, ?)',
        partyId, userId, userName, text, Date.now()
    );
    return result.lastID;
}

export async function getMessages(partyId: string) {
    return await db.all('SELECT * FROM messages WHERE party_id = ? ORDER BY created_at ASC', partyId);
}

export async function saveUserToken(userId: string, token: string) {
    await db.run('INSERT OR REPLACE INTO users (id, push_token) VALUES (?, ?)', userId, token);
}

export async function getPartyTokens(partyId: string) {
    // In a real app, we'd map party participants to users. 
    // For now, let's just assume we store active socket users in memory or DB.
    // This is a placeholder for the notification logic.
    return [];
}
