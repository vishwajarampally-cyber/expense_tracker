# AI Expense Tracker CRUD App

Stack:
- Frontend: React
- Backend: Node.js + Express
- Database: MongoDB
- Grok/xAI or GroqCloud vision for bill image analysis

## Setup

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm start
```

Add `.env` in backend:
```
MONGODB_URI=your_mongodb_url
GROK_API_KEY=your_xai_or_groqcloud_api_key
GROK_MODEL=grok-4
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
PORT=5001
```

The frontend reads `REACT_APP_API_URL` from `frontend/.env`; this project is configured for `http://localhost:5001/api/expenses`.

Upload JPG or PNG bill images from the frontend. The backend sends the image to Grok, extracts the merchant/title, payable amount, and category, then stores the expense.

When MongoDB is unavailable, the backend keeps a local fallback store at `backend/data/expenses.json`, so uploaded expenses remain available after opening a new browser window or restarting the local server. Expenses can be edited or deleted from the frontend, and the app shows simple tips to reduce spending based on the tracked categories.

## Vercel Deployment

Deploy from the repository root. The included `vercel.json` builds `frontend/` and routes `/api/expenses` to the serverless Express API in `api/index.js`.

Add these environment variables in Vercel:
```
MONGODB_URI=your_mongodb_url
GROK_API_KEY=your_xai_or_groqcloud_api_key
GROK_MODEL=grok-4
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

For Vercel, leave `REACT_APP_API_URL` unset so the frontend uses `/api/expenses` on the same deployment.
