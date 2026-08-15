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
    // Vercel server runs in UTC, so we just use ISO string directly
    const nowMinutesStr = now.toISOString().slice(0, 16); 

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
      if (!reminder.notifications || reminder.notifications.length === 0) {
        await redis.del(`rem:${reminder.taskId}`);
        continue;
      }

      let modified = false;
      let subscription = null;
      let subFetchAttempted = false;

      // Iterate backwards to safely remove triggered notifications
      for (let i = reminder.notifications.length - 1; i >= 0; i--) {
        const notif = reminder.notifications[i];
        if (notif.absoluteTime <= nowMinutesStr) {
          // Due!
          if (!subFetchAttempted) {
            const subStr = await redis.get(`sub:${reminder.subId}`);
            subscription = subStr ? JSON.parse(subStr) : null;
            subFetchAttempted = true;
          }

          if (subscription) {
            try {
              let bodyText = reminder.body || 'Настав час виконання задачі!';
              if (notif.type === 'relative' && notif.offsetMinutes > 0) {
                  bodyText = `Завдання почнеться через ${notif.offsetMinutes} хвилин.`;
              }
              await webpush.sendNotification(
                subscription,
                JSON.stringify({
                  title: reminder.title,
                  body: bodyText,
                  taskId: reminder.taskId
                })
              );
              sentCount++;
            } catch (pushErr) {
              console.error(`Failed to send push for task ${reminder.taskId}:`, pushErr);
              if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                await redis.del(`sub:${reminder.subId}`);
                subscription = null; 
              }
            }
          }

          // Remove triggered notification from the list
          reminder.notifications.splice(i, 1);
          modified = true;
        }
      }

      if (modified) {
        if (reminder.notifications.length === 0 || (!subscription && subFetchAttempted)) {
          // No more notifications left, or subscription is invalid
          await redis.del(`rem:${reminder.taskId}`);
        } else {
          // Save the remaining notifications back to Redis
          await redis.set(`rem:${reminder.taskId}`, JSON.stringify(reminder));
        }
      }
    }

    return res.status(200).json({ success: true, checked: allReminders.length, sent: sentCount });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
