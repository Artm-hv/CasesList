import { kv } from '@vercel/kv';
import webpush from 'web-push';

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
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const nowMinutesStr = localNow.toISOString().slice(0, 16); // e.g. "2026-08-14T23:42"

    // 1. Get all reminders from KV
    // Since Vercel KV doesn't have a simple "getAll" that returns values, 
    // we use SCAN to get all keys starting with 'rem:'
    let cursor = 0;
    const allReminders = [];
    do {
      const [nextCursor, keys] = await kv.scan(cursor, { match: 'rem:*', count: 100 });
      cursor = nextCursor;
      
      if (keys.length > 0) {
        const values = await kv.mget(...keys);
        allReminders.push(...values.filter(Boolean));
      }
    } while (cursor !== 0);

    let sentCount = 0;

    // 2. Check which ones are due
    for (const reminder of allReminders) {
      if (reminder.dueDate <= nowMinutesStr) {
        // Due! Let's get the subscription
        const subscription = await kv.get(`sub:${reminder.subId}`);
        
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
            await kv.del(`rem:${reminder.taskId}`);
            
          } catch (pushErr) {
            console.error(`Failed to send push for task ${reminder.taskId}:`, pushErr);
            // If subscription is invalid (e.g. 410 Gone), we should delete it and the reminder
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              await kv.del(`sub:${reminder.subId}`);
              await kv.del(`rem:${reminder.taskId}`);
            }
          }
        } else {
          // No subscription found for this reminder, delete it
          await kv.del(`rem:${reminder.taskId}`);
        }
      }
    }

    return res.status(200).json({ success: true, checked: allReminders.length, sent: sentCount });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
