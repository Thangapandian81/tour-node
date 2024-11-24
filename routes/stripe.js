const express = require('express');
const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const {db}=require('../config/firebaseConfig')
const router = express.Router();
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'stripe.json')));

const {STRIPE_SECRET_KEY,SUCCESS_URL,CANCEL_URL}=credentials.installed;

const app = express();

app.use(bodyParser.json());

// Initialize Stripe with the secret key from environment variables
const stripe = Stripe(STRIPE_SECRET_KEY);

// Middleware to parse JSON bodies
app.use(express.json());

// POST endpoint to create a checkout session for Zoho SalesIQ bot
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { amount, currency = 'inr' } = req.body; // Default currency is now 'inr'

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    // Convert amount to smallest currency unit (e.g., paise for INR)
    const unitAmount = Math.round(amount * 100);

    // Create a checkout session with Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: 'Goa tour package',
            },
            unit_amount: unitAmount, // Converted amount
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${SUCCESS_URL}`, // Set your success redirect URL here
      cancel_url: `${CANCEL_URL}`,   // Set your cancel redirect URL here
    });

    // Respond with the session ID instead of the URL
    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET endpoint to retrieve the checkout URL using session ID
router.get('/get-checkout-url', async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Retrieve the session to get the checkout URL
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session.url) {
      return res.status(404).json({ error: 'Checkout URL not found' });
    }

    // Respond with the checkout session URL for SalesIQ bot
    res.status(200).json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('Error retrieving checkout URL:', error);
    res.status(500).json({ error: error.message });
  }
});



module.exports=router;