// MongoDB connection helpers (via Mongoose): open one shared connection on
// startup and close it on shutdown.
import mongoose from 'mongoose';

let connecting: Promise<typeof mongoose> | null = null;

/**
 * Connect to MongoDB. Idempotent — calling multiple times reuses the same connection.
 */
export async function connectToDb(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  if (connecting) {
    return connecting;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env.');
  }

  if (process.env.NODE_ENV === 'development') {
    mongoose.set('debug', false); // flip to true if you want to see every query
  }

  connecting = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await connecting;
    console.log(`[db] connected to ${uri}`);
    return mongoose;
  } finally {
    connecting = null;
  }
}

// Close the MongoDB connection on graceful shutdown. No-op if already disconnected.
export async function disconnectFromDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[db] disconnected');
  }
}
