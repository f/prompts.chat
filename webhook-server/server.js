// Simple Facebook Messenger webhook server (Express)
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'verify_token_here';

// Webhook verification handshake
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Webhook event receiver
app.post('/webhook', (req, res) => {
  console.log('Webhook event:', JSON.stringify(req.body, null, 2));
n  // Basic handling: iterate entries and messaging events
  if (req.body.object === 'page') {
    req.body.entry.forEach(entry => {
      const events = entry.messaging || [];
      events.forEach(event => {
        if (event.message) {
          const senderId = event.sender.id;
          const text = event.message.text;
          console.log(`Message from ${senderId}: ${text}`);
          // TODO: reply using Send API with PAGE_ACCESS_TOKEN
        } else if (event.postback) {
          console.log('Postback:', event.postback);
        }
      });
    });
  }

  // Must respond 200 quickly
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook server listening on port ${PORT}`));
