const express = require('express');
const bodyParser = require('body-parser');
const {db}=require('../../config/firebaseConfig')
const router = express.Router();
const amadeus= require("amadeus");

const app = express();

app.use(bodyParser.json());

router.post('/add-package',async (req,res)=>{
    const data = req.body;
const currentTimestamp = new Date().toISOString();

try {
    // Get the last document to auto-increment package_id
    const lastPackageSnapshot = await db.collection("packages")
        .orderBy("package_id", "desc")
        .limit(1)
        .get();

    // Determine the next package_id
    let nextPackageId = 1;
    if (!lastPackageSnapshot.empty) {
        const lastPackageId = lastPackageSnapshot.docs[0].data().package_id;
        nextPackageId = lastPackageId + 1;
    }

    // Prepare the new package data
    const newPackage = {
        package_id: nextPackageId,
        package_name: data.package_name,
        package_category: data.cat_id,
        duration: data.duration,
        pricePerPerson: data.pricePerPerson,
        destination: data.destination,
        itinerary: data.itinerary,
        inclusions: data.inclusions,
        exclusions: data.exclusions,
        accommodation: data.accommodation,
        transportation: data.transportation,
        travelDates: data.travelDates,
        contactInformation: data.contactInformation,
        imageURL: data.imageURL,
        created_at: currentTimestamp
    };

    // Add the new package to the "packages" collection
    await db.collection("packages").add(newPackage);

    res.status(200).send({ msg: "Package added successfully!", package_id: nextPackageId });
} catch (error) {
    res.status(500).send({ msg: "Package addition failed!", error: error.message });
}

    
})

router.get('/get-package',async(req,res)=>{
    const data= await db.collection("packages").get();
    const list=data.docs.map((doc)=> ({id:doc.id, ...doc.data()}))
    res.send(list)
})

router.post('/update-package',async (req,res)=>{
    const packageId = req.body.package_id;
const data = req.body;

try {
    const packageSnapshot = await db.collection("packages")
        .where("package_id", "==", packageId)
        .limit(1)
        .get();

    if (!packageSnapshot.empty) {
        const docId = packageSnapshot.docs[0].id;

        await db.collection("packages").doc(docId).update(data);

        res.status(200).send({ msg: "Package updated successfully!" });
    } else {
        res.status(404).send({ msg: "Package not found!" });
    }
} catch (error) {
    console.error("Error updating package:", error);
    res.status(500).send({ msg: "Package update failed!", error: error.message });
}

})

router.post('/delete-package',async(req,res)=>{
    const packageId = req.body.package_id;

try {
    const packageSnapshot = await db.collection("packages")
        .where("package_id", "==", packageId)
        .limit(1)
        .get();

    if (!packageSnapshot.empty) {
        const docId = packageSnapshot.docs[0].id;

        await db.collection("packages").doc(docId).delete();

        res.status(200).send({ msg: "Package deleted successfully!" });
    } else {
        res.status(404).send({ msg: "Package not found!" });
    }
} catch (error) {
    console.error("Error deleting package:", error);
    res.status(500).send({ msg: "Package deletion failed!", error: error.message });
}


})



router.post('/flight-offers', async (req, res) => {
    try {
        // Extract package_id and date from the request body
        const { package_id, date } = req.body;

        if (!package_id || !date) {
            return res.status(400).send({ error: 'package_id and date are required' });
        }

        // Fetch package details from the database using package_id
        const packageSnapshot = await db.collection("packages").where("package_id", "==", package_id).get();
        const packageData = packageSnapshot.docs.map(doc => doc.data())[0];
       
        // Extract location_code and convert date to IST (optional for client-side processing)
        const LocationCode = packageData.location_code;
        const formattedDate = new Date(date.date_time).toISOString().split('T')[0]; // YYYY-MM-DD format

        if (!LocationCode) {
            return res.status(404).send({ error: 'Destination location code not found in the package details' });
        }
        // Fetch flight offers from Amadeus
        const response = await amadeus.shopping.flightOffersSearch.get({
            originLocationCode: "IND", // Default origin location
            destinationLocationCode:LocationCode ,
            // destinationLocationCode:"GVA",
            departureDate: formattedDate,
            adults: "2"
        });

        // Extract and format relevant flight itineraries
        // console.log(response);
        const result = response.data.slice(0, 3).map((flight) => flight.itineraries);

        // Send the response with package and flight details
        res.send({
            package: packageData,
            flights: result
        });
    } catch (error) {
        console.error('Error fetching flight offers:', error);
        res.status(500).send({ error: 'An error occurred while fetching flight offers' });
    }
});

module.exports = router