const express = require('express');
const { db } = require('../config/firebaseConfig');
const { Configuration, OpenAIApi } = require('openai');
const openai = require('openai')
const { apikeys } = require('googleapis/build/src/apis/apikeys');
const router = express.Router();

// OpenAI Configuration
// const configuration = new Configuration({
//     apiKey: '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', // Store your OpenAI API key in an environment variable
// });
// const openai = {apiKey: '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'}
// Route to Fetch Related Packages
router.post('/search-packages', async (req, res) => {
    const userQuery = req.body.query;

    if (!userQuery || typeof userQuery !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid query provided.' });
    }

    try {
        // Step 1: Fetch all packages from Firestore
        const snapshot = await db.collection('packages').get();
        const packages = snapshot.docs.map(doc => ({
            id: doc.id, // Include document ID for reference
            ...doc.data(),
        }));

        if (packages.length === 0) {
            return res.status(404).json({ success: false, message: 'No packages found.' });
        }

        // Step 2: Create a prompt for AI to filter and rank packages
        const aiPrompt = `
        You are an AI that filters and ranks vacation packages based on user preferences.
        User Query: "${userQuery}"
        Package Data: ${JSON.stringify(packages)}
        Return the top related packages in JSON format with details like name, location, budget, and days.
        `;

        // Step 3: Call OpenAI for NLP processing
        const completion = await openai.createChatCompletion({
            apikey:'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',
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: aiPrompt }],
        });

        // Step 4: Parse AI Response
        let relatedPackages;
        try {
            relatedPackages = JSON.parse(completion.data.choices[0].message.content);
        } catch (error) {
            throw new Error('Failed to parse AI response. Ensure the AI prompt generates valid JSON.');
        }

        // Return the filtered packages
        res.status(200).json({ success: true, relatedPackages });
    } catch (error) {
        console.error('Error fetching packages:', error);
        res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
    }
});

module.exports = router;
