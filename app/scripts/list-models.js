const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// Load API key from .env.local
const envPath = path.join(__dirname, "../.env.local");
let apiKey = "";

try {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/GEMINI_API_KEY=(.*)/);
    if (match) {
        apiKey = match[1].trim();
    }
} catch (e) {
    console.error("Error reading .env.local:", e);
    process.exit(1);
}

if (!apiKey) {
    console.error("API Key not found in .env.local");
    process.exit(1);
}

console.log(`Using API Key: ${apiKey.slice(0, 10)}...`);

async function listModels() {
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        // Note: listModels is not directly exposed on genAI instance in some versions, 
        // but we can try to use the model to generate content to see if it works,
        // OR we can try to use the underlying API client if accessible.
        // However, for verify simple connectivity and model existence, let's try to just hit a known model.
        // Actually, SDK usually doesn't have listModels helper easily accessible in the node client top level 
        // without using the ModelManager which might be internal or accessed differently.
        // Let's rely on standard fetch to the API endpoint for listing models to be 100% sure what the API sees.

        // Using fetch directly to list models
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name} (Supported methods: ${m.supportedGenerationMethods.join(", ")})`);
                }
            });
        } else {
            console.log("No models found or error:", data);
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
