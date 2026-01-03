// api/adduser.js
import { MongoClient } from 'mongodb';

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }

  const client = await MongoClient.connect(process.env.MONGODB_URI);
  cachedClient = client;
  return client;
}

export default async function handler(req, res) {
  const { bot_token, userid } = req.query;

  if (!bot_token || !userid) {
    return res.status(400).json({
      code: 400,
      msg: "Missing bot_token or userid parameter"
    });
  }

  try {
    const client = await connectToDatabase();
    const db = client.db('telegram_bot');
    const collection = db.collection('users');

    // Check if user already exists
    const existingUser = await collection.findOne({
      bot_token: bot_token,
      userid: userid
    });

    if (existingUser) {
      return res.status(200).json({
        code: 199,
        msg: "User Already exists in database"
      });
    }

    // Add new user
    await collection.insertOne({
      bot_token: bot_token,
      userid: userid,
      created_at: new Date()
    });

    return res.status(200).json({
      code: 200,
      msg: "User Successfully added to database"
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      code: 500,
      msg: "Server error: " + error.message
    });
  }
}
