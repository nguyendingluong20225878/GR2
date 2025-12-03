import mongoose, { Connection } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI ?? process.env.DATABASE_URL;

if (!MONGODB_URI) {
  throw new Error("connection.ts: MONGODB_URI (or DATABASE_URL) is not set");
}

type GlobalWithMongoose = typeof globalThis & {
  __mongooseConnection?: {
    conn: Connection | null;
    promise: Promise<Connection> | null;
  };
};

const globalWithMongoose = globalThis as GlobalWithMongoose;

if (!globalWithMongoose.__mongooseConnection) {
  globalWithMongoose.__mongooseConnection = { conn: null, promise: null };
}

export async function connectToDatabase(): Promise<Connection> {
  if (globalWithMongoose.__mongooseConnection?.conn) {
    return globalWithMongoose.__mongooseConnection.conn;
  }

  if (!globalWithMongoose.__mongooseConnection?.promise) {
    mongoose.set("strictQuery", true);

    globalWithMongoose.__mongooseConnection!.promise = mongoose
      .connect(MONGODB_URI!, { // FIX: Thêm "!" để ép kiểu string non-null
        autoIndex: true,
        serverSelectionTimeoutMS: 10_000,
      })
      .then((mongooseInstance) => mongooseInstance.connection);
  }

  globalWithMongoose.__mongooseConnection!.conn = await globalWithMongoose.__mongooseConnection!.promise!;
  return globalWithMongoose.__mongooseConnection!.conn!;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (globalWithMongoose.__mongooseConnection?.conn) {
    await mongoose.disconnect();
    globalWithMongoose.__mongooseConnection.conn = null;
    globalWithMongoose.__mongooseConnection.promise = null;
  }
}

export { mongoose };