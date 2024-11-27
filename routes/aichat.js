const express = require("express");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const router = express.Router();

// Initialize the Generative AI client
const genAI = new GoogleGenerativeAI("AIzaSyAV6iALWYytm14XX_xgoW-ztHFvEsAp_tQ");

// Example live URL (you can replace this with your actual live URL)
const liveUrl = "https://tour-node-8wh0.onrender.com/packages/get-package"; // Replace with actual live URL

// Function to get details from the live URL
async function fetchLiveUrlDetails() {
  try {
    const response = await axios.get(liveUrl);
    return response.data; // Assuming the response is JSON
  } catch (error) {
    console.error("Error fetching live URL details:", error);
    return null;
  }
}

// Function to generate FAQ response based on prompt and live URL details
async function generateFAQResponse(question) {
  // Get live URL details (relevant keywords or content)
  const liveData = await fetchLiveUrlDetails();

  if (!liveData) {
    return "Sorry, we couldn't fetch the necessary data from the live URL.";
  }

  // Process the data (e.g., extract relevant keywords or details from the JSON)
  const relevantData = extractRelevantData(liveData);

  // Initialize the Generative AI client with the relevant data
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    // Use the question and live data to generate a more conversational response
    const result = await model.generateContent(`[${question} with the following information: ${relevantData}]`);
    return formatNLPResponse(result.response.text());
  } catch (error) {
    console.error("Error generating FAQ response:", error);
    return "Sorry, there was an error generating the response.";
  }
}

// Function to extract relevant keywords or details from live URL data (can be customized)
function extractRelevantData(data) {
  // Customize this function based on the structure of your live URL JSON data
  // For example, extracting keywords or summaries
  const relevantKeywords = data.keywords || data.summary || "no relevant data";
  return relevantKeywords;
}

// Function to format the NLP response in a more interactive and conversational way
function formatNLPResponse(response) {
  // For example, make the response more friendly and conversational
  return `🤖 Here's what I found: ${response} \n\nFeel free to ask more questions! 😊`;
}

// Define the route to get FAQ responses
router.post("/generateFAQ", async (req, res) => {
  const { question } = req.query;

  if (!question) {
    return res.status(400).send({
      error: "Please provide 'question' as a query parameter.",
    });
  }

  // Generate FAQ response based on the provided question
  const response = await generateFAQResponse(question);
  res.send({ response });
});

module.exports=router;