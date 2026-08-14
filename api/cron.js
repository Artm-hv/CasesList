import Redis from 'ioredis';
import webpush from 'web-push';

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

export default async function handler(req, res) {
  // Check authorization header for Vercel Cron
  // https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
  const authHeader = req.headers.authorization;
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  // Set up web-push with VAPID keys
  webpush.setVapidDetails(
    'mailto:test@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  try {
    if (!redis) {
      return res.status(500).json({ error: 'Redis is not configured' });
    }

    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const nowMinutesStr = localNow.toISOString().slice(0, 16); // e.g. "2026-08-14T23:42"

    // 1. Get all reminders from Redis using SCAN
    let cursor = '0';
    const allReminders = [];
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'rem:*', 'COUNT', 100);
      cursor = nextCursor;
      
      if (keys.length > 0) {
        const values = await redis.mget(...keys);
        for (const val of values) {
          if (val) {
            allReminders.push(JSON.parse(val));
          }
        }
      }
    } while (cursor !== '0');

    let sentCount = 0;

    // 2. Check which ones are due
    for (const reminder of allReminders) {
      if (reminder.dueDate <= nowMinutesStr) {
        // Due! Let's get the subscription
        const subStr = await redis.get(`sub:${reminder.subId}`);
        const subscription = subStr ? JSON.parse(subStr) : null;
        
        if (subscription) {
          try {
            // Send push notification
            await webpush.sendNotification(
              subscription,
              JSON.stringify({
                title: reminder.title,
                body: reminder.body,
                taskId: reminder.taskId
              })
            );
            sentCount++;
            
            // Delete the reminder after successful send
            await redis.del(`rem:${reminder.taskId}`);
            
          } catch (pushErr) {
            console.error(`Failed to send push for task ${reminder.taskId}:`, pushErr);
            // If subscription is invalid (e.g. 410 Gone), we should delete it and the reminder
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              await redis.del(`sub:${reminder.subId}`);
              await redis.del(`rem:${reminder.taskId}`);
            }
          }
        } else {
          // No subscription found for this reminder, delete it
          await redis.del(`rem:${reminder.taskId}`);
        }
      }
    }

    return res.status(200).json({ success: true, checked: allReminders.length, sent: sentCount });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
