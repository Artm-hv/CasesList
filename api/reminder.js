import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const { taskId, title, body, dueDate, subId } = req.body;
      
      if (!taskId || !dueDate || !subId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const reminder = {
        taskId,
        title,
        body,
        dueDate, // ISO string '2026-08-14T23:42'
        subId,
        createdAt: Date.now()
      };

      // Store reminder using task ID
      await kv.set(`rem:${taskId}`, reminder);

      return res.status(200).json({ success: true });
    } 
    
    if (req.method === 'DELETE') {
      const { taskId } = req.query;
      
      if (!taskId) {
        return res.status(400).json({ error: 'Missing taskId' });
      }

      await kv.del(`rem:${taskId}`);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in reminder API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
