const express = require('express');
const { oAuth2Client } = require('../googleCalendar');
const bodyParser = require('body-parser');
const {db}=require('../config/firebaseConfig')
const { google } = require('googleapis');
const fs=require('fs')
const path=require('path')
const router = express.Router();
const PDFDocument = require('pdfkit');
const nodemailer= require('nodemailer')
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'mail.json')));

const {email,pass}=credentials.installed;

const app = express();

app.use(bodyParser.json());

router.post('/create-booking', async (req, res) => {
  try {
    // Extract data from the request
    const { date_time, time_zone_id } = req.body.booking_date; // Get booking_date object
    const { email, no_person, package_id } = req.body;

    const data = await db.collection("packages").where("package_id", "==", package_id).get();

// Map the documents to an array with their IDs and data
const snapshot = data.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

if (snapshot.length === 0) {
  // If no documents are found
  return res.status(404).send({ error: `No package found with package_id: ${package_id}` });
}

// Assuming package_id is unique, fetch the first matching document
var per_person = snapshot[0].budget;

    // Calculate the amount
    const amount = no_person * per_person;

    // Fetch visitor_id using the provided email
    const visitorQuery = await db.collection('visitors').where('email', '==', email).get();
    const visitorData = visitorQuery.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    if (visitorQuery.empty) {
      return res.status(404).json({ error: 'Visitor not found' });
    }
    const visitor_id = visitorData[0].visitor_id;

    // Convert booking_date to Asia/Kolkata timezone
    const bookingDateInIST = moment.tz(date_time, time_zone_id).tz('Asia/Kolkata').format();


    const lastBookingSnapshot = await db.collection("booking")
    .orderBy("booking_id", "desc") // Sort by booking_id in descending order
    .limit(1) // Get only the latest booking
    .get();

// Default to 1 if no bookings are found
let nextBookingId = 1;
if (!lastBookingSnapshot.empty) {
    const lastBookingId = lastBookingSnapshot.docs[0].data().booking_id;
    nextBookingId = lastBookingId + 1; // Increment the last booking_id by 1
}

    // Prepare booking data
    const bookingData = {
      booking_id: nextBookingId,
      booking_date: bookingDateInIST,
      no_person,
      package_id,
      amount,
      amount_status: false,
      otp_verified:false,
      visitor_email: email,
      visitor_id,
      created_at: moment().tz('Asia/Kolkata').format() // Current timestamp in IST
    };

    // Add booking to the 'bookings' collection
    const bookingRef = await db.collection('booking').add(bookingData);

    // Send success response
    res.status(201).json({
      message: 'Booking created successfully',
      booking_id: bookingRef.id,
      booking_data: bookingData
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

  

router.post('/update-booking',async(req,res)=>{
    
})

router.post('/get-booking',async(req,res)=>{
  const { email } = req.body;

try {
    // Step 1: Get the visitor ID using the email
    const visitorDetails = await db.collection("visitors").where("email", "==", email).get();
    const visitorSnapshot = visitorDetails.docs.map(doc => doc.data())[0];

    if (!visitorSnapshot) {
        return res.status(404).send({ msg: "Booking not found with the provided email." });
    }

    const visitorId = visitorSnapshot.visitor_id;

    // Step 2: Get booking details using the visitor ID
    const bookingSnapshot = await db.collection("booking")
        .where("visitor_id", "==", visitorId)
        .get();

    if (bookingSnapshot.empty) {
        return res.status(404).send({ msg: "No bookings found for the provided visitor." });
    }

    // Extract `package_id` list from booking entries
    const bookList = bookingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const packageIds = bookList.map(booking => booking.package_id);

    if (packageIds.length === 0) {
        return res.status(404).send({ msg: "No package IDs found in booking records for the visitor." });
    }

    // Step 3: Fetch packages from the `packages` table
    const packageDetails = await db.collection("packages")
        .where("package_id", "in", packageIds)
        .get();

    if (packageDetails.empty) {
        return res.status(404).send({ msg: "No packages found for the provided package IDs." });
    }

    // Map the package details into a list
    const packageList = packageDetails.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Step 4: Send the package list as a response
    res.status(200).send({
        msg: "Packages fetched successfully!",
        packages: packageList,
    });
} catch (error) {
    res.status(500).send({ msg: "Failed to fetch packages.", error: error.message });
}

})

router.post("/sample-book",async (req,res)=>{
  const data=req.body;
  // console.log(data) 
  await db.collection("book").add(data)
  if (res.statusCode==200)
  {
      res.send({msg:"jechitom mara!"})
  }
  else{
      res.send({msg:"vanakam da mapla else la irrunthu"})
  }
}) 

module.exports = router