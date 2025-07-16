// server.js - A simple Node.js server for sending web push notifications
// Dependencies: npm install express web-push body-parser cors

const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ================== VAPID KEYS ==================
// These should be stored as Environment Variables in a production environment.
const publicVapidKey = 'BLqqcvvk8fxGW7u8kqbAQoQGRj4ZQlTvKNkdAtMApFP4FwUNiXjg8YeB_B3KxXfbEJwWIZQO7nSZaKUMQRQWJGM';
const privateVapidKey = 'cAeWMQYaMPM6YxYDHeChpCnSAr7T5F1Vq9sJ3fRGZu0';

webpush.setVapidDetails(
  'mailto:your-email@example.com', // Use your email
  publicVapidKey,
  privateVapidKey
);

// ================== STORAGE ==================
// WARNING: This in-memory storage will be cleared when the server restarts.
// For production, use a persistent database (e.g., Firebase, MongoDB, PostgreSQL).
let subscriptions = []; // Structure: [{ userId: '...', subscription: { ... } }]


// ================== API ROUTES ==================

/**
 * Route to save a push subscription from the frontend.
 */
app.post('/save-subscription', (req, res) => {
  const { userId, subscription } = req.body;
  console.log('Received /save-subscription request for user:', userId);

  if (!userId || !subscription || !subscription.endpoint) {
    console.error('Invalid subscription data received:', req.body);
    return res.status(400).json({ message: 'User ID and a valid subscription object are required.' });
  }

  const existingIndex = subscriptions.findIndex(sub => sub.subscription.endpoint === subscription.endpoint);
  
  if (existingIndex > -1) {
    console.log(`Updating existing subscription for endpoint: ${subscription.endpoint}`);
    subscriptions[existingIndex] = { userId, subscription };
  } else {
    console.log(`Adding new subscription for user: ${userId}`);
    subscriptions.push({ userId, subscription });
  }
  
  console.log(`Total subscriptions now: ${subscriptions.length}`);
  res.status(201).json({ message: 'Subscription saved successfully.' });
});

/**
 * NEW: Route to remove a push subscription, e.g., on logout.
 */
app.post('/remove-subscription', (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) {
        return res.status(400).json({ message: 'Endpoint is required to remove a subscription.' });
    }
    console.log('Received /remove-subscription request for endpoint:', endpoint);
    const initialCount = subscriptions.length;
    subscriptions = subscriptions.filter(sub => sub.subscription.endpoint !== endpoint);
    const finalCount = subscriptions.length;

    if (initialCount > finalCount) {
        console.log(`Subscription with endpoint ${endpoint} removed successfully.`);
    } else {
        console.log(`No subscription found with endpoint ${endpoint} to remove.`);
    }
    console.log(`Total subscriptions now: ${finalCount}`);
    res.status(200).json({ message: 'Subscription removed or was not found.' });
});


/**
 * Route to trigger sending a notification.
 * Can target a specific user or broadcast to everyone.
 */
app.post('/send-notification', (req, res) => {
  // *** NEW: Use a generic 'targetUserId' instead of 'technicianId' ***
  const { title, body, url, targetUserId } = req.body;
  
  if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required.' });
  }

  const notificationPayload = JSON.stringify({
    title: title,
    body: body,
    url: url || '/'
  });

  let targetSubscriptions = [];

  if (targetUserId) {
    // Target a specific user
    targetSubscriptions = subscriptions
      .filter(s => String(s.userId) === String(targetUserId))
      .map(s => s.subscription);
    console.log(`Sending notification to user ID: ${targetUserId}. Found ${targetSubscriptions.length} subscriptions.`);
  } else {
    // Broadcast to all subscribers if no targetUserId is provided
    targetSubscriptions = subscriptions.map(s => s.subscription);
    console.log(`Broadcasting notification to all ${targetSubscriptions.length} subscribers.`);
  }
  
  if (targetSubscriptions.length === 0) {
    console.log('No matching subscriptions found to send notification.');
    return res.status(200).json({ message: 'No matching subscriptions found to send.' });
  }

  const promises = targetSubscriptions.map(subscription => 
    webpush.sendNotification(subscription, notificationPayload)
      .catch(error => {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log('Subscription has expired or is no longer valid. Removing it.');
          subscriptions = subscriptions.filter(s => s.subscription.endpoint !== error.endpoint);
        } else {
           console.error('Error sending notification to ', subscription.endpoint, error);
        }
      })
  );

  Promise.all(promises)
    .then(() => res.status(200).json({ message: 'Notifications sent successfully.' }))
    .catch(err => {
      console.error("Error sending notifications: ", err);
      res.sendStatus(500);
    });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
