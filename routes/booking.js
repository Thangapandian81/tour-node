const express = require('express');
const { oAuth2Client } = require('../googleCalendar');
const bodyParser = require('body-parser');
const {db}=require('../config/firebaseConfig')
const { google } = require('googleapis');
const fs=require('fs')
const path=require('path')
const router = express.Router();
const moment = require('moment-timezone');
const PDFDocument = require('pdfkit');
const nodemailer= require('nodemailer')
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'mail.json')));

const {aemail,apass}=credentials.installed;

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
var Title=snapshot[0].package_name;

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

    // Generate PDF Invoice
    const invoicePath = `./invoices/booking_${nextBookingId}.pdf`;
const doc = new PDFDocument({ size: 'A4', margin: 50 });

// Background Color for Header Section
doc.rect(0, 0, doc.page.width, 150).fill('#E3F2FD'); // Light blue background for the header

// Header Section: Company Details
const companyName = "Zholidays";
const companyAddress = "Zoho Coporation";
const companyPhone = "+91-9159097924";
const companyEmail = "contact@cliqtrix.com";

doc.fill('#01579B') // Dark blue for header text
  .fontSize(20)
  .text(companyName, { align: 'center', lineGap: 5 })
  .fontSize(12)
  .text(companyAddress, { align: 'center' })
  .text(`Phone: ${companyPhone} | Email: ${companyEmail}`, { align: 'center',lineGap:10 })
  .moveDown();

// Title Section
doc.fill('#000').fontSize(16).text('Booking Invoice', { align: 'center' }).moveDown();

// Add a Line Below Header
// doc.moveTo(50, 120).lineTo(550, 120).stroke('#B0BEC5');

// Booking Details in Table Format
doc.fontSize(12).moveDown().text('Booking Details:', { underline: true }).moveDown();

// Table Header
doc.fill('#01579B') // Dark blue for header background
  .rect(50, doc.y, 500, 20).fill()
  .fillColor('#FFF')
  .text('Field', 60, doc.y + 5)
  .text('Details', 300, doc.y + 5);

// Table Content
const fields = [
  // { field: 'Booking ID', details: booking_id },
  { field: 'Package Name', details: Title },
  { field: 'Visitor Email', details: email },
  { field: 'Booking Date', details: bookingDateInIST },
  { field:  'Amount Per person', details:`Rs.${per_person.toFixed(2)}`},
  {field:  'No of Person', details:no_person},
  { field: 'Total Amount', details: `Rs.${amount.toFixed(2)}` },
  { field: 'Amount Status', details: 'Not Paid' },
];

let yPosition = doc.y + 25;
doc.fill('#000'); // Reset text color to black

fields.forEach(({ field, details }) => {
  doc.text(field, 60, yPosition)
    .text(details, 300, yPosition);
  yPosition += 20;
});

// Footer Section
doc.moveDown().moveTo(50, 750).lineTo(550, 750).stroke('#B0BEC5');

doc.fontSize(10)
  .fill('#000')
  .text('Thank you for booking with Zholidays!', 50, 760, { align: 'center' })
  .text('For any enquiries, contact us at contact@cliqtrix.com', 50, 775, { align: 'center' });

// End Document
doc.end();


    // Save the invoice
    const fs = require('fs');
    doc.pipe(fs.createWriteStream(invoicePath));

    // Send Email with Invoice
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: aemail, pass: apass },
    });

    const mailOptions = {
      from:aemail,
      to: email,
      subject: `Booking Confirmation: ${Title}`,
      text: `Your booking has been confirmed. Please find the invoice attached.`,
      attachments: [{ filename: `booking_${booking_id}.pdf`, path: invoicePath }],
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Error sending email:', err.message);
        return res.status(500).send({ error: 'Failed to send email.' });
      }

      console.log('Email sent:', info.response);
    });


    

    // Send success response
    res.status(201).json({
      message: 'Booking created successfully', status:"201" ,booking_id: nextBookingId
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
        return res.status(404).send({ msg: "No packages found for the provided package IDs.",packages:"No Booking Found!" });
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

router.post('/create-event', async (req, res) => {
  const { email, booking_id } = req.body;

  try {
    // Fetch booking details from Firestore
    const bookingSnapshot = await db.collection('booking')
      .where('booking_id', '==', booking_id)
      .where('visitor_email', '==', email)
      .get();

    if (bookingSnapshot.empty) {
      return res.status(404).send({ error: 'Booking not found!' });
    }

    const bookingData = bookingSnapshot.docs[0].data();
    const { package_id, booking_date, amount,no_person } = bookingData;

    // Fetch package details from Firestore
    const packageSnapshot = await db.collection('packages')
      .where('package_id', '==', package_id)
      .get();

    if (packageSnapshot.empty) {
      return res.status(404).send({ error: 'Package details not found!' });
    }

    const packageDetails = packageSnapshot.docs[0].data();
    const { package_name, destination, itinerary,budget } = packageDetails;

    // Create an itinerary description string
    let itineraryDescription = "";
    itinerary.forEach(day => {
      itineraryDescription += `Day ${day.day}: ${day.activities.join(", ")}\n`;
    });

    // Create a Google Calendar event
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const event = {
      summary: `Booking: ${package_name}`,
      location: destination,
      description: `Package Details:\n${itineraryDescription}`,
      start: {
        dateTime: new Date(booking_date).toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: new Date(booking_date).toISOString(), // Same as start time
        timeZone: 'Asia/Kolkata',
      },
      attendees: [
        { email },
      ],
    };

    const eventResponse = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    console.log('Event created:', eventResponse.data.htmlLink);

    // Generate PDF Invoice
    const invoicePath = `./invoices/booking_${booking_id}.pdf`;
const doc = new PDFDocument({ size: 'A4', margin: 50 });

// Background Color for Header Section
doc.rect(0, 0, doc.page.width, 150).fill('#E3F2FD'); // Light blue background for the header

// Header Section: Company Details
const companyName = "Zholidays";
const companyAddress = "Zoho Coporation";
const companyPhone = "+91-9159097924";
const companyEmail = "contact@cliqtrix.com";

doc.fill('#01579B') // Dark blue for header text
  .fontSize(20)
  .text(companyName, { align: 'center', lineGap: 5 })
  .fontSize(12)
  .text(companyAddress, { align: 'center' })
  .text(`Phone: ${companyPhone} | Email: ${companyEmail}`, { align: 'center',lineGap:10 })
  .moveDown();

// Title Section
doc.fill('#000').fontSize(16).text('Booking Invoice', { align: 'center' }).moveDown();

// Add a Line Below Header
// doc.moveTo(50, 120).lineTo(550, 120).stroke('#B0BEC5');

// Booking Details in Table Format
doc.fontSize(12).moveDown().text('Booking Details:', { underline: true }).moveDown();

// Table Header
doc.fill('#01579B') // Dark blue for header background
  .rect(50, doc.y, 500, 20).fill()
  .fillColor('#FFF')
  .text('Field', 60, doc.y + 5)
  .text('Details', 300, doc.y + 5);

// Table Content
const fields = [
  // { field: 'Booking ID', details: booking_id },
  { field: 'Package Name', details: package_name },
  { field: 'Visitor Email', details: email },
  { field: 'Booking Date', details: booking_date },
  { field:  'Amount Per person', details:`Rs.${budget.toFixed(2)}`},
  {field:  'No of Person', details:no_person},
  { field: 'Total Amount', details: `Rs.${amount.toFixed(2)}` },
  { field: 'Amount Status', details: 'Paid' },
];

let yPosition = doc.y + 25;
doc.fill('#000'); // Reset text color to black

fields.forEach(({ field, details }) => {
  doc.text(field, 60, yPosition)
    .text(details, 300, yPosition);
  yPosition += 20;
});

// Footer Section
doc.moveDown().moveTo(50, 750).lineTo(550, 750).stroke('#B0BEC5');

doc.fontSize(10)
  .fill('#000')
  .text('Thank you for booking with Zholidays!', 50, 760, { align: 'center' })
  .text('For any enquiries, contact us at contact@cliqtrix.com', 50, 775, { align: 'center' });

// End Document
doc.end();


    // Save the invoice
    const fs = require('fs');
    doc.pipe(fs.createWriteStream(invoicePath));

    // Send Email with Invoice
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: aemail, pass: apass },
    });

    const mailOptions = {
      from:aemail,
      to: email,
      subject: `Booking Confirmation: ${package_name}`,
      text: `Your booking has been confirmed. Please find the invoice attached.`,
      attachments: [{ filename: `booking_${booking_id}.pdf`, path: invoicePath }],
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Error sending email:', err.message);
        return res.status(500).send({ error: 'Failed to send email.' });
      }

      console.log('Email sent:', info.response);

      // Send success response
      res.status(200).send({
        message: 'Event created, invoice generated, and email sent.',
        calendarEventLink: eventResponse.data.htmlLink,
      });
    });
  } catch (error) {
    console.error('Error in /create-event:', error.message);
    res.status(500).send({ error: error.message });
  }
});


module.exports = router