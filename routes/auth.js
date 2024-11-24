const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseConfig');
const { oAuth2Client, getAuthUrl, storeToken, loadToken } = require('../googleCalendar');

// Step 1: Get Google OAuth URL
router.get('/google', async (req, res) => {
  const visitor_id = req.query.visitor_id; // Get visitor_id from query params
  if (!visitor_id) {
    return res.status(400).send('Visitor ID is required.');
  }

  const url = getAuthUrl(visitor_id);
  res.redirect(url);
});

// Step 2: Google OAuth callback
router.get('/google/callback', async (req, res) => {
  const code = req.query.code;
  var visitor_id = req.query.state; // Retrieve visitor_id from the state parameter
  visitor_id = Number(visitor_id);
  var oauth_verified = true;

  const data = await db.collection("visitors").where("visitor_id", "==", visitor_id).get();
  const snapshot = data.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  if (snapshot.empty) {
    return res.status(404).send({ error: `No visitor found with visitor_id: ${visitor_id}` });
  }

  // Assuming visitor_id is unique, fetch the first matching document
  const docId = snapshot[0].id;

  // Update the oauth_verified status
  await db.collection('visitors').doc(docId).update({ oauth_verified: oauth_verified });

  // console.log('Authorization Code:', code);
  // console.log('Visitor ID (state):', visitor_id);

  if (code && visitor_id) {
    try {
      // Exchange the code for tokens
      const { tokens } = await oAuth2Client.getToken(code);
      storeToken(visitor_id, tokens); // Store the token uniquely for this visitor
      oAuth2Client.setCredentials(tokens);

      // Respond with a success page
      res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Success</title>
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background-color: #f9f9f9;
              font-family: Arial, sans-serif;
            }
            .container {
              text-align: center;
            }
            .message {
              font-size: 1.5rem;
              color: #333;
              margin-top: 1rem;
            }
            .tick-mark {
              width: 100px;
              height: 100px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <img src="https://media.tenor.com/0cvxil96K7YAAAAj/check.gif" alt="Success" class="tick-mark">
            <div class="message">OAuth verified successfully for visitor: ${visitor_id}.</div>
            <div class="message">You can close this page. Thank you!</div>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Error during token exchange:', error.response?.data || error.message);
      res.status(500).send('Authorization failed. Please try again.', error.response?.data || error.message);
    }
  } else {
    res.status(400).send('Invalid request. Missing code or visitor_id.');
  }
});

// Step 3: Load token for a specific visitor
router.get('/google/load-token', (req, res) => {
  const visitor_id = req.query.visitor_id; // Get visitor_id from query params
  if (loadToken(visitor_id)) {
    res.status(200).send(`Token loaded successfully for visitor: ${visitor_id}`);
  } else {
    res.status(404).send('Token not found. Please authenticate first.');
  }
});

module.exports = router;
