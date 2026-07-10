# Queutra Backend

Backend service for the Queutra application.

## Directory Structure

```
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── socket/
│   ├── workers/
│   ├── jobs/
│   ├── utils/
│   └── validations/
│   ├── app.js
│   └── server.js
├── .env
├── .gitignore
├── package.json
└── README.md
```

## Setup & Running

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`.

3. Start the development server:
   ```bash
   npm run dev
   ```
