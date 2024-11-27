const express = require('express');
const bodyParser = require('body-parser');
const { db } = require('../config/firebaseConfig')
const router = express.Router();
const axios = require('axios')

const app = express();


app.use(bodyParser.json());

router.post('/get-id',async(req,res)=>{
    const email = req.body.email;
    const visitorSnapshot = await db.collection("visitors")
            .where("email", "==", email)
            .limit(1)
            .get();

        if (!visitorSnapshot.empty) {
            const vdata = await db.collection("visitors").where("email", "==", email).get();
            const vlist = vdata.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
            var visitor_id = vlist[0].visitor_id
            res.send({ id:visitor_id, status: "200" });
        }
        else{
            res.send({ id:0, status: "400" });
        }

})

router.post('/get-name', async (req, res) => {
    const { email } = req.body;

    try {
        // Step 1: Fetch visitor document based on the provided email
        const visitorRef = await db.collection("visitors").where("email", "==", email).get();

        // Check if the visitor exists
        if (visitorRef.empty) {
            return res.status(404).send({ msg: "Visitor not found with the provided email." });
        }

        const visitorData = visitorRef.docs[0].data(); // Assuming `email` is unique

        // Step 2: Check if `name` and `phoneno` are non-null
        if (visitorData.name && visitorData.phone) {
            return res.status(200).send({
                msg: "Visitor details fetched successfully.",
                data: { name: visitorData.name, phone: visitorData.phone },
                status:"200",
            });
        } else {
            return res.status(201).send({
                msg: "Visitor details are incomplete (name or phone is null).",
                data: { name: visitorData.name || null, phone: visitorData.phone || null },
                status:"201",
            });
        }
    } catch (error) {
        // Handle unexpected errors
        return res.status(500).send({
            msg: "Failed to fetch visitor details.",
            error: error.message,
        });
    }
});


router.post('/update-name', async (req, res) => {
    const { email, name, phone } = req.body;

    try {
        // Step 1: Get the document reference for the visitor with the given email
        const visitorRef = await db.collection("visitors").where("email", "==", email).get();

        // Check if the visitor exists
        if (visitorRef.empty) {
            return res.status(400).send({ msg: "Visitor not found with the provided email." });
        }

        // Step 2: Update the visitor's name and phone number
        const visitorDocId = visitorRef.docs[0].id; // Assuming `email` is unique
        await db.collection("visitors").doc(visitorDocId).update({
            name,
            phone
        });

        // Step 3: Send success response
        return res.status(200).send({ msg: "Visitor details updated successfully!" ,status:"200"  });
    } catch (error) {
        // Step 4: Handle errors
        return res.status(400).send({ msg: "Failed to update visitor details.", error: error.message ,status:"400"  });
    }
});


router.post('/verify-oauth', async (req, res) => {
    const email = req.body.email;

    try {
        const visitorSnapshot = await db.collection("visitors")
            .where("email", "==", email)
            .where("oauth_verified","==",true)
            .limit(1)
            .get();

        if (!visitorSnapshot.empty) {
            res.status(200).send({ msg: "verified", status: "200" });
        } 
        else {
           res.status(200).send({
                msg: "not verified",
                status: "201",
            });
        }
    } catch (error) {
        console.error("Error checking email:", error);
        res.status(500).send({ msg: "Error checking email.", error: error.message });
    }
})



router.post('/verify-email', async (req, res) => {
    const email = req.body.email;

    try {
        const visitorSnapshot = await db.collection("visitors")
            .where("email", "==", email)
            .limit(1)
            .get();

        if (!visitorSnapshot.empty) {
            res.status(200).send({ msg: "visitor already exists!", status: "200" });
        } else {
            // Generate random 6-digit OTP
            const randomOtp = Math.floor(100000 + Math.random() * 900000);

            // Find the highest visitor_id and increment
            const allVisitorsSnapshot = await db.collection("visitors").orderBy("visitor_id", "desc").limit(1).get();
            const maxVisitorId = allVisitorsSnapshot.empty ? 0 : allVisitorsSnapshot.docs[0].data().visitor_id;
            const newVisitorId = maxVisitorId + 1;

            // Create the new visitor object
            const newVisitor = {
                visitor_id: newVisitorId,
                name: "",
                email: email, // Use the provided email
                phone: "", // Default empty or use input data if available
                otp_verified: false,
                oauth_verified: false,
                otp: randomOtp,
            };

            // Save the new visitor to the "visitors" collection
            await db.collection("visitors").add(newVisitor);

            res.status(200).send({
                msg: "New visitor created successfully.",
                status: "201",
                visitor_details: newVisitor,
            });
        }
    } catch (error) {
        console.error("Error checking email:", error);
        res.status(500).send({ msg: "Error checking email.", error: error.message });
    }
})

router.post('/send-otp', async (req, res) => {
    const { phoneNumber } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000); // Generates a 6-digit OTP

       // Query the visitors collection for the matching phone number
       const visitorQuery = await db.collection("visitors").where("phone", "==", phoneNumber).get();

       if (visitorQuery.empty) {
           return res.status(404).json({ error: "Visitor with this phone number not found" });
       }
   
       // Assuming phone numbers are unique, fetch the first matching document
       const visitorDoc = visitorQuery.docs[0];
       const visitorId = visitorDoc.id;
   
       // Update the OTP in the matching visitor document
       await db.collection("visitors").doc(visitorId).update({ otp });

    try {
        const response = await sendOtpSms(phoneNumber, otp);
        res.status(200).json({ status:"200", message: 'OTP sent successfully', otp });
    } catch (error) {
        res.status(500).json({ status:"400", message: 'Failed to send OTP' });
    }
});

const sendOtpSms = async (phoneNumber, otp) => {
    const apiKey = 'vPf9areEM3yniNZ6QBcSd0glKosYC2HzRbDGpJ1kTI4wxOjUhFBrRLA0KqhvltCjWzpTU43afoPMX1G8';
    const message = `Your OTP for cab booking is ${otp}`;

    try {
        const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
            route: 'v3',
            sender_id: 'TXTIND',
            message: message,
            language: 'english',
            flash: 0,
            numbers: phoneNumber,
        }, {
            headers: {
                'authorization': apiKey,
                'Content-Type': 'application/json'
            }
        });

        console.log('SMS sent successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error sending SMS:', error.response ? error.response.data : error.message);
        throw error;
    }
};

router.post('/verify-otp', async (req, res) => {
    const { email, otp, booking_id } = req.body;

    try {
        // Step 1: Fetch the visitor document with the matching phone number
        const visitorQuery = await db.collection("visitors").where("email", "==",email).get();

        if (visitorQuery.empty) {
            return res.status(404).json({ error: "Visitor with this phone number not found" });
        }

        // Assuming phone numbers are unique, fetch the first matching document
        const visitorDoc = visitorQuery.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        // const visitorData = visitorDoc.data();
        
        // Step 2: Verify the OTP
        if (visitorDoc[0].otp !== otp) {
            return res.status(400).json({ error: "Invalid OTP" });
        }

        // Step 3: Mark `otp_verified` as true in the visitor document
        const visitorId = visitorDoc[0].visitor_id;
    
        // await db.collection("visitors").doc(visitorId).update({ otp_verified: true });

        // Step 4: Fetch the booking with matching `visitor_id` and `booking_id`
        const bookingQuery = await db.collection("booking")
            .where("visitor_id", "==", visitorId)
            .where("booking_id", "==", booking_id)
            .get();

        if (bookingQuery.empty) {
            return res.status(404).json({ error: "No booking found with this visitor and booking ID" });
        }

        // Assuming booking_id is unique, update the first matching booking
        const bookingDoc = bookingQuery.docs[0];
        await db.collection("booking").doc(bookingDoc.id).update({ otp_verified: true });

        // Step 5: Respond with success
        res.status(200).json({
            message: "OTP verified successfully and updated in both visitors and the specific booking",
            status:"200"
        });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


router.post('/fetch-order-amount', async (req, res) => {
    const { email, booking_id } = req.body;

    try {
        // Step 1: Fetch the visitor document using the email
        const visitorQuery = await db.collection("visitors").where("email", "==",email).get();

        if (visitorQuery.empty) {
            return res.status(404).json({ error: "Visitor with this email not found" });
        }

        // Assuming email is unique, fetch the first matching document
        const visitorDoc = visitorQuery.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const visitorId = visitorDoc[0].visitor_id; // Get the visitor ID from the document

        // Step 2: Fetch the booking document using the visitor_id and booking_id
        const bookingQuery = await db.collection("booking")
            .where("visitor_id", "==", visitorId)
            .where("booking_id", "==", booking_id)
            .get();

        if (bookingQuery.empty) {
            return res.status(404).json({ error: "No booking found with this visitor ID and booking ID" });
        }

        // Assuming booking_id is unique, fetch the first matching document
        const bookingDoc = bookingQuery.docs[0];
        const { amount } = bookingDoc.data(); // Extract the amount from the booking document

        // Step 3: Respond with the amount
        res.status(200).json({
            message: "Amount fetched successfully",
            total_amount:amount
        });
    } catch (error) {
        console.error("Error fetching order amount:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


router.post('/verify-amount', async (req, res) => {
    const { email, booking_id } = req.body;

    try {
        // Step 1: Fetch the visitor document using the email
        const visitorQuery = await db.collection("visitors").where("email", "==", email).get();

        if (visitorQuery.empty) {
            return res.status(404).json({ error: "Visitor with this email not found" });
        }

        // Assuming email is unique, fetch the first matching document
        const visitorDoc = visitorQuery.docs[0];
        const visitorId = visitorDoc.id; // Get the visitor ID from the document

        // Step 2: Fetch the booking document using the visitor_id and booking_id
        const bookingQuery = await db.collection("booking")
            .where("visitor_id", "==", visitorId)
            .where("booking_id", "==", booking_id)
            .get();

        if (bookingQuery.empty) {
            return res.status(404).json({ error: "No booking found with this visitor ID and booking ID" });
        }

        // Assuming booking_id is unique, fetch the first matching document
        const bookingDoc = bookingQuery.docs[0];
        const { amount_status } = bookingDoc.data(); // Extract the amount_status from the booking document

        // Step 3: Return appropriate response based on amount_status
        if (amount_status) {
            return res.status(200).json({ message: "Amount has been verified", status:"200" });
        } else {
            return res.status(204).json({ message: "Amount is not yet verified", status:"204" });
        }
    } catch (error) {
        console.error("Error verifying amount status:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});



module.exports = router