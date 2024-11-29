const express = require('express');
const bodyParser = require('body-parser');
const {db}=require('../config/firebaseConfig')
const router = express.Router();

const app = express();

app.use(bodyParser.json()); 

router.post('/create-lead', async (req, res) => {
    var { email, package_id } = req.body;
    package_id=Number(package_id);
    
    const currentTimestamp = new Date().toISOString();

    try {
        // Get the visitor_id using the email
        const visitorDetails = await db.collection("visitors").where("email", "==", email).get();
        const visitorSnapshot = visitorDetails.docs.map(doc => doc.data())[0];

        if (visitorSnapshot.empty) {
            return res.status(404).send({ msg: "Visitor not found with the provided email." });
        }
        
        const visitorId = visitorSnapshot.visitor_id;
    
        // Get the last lead to auto-increment lead_id
        const lastLeadSnapshot = await db.collection("leads")
            .orderBy("lead_id", "desc")
            .limit(1)
            .get();

        // Determine the next lead_id
        let nextLeadId = 1;
        if (!lastLeadSnapshot.empty) {
            const lastLeadId = lastLeadSnapshot.docs[0].data().lead_id;
            nextLeadId = lastLeadId + 1;
        }

        // Prepare the new lead data
        const newLead = {
            lead_id: nextLeadId,
            visitor_id: visitorId,
            lead_status:true,
            package_id: package_id,
            created_at: currentTimestamp
        };

        // Add the new lead to the "leads" collection
        await db.collection("leads").add(newLead);

        res.status(200).send({ msg: "Lead created successfully!", lead_id: nextLeadId });
    } catch (error) {
        res.status(500).send({ msg: "Lead creation failed!", error: error.message });
    }
});

router.post('/get-lead', async (req, res) => {
    const { email } = req.body;

    try {
        // Step 1: Get the visitor ID using the email
        const visitorDetails = await db.collection("visitors").where("email", "==", email).get();
        const visitorSnapshot = visitorDetails.docs.map(doc => doc.data())[0];
    
        if (!visitorSnapshot) {
            return res.status(404).send({ msg: "Visitor not found with the provided email." });
        }
    
        const visitorId = visitorSnapshot.visitor_id;
    
        // Step 2: Get the lead details using the visitor ID
        const leadsSnapshot = await db.collection("leads")
            .where("visitor_id", "==", visitorId)
            .where("lead_status","==",true)
            .get();
    
        if (leadsSnapshot.empty) {
            return res.status(404).send({ msg: "No leads found for the provided visitor." });
        }
    
        // Extract `package_id` list from leads
        const leadList = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const packageIds = leadList.map(lead => lead.package_id);
    
        if (packageIds.length === 0) {
            return res.status(404).send({ msg: "No package IDs found in leads for the visitor." });
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
        if(!packageList.empty)
        {
        res.status(200).send({
            msg: "Packages fetched successfully!",
            packages: packageList,
        });
    }
    else{
        res.status(404).send({
            msg: "No Package Found",
            packages: "No Lead Found",
        });
    }
    } catch (error) {
        res.status(500).send({ msg: "Failed to fetch packages.", error: error.message });
    }
    
});

router.post('/delete-lead',async(req,res)=>{
    var { email, package_id } = req.body;
    package_id = Number(package_id);
    
    try {
        // Get the visitor_id using the email
        const visitorDetails = await db.collection("visitors").where("email", "==", email).get();
        const visitorSnapshot = visitorDetails.docs.map(doc => doc.data())[0];
    
        if (visitorDetails.empty) {
            return res.status(404).send({ msg: "Visitor not found with the provided email." });
        }
    
        const visitorId = visitorSnapshot.visitor_id;
    
        // Find the lead in the "leads" collection
        const leadDetails = await db.collection("leads")
            .where("visitor_id", "==", visitorId)
            .where("package_id", "==", package_id)
            .get();
    
        if (leadDetails.empty) {
            return res.status(404).send({ msg: "No lead found with the provided details." });
        }
    
        // Delete the lead(s)
        const batch = db.batch();
        leadDetails.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    
        res.status(200).send({ msg: "Lead(s) deleted successfully!" });
    } catch (error) {
        res.status(500).send({ msg: "Failed to delete lead!", error: error.message });
    }
    
})





module.exports = router