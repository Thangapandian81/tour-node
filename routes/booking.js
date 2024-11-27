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
    const { visitor_id, visitor_email, package_id, booking_date, amount_status } = req.body;
    const currentTimestamp = new Date().toISOString();
  
    // Ensure booking_date is valid
    if (!booking_date) {
      return res.status(400).send({ error: 'Booking date is required.' });
    }
  
    try {
      console.log(package_id)
      // Fetch package details from Firestore
    //   const packageSnapshot = await db.collection("packages").get();
  
    //   if (!packageSnapshot.exists) {
    //     return res.status(404).send({ error: 'Package not found!' });
    //   }
    const data= await db.collection("packages").where("package_id","==",package_id).get();
    const list=data.docs.map((doc)=> ({id:doc.id, ...doc.data()}))
      const packageDetails =list[0];

      const itinerary = packageDetails.itinerary;

// Create an itinerary description string
let itineraryDescription = "";
itinerary.forEach(day => {
  itineraryDescription += `Day ${day.day}: ${day.activities.join(", ")}\n`;
});

    //   console.log(packageDetails)
    //   res.send(packageDetails)
    //   process.exit();
  
      // Get the last booking document to auto-increment booking_id
      const lastBookingSnapshot = await db.collection('booking')
        .orderBy('booking_id', 'desc')
        .limit(1)
        .get();
  
      let nextBookingId = 1;
      if (!lastBookingSnapshot.empty) {
        const lastBookingId = lastBookingSnapshot.docs[0].data().booking_id;
        nextBookingId = lastBookingId + 1;
      }
  
      // Add booking data to Firestore
      const bookingRef = await db.collection('booking').add({
        booking_id: nextBookingId,
        visitor_id,
        visitor_email,
        package_id,
        // package_category: packageDetails.package_category,
        // pricePerPerson: packageDetails.pricePerPerson,
        booking_date,
        amount_status: amount_status || false,
        created_at: currentTimestamp,
      });
  
      // Create a Google Calendar event
      const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  
      const event = {
        summary: `Booking: ${packageDetails.package_name}`,
        location: packageDetails.destination,
        description: `Booking for package: ${packageDetails.package_name}.\nDetails: ${itineraryDescription}`,
        start: {
          dateTime: new Date(booking_date).toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: new Date(new Date(booking_date).getTime() + 3600000).toISOString(), // 1-hour duration
          timeZone: 'Asia/Kolkata',
        },
        attendees: [
          { email: visitor_email },
        ],
      };
  
      // Insert event into Google Calendar
      calendar.events.insert(
        {
          calendarId: 'primary',
          resource: event,
        },
        (err, eventResponse) => {
          if (err) {
            console.error('Error adding event to Google Calendar:', err.message);
            return res.status(500).send({ error: 'Failed to add event to calendar.' });
          }
          console.log('Event created:', eventResponse.data.htmlLink);

          // Generate PDF Invoice
        const doc = new PDFDocument();
        const invoicePath = `./invoices/booking_${nextBookingId}.pdf`;
        doc.pipe(fs.createWriteStream(invoicePath));
        doc.fontSize(16).text(`Booking Invoice`, { align: 'center' });
        doc.moveDown();
        doc.text(`Booking ID: ${nextBookingId}`);
        doc.text(`Package Name: ${packageDetails.package_name}`);
        doc.text(`Visitor Email: ${visitor_email}`);
        doc.text(`Booking Date: ${booking_date}`);
        doc.text(`Amount Status: Not Paid`);
        doc.end();

        // Send Email with Invoice
        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user:email, pass:pass } });
        const mailOptions = {
            from:email,
            to: visitor_email,
            subject: `Booking Confirmation: ${packageDetails.package_name}`,
            text: `Your booking has been confirmed. Please find the invoice attached.`,
            attachments: [{ filename: `booking_${nextBookingId}.pdf`, path: invoicePath }],
        };

        transporter.sendMail(mailOptions);
  
          // Send success response
          res.status(201).send({
            message: 'Booking created and added to Google Calendar.',
            bookingId: bookingRef.id,
            calendarEventLink: eventResponse.data.htmlLink,
          });
        }
      );
    } catch (error) {
      console.error('Error creating booking:', error.message);
      res.status(500).send({ error: error.message });
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