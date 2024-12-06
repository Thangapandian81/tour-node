const express = require('express');
const router=express.Router();
const {db}=require('../config/firebaseConfig');
const fsqDevelopers = require('@api/fsq-developers');

router.get('/find-package', async (req, res) => {
    try {
        // Extract the generic query parameter
        const { query } = req.query;

        if (!query) {
            return res.status(400).send({ message: 'Query parameter is required' });
        }

        // console.log("Query:", query); // Log the incoming query

        // Fetch all packages from Firestore
        const packagesRef = db.collection("packages");
        const snapshot = await packagesRef.get();

        if (snapshot.empty) {
            return res.status(404).send({ message: 'No packages found' });
        }

        const allPackages = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        // console.log("All Packages:", allPackages); // Log all package data

        // Helper function to recursively search for the query in all fields
        const matchesQuery = (obj, query) => {
            query = query.toString().toLowerCase();
            for (const key in obj) {
                if (typeof obj[key] === 'object') {
                    // Recursively check nested objects or arrays
                    if (matchesQuery(obj[key], query)) return true;
                } else if (
                    obj[key] &&
                    obj[key].toString().toLowerCase().includes(query)
                ) {
                    return true; // Match found
                }
            }
            return false;
        };

        // Filter packages based on the query
        const filteredPackages = allPackages.filter(pkg => matchesQuery(pkg, query));

        // console.log("Filtered Packages:", filteredPackages); // Log filtered results

        // Respond based on filtered results
        if (filteredPackages.length === 0) {
            return res.status(404).send({ message: 'No matching packages found' });
        }
        else{
            res.status(200).json(filteredPackages);
        }

       
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ message: 'Internal Server Error', error: error.message });
    }
});

router.get('/hotel-search',async(req,res)=>{

    const {query,latlong}= req.query;

    fsqDevelopers.auth('fsq32B9+kGYiSjUHu3fFlOab/KLALOCHmEbcbrPPqidKg0M=');
    fsqDevelopers.placeSearch({query:query, ll:latlong})
  .then(({ data }) =>res.send(data))
  .catch(err => console.error(err));
    
});


module.exports=router

