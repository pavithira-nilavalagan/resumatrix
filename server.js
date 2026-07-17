// server.js
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// =============================================
// CORS CONFIGURATION
// =============================================
const allowedOrigins = [
    'https://resumatriix.onrender.com',
    'https://resumatriix-backend.onrender.com',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('❌ Blocked CORS request from:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ HEALTH CHECK ENDPOINT - MUST BE BEFORE app.listen()
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Server is running!',
        cors: 'enabled'
    });
});

// ✅ ROOT ENDPOINT - Optional but helpful
app.get('/', (req, res) => {
    res.json({
        message: 'Resume Matrix API is running',
        endpoints: {
            health: '/api/health',
            parseResume: '/api/parse-resume (POST)'
        }
    });
});

// Parse resume endpoint
app.post('/api/parse-resume', async (req, res) => {
    try {
        const { resumeText } = req.body;
        
        if (!resumeText) {
            return res.status(400).json({ error: 'No resume text provided' });
        }

        if (resumeText.trim().length === 0) {
            return res.status(400).json({ error: 'Resume text is empty' });
        }

        const parsedData = await parseResumeWithAI(resumeText);
        res.json(parsedData);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

async function parseResumeWithAI(resumeText) {
    const prompt = `
Extract the resume information and return ONLY valid JSON with this exact structure:

{
  "personal_info": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "profession": "",
    "linkedin": "",
    "github": "",
    "website": ""
  },
  "professional_summary": "",
  "experience": [
    {
      "company": "",
      "position": "",
      "start_date": "",
      "end_date": "",
      "description": ""
    }
  ],
  "education": [
    {
      "institution": "",
      "degree": "",
      "field": "",
      "start_date": "",
      "end_date": ""
    }
  ],
  "project": [
    {
      "name": "",
      "description": ""
    }
  ],
  "skills": []
}

Resume text:
${resumeText}

Return ONLY the JSON, no other text.
`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let json = response.text();
        
        json = json.replace(/```json/g, "");
        json = json.replace(/```/g, "");
        json = json.trim();

        try {
            const parsed = JSON.parse(json);
            return parsed;
        } catch (parseError) {
            console.error('Invalid JSON:', json);
            throw new Error('AI returned invalid JSON format');
        }
    } catch (error) {
        console.error('AI parsing error:', error);
        throw new Error('Failed to parse resume with AI: ' + error.message);
    }
}

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📝 Health check: /api/health`);
    console.log(`🔒 CORS enabled for:`, allowedOrigins);
});