const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const {db}=require('./config/firebaseConfig')

// Load Google Calendar credentials
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'googleCalendarCredentials.json')));

const { client_id, client_secret, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

/**
 * Generates the Google OAuth URL for authentication.
 * @param {string} visitor_id - Unique identifier for the visitor.
 * @returns {string} The authentication URL.
 */
function getAuthUrl(visitor_id) {
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: visitor_id, // Pass visitor_id for tracking
  });
}

/**
 * Stores the OAuth token for a specific visitor in the `tokens` folder.
 * @param {string} visitor_id - Unique identifier for the visitor.
 * @param {object} token - The OAuth token object.
 */
function storeToken(visitor_id, token) {
  const tokenDir = path.join(__dirname, 'tokens');
  if (!fs.existsSync(tokenDir)) {
    fs.mkdirSync(tokenDir); // Create folder if it doesn't exist
  }
  const tokenPath = path.join(tokenDir, `${visitor_id}.json`);
  fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
  console.log(`Token stored for visitor: ${visitor_id}`); 
}

/**
 * Loads the OAuth token for a specific visitor from the `tokens` folder.
 * @param {string} visitor_id - Unique identifier for the visitor.
 * @returns {boolean} Whether the token was successfully loaded.
 */
function loadToken(visitor_id) {
  const tokenPath = path.join(__dirname, 'tokens', `${visitor_id}.json`);
  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath));
    oAuth2Client.setCredentials(token);
    console.log(`Token loaded for visitor: ${visitor_id}`);
    return true;
  }
  console.log(`No token found for visitor: ${visitor_id}`);
  return false;
}

module.exports = {
  oAuth2Client,
  getAuthUrl,
  storeToken,
  loadToken,
};
