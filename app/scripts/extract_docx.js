const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

const docxPath = path.join(__dirname, "../..", "ホスト分析.docx");
const outputPath = path.join(__dirname, "../data/learning/host_analysis_raw.txt");

console.log(`Reading: ${docxPath}`);

mammoth.extractRawText({ path: docxPath })
    .then(result => {
        const text = result.value;
        const messages = result.messages;

        fs.writeFileSync(outputPath, text);
        console.log("Analysis text saved to:", outputPath);
        console.log("Preview (first 500 chars):");
        console.log(text.substring(0, 500));
    })
    .catch(error => {
        console.error("Error reading docx:", error);
    });
