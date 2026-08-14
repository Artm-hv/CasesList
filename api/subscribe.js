import Redis from 'ioredis';

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscription } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    // We can use the endpoint as a unique ID for the subscription
    const subId = Buffer.from(subscription.endpoint).toString('base64').substring(0, 32);
    
    // Store in Redis
    if (redis) {
      await redis.set(`sub:${subId}`, JSON.stringify(subscription));
    }

    return res.status(200).json({ success: true, subId });
  } catch (error) {
    console.error('Error saving subscription:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
