const express = require('express');
const Razorpay = require('razorpay');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const { db } = require('../config/firebaseConfig'); // Assuming you have Firebase configured

const router = express.Router();

// Load Razorpay credentials from a file
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'razor.json')));

// Extract keys from the credentials
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = credentials.installed;

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});


// POST endpoint to create a Razorpay order and update booking amount in Firestore
router.post('/create-order', async (req, res) => {
  try {
    const { booking_id, amount, currency = 'INR' } = req.body; // Default currency is 'INR'

    if (!booking_id || !amount) {
      return res.status(400).json({ error: 'Booking ID and amount are required' });
    }

    // Convert amount to smallest currency unit (paise for INR)
    const unitAmount = Math.round(amount * 100);

    const data = await db.collection("booking").where("booking_id", "==", booking_id).get();

    // Check if the query returned any documents
    if (data.empty) {
      return res.status(404).send({ error: `No booking found with booking_id: ${booking_id}` });
    }
    
    // Map through the documents and extract their data
    const snapshot = data.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    
    // Fetch the first matching document's ID (assuming booking_id is unique)
    const docId = snapshot[0].id;
    
    // Update fields in the booking document
    await db.collection('booking').doc(docId).update({ 
      amount:amount,
    });

    // Create a Razorpay order
    const order = await razorpay.orders.create({
      amount:unitAmount,
      currency,
      receipt: `receipt_${Date.now()}`, // A unique receipt identifier
    });

    // Respond with the order ID
    res.status(200).json({ orderId: order.id });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to handle payment success and update `amount_status` in Firestore
router.get('/payment-success', async (req, res) => {
  try {
    var { booking_id } = req.query;
    booking_id=Number(booking_id);

    if (!booking_id) {
      return res.status(400).json({ error: 'Booking ID and payment ID are required' });
    }

    const data = await db.collection("booking").where("booking_id", "==", booking_id).get();

    // Check if the query returned any documents
    if (data.empty) {
      return res.status(404).send({ error: `No booking found with booking_id: ${booking_id}` });
    }
    
    // Map through the documents and extract their data
    const snapshot = data.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    
    // Fetch the first matching document's ID (assuming booking_id is unique)
    const docId = snapshot[0].id;

    // Update fields in the booking document
    await db.collection('booking').doc(docId).update({ 
      amount_status:true,
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Confirmation</title>
        <style>
          body {
            margin: 0;
            font-family: 'Arial', sans-serif;
            background-color: #f7faff;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            overflow: hidden;
          }
          .container {
            text-align: center;
            background: #fff;
            padding: 40px 30px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            animation: slideIn 1s ease-out;
          }
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(50px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .success-image {
            width: 150px;
            margin-bottom: 20px;
            animation: pop 1.5s ease-in-out infinite;
          }
          @keyframes pop {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.1);
            }
          }
          .message {
            font-size: 20px;
            color: #333;
            margin-bottom: 15px;
          }
          .details {
            font-size: 16px;
            color: #666;
            margin-bottom: 20px;
          }
          .button {
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 16px;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s;
            text-decoration: none;
          }
          .button:hover {
            background-color: #45a049;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <img src="https://i.pinimg.com/originals/0d/e4/1a/0de41a3c5953fba1755ebd416ec109dd.gif" 
               alt="Success" 
               class="success-image" />
          <div class="message">Payment Successful!</div>
          <div class="details">Thank you for choosing Zholidays. You can close this Page.</div>
        </div>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Error updating booking after payment:', error);
    res.status(500).json({ error: error.message });
  }
});


router.get('/payment-form', async (req, res) => {
  try {
    const { orderId, booking_id } = req.query;

    if (!orderId || !booking_id) {
      return res.status(400).send('Order ID and Booking ID are required');
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Zholidays Payment</title>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <style>
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background-color: #f0f8ff; /* Light blue background */
            color: #333;
          }
          .container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            padding: 20px;
          }
          .payment-box {
            text-align: center;
            background-color: white;
            padding: 25px 35px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            width: 100%;
          }
          .payment-box h1 {
            margin: 0 0 15px;
            font-size: 26px;
            color: #0078D7; /* Blue primary color */
          }
          .payment-box p {
            margin: 0 0 20px;
            font-size: 16px;
            color: #555;
          }
          .payment-box button {
            background-color: #0078D7; /* Blue button color */
            color: white;
            border: none;
            padding: 12px 20px;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.3s, transform 0.2s;
          }
          .payment-box button:hover {
            background-color: #005BB5; /* Darker blue on hover */
            transform: translateY(-2px);
          }
          .footer {
            position: fixed;
            bottom: 10px;
            width: 100%;
            text-align: center;
            color: #0078D7;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="payment-box">
            <h1>Zholidays Payment</h1>
            <p>Secure your booking with our safe and reliable payment gateway.</p>
            <button id="rzp-button">Pay Now</button>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Zholidays. All Rights Reserved.
        </div>
        <script>
          const options = {
            key: "${RAZORPAY_KEY_ID}",
            order_id: "${orderId}",
            handler: async function (response) {
              // alert("Payment successful! Payment ID: " + response.razorpay_payment_id);
              window.location.href='https://tour-node-8wh0.onrender.com/razor/payment-success?booking_id=${booking_id}'
            },
            theme: {
              color: "#0078D7",
            },
          };

          const rzp = new Razorpay(options);

          document.getElementById('rzp-button').onclick = function (e) {
            rzp.open();
            e.preventDefault();
          };
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error rendering payment form:', error);
    res.status(500).send('Internal Server Error');
  }
});


module.exports = router;
