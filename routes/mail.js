const express = require('express');
const fs = require('fs')
const path = require('path')
const {db}=require('../config/firebaseConfig')
const nodemailer = require('nodemailer');
const router = express.Router();
const app = express();
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'mail.json')));

const { email, pass } = credentials.installed;
// Middleware to parse JSON bodies
app.use(express.json());

// Nodemailer transporter configuration (using Gmail in this example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: email,
    pass: pass
  }
});

// Route to send promotional email
router.post('/send-email', async (req, res) => {
  const { recipientEmail } = req.body;
  var visitor_id=""
  // Fetch visitor document where email matches recipientEmail
  const visitorSnapshot = await db.collection("visitors").where("email", "==", recipientEmail).get();

  if (!visitorSnapshot.empty) {
    // Extract visitor_id from the first matching document
    const visitorDoc = visitorSnapshot.docs[0];
    visitor_id = visitorDoc.data().visitor_id;

    console.log("Fetched visitor_id:", visitor_id);

    // You can now use visitor_id as needed
    // Example: res.status(200).send({ visitor_id });
  } else {
    // If no matching visitor is found
    res.status(404).send({ msg: "Visitor not found", status: "404" });
  }


  var subject = 'Oauth Verification Link'
  var message = `http://localhost:3000/auth/google?visitor_id=${visitor_id}`

  // Setting up email data (subject, body, etc.)
  const mailOptions = {
    from: email, // sender address
    to: recipientEmail, // recipient address
    subject: subject, // email subject
    text: message, // email body text
    html: `<p>${message}</p>`, // email body in HTML format
    headers: {
      'X-Importance': 'high', // mark as important (optional)
      'X-Precedence': 'bulk' // avoid spam filters (optional)
    }
  };

  // Send email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      return res.status(500).send('Error sending email');
    } else {
      console.log('Email sent: ' + info.response);
      return res.status(200).send('Email sent successfully');
    }
  });
});

module.exports = router;