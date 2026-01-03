// api/broadcast.js
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
  const params = req.method === 'GET' ? req.query : req.body;
  
  const { bot_token, method, type, file_id, text, caption, ...otherParams } = params;

  if (!bot_token || !method) {
    return res.status(400).json({
      code: 400,
      msg: "Missing bot_token or method parameter"
    });
  }

  try {
    const client = await connectToDatabase();
    const db = client.db('telegram_bot');
    const collection = db.collection('users');

    // Get all users for this bot
    const users = await collection.find({ bot_token: bot_token }).toArray();

    if (users.length === 0) {
      return res.status(404).json({
        code: 101,
        msg: "No users found in database"
      });
    }

    let totalSent = 0;
    let notSent = 0;
    let total = 0;

    // Send message to each user
    for (const user of users) {
      const url = `https://api.telegram.org/bot${bot_token}/${method}`;
      
      const data = {
        chat_id: user.userid,
        parse_mode: 'HTML',
        ...otherParams
      };

      // Add media if type is not text
      if (type && type !== 'text' && file_id) {
        data[type] = file_id;
      }
      
      // Add text or caption
      if (text) {
        data.text = text;
      }
      if (caption) {
        data.caption = caption;
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const json = await response.json();
        
        if (json.ok === true) {
          totalSent++;
        } else {
          notSent++;
          console.log(`Failed for user ${user.userid}:`, json);
        }
      } catch (error) {
        notSent++;
        console.log(`Error for user ${user.userid}:`, error.message);
      }
      
      total++;
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return res.status(200).json({
      code: 200,
      msg: "Broadcast completed",
      totalSent: totalSent.toString(),
      notSent: notSent.toString(),
      total: total.toString()
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      code: 500,
      msg: "Server error: " + error.message
    });
  }
}