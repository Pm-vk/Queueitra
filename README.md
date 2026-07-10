# Queueitra

Queueitra is a backend application configured with Express, MongoDB, Mongoose, and Redis.

## Project Structure

```
.
├── Backend/
│   ├── src/
│   │   ├── config/       # Database & Environment configurations
│   │   ├── controllers/  # Route controllers
│   │   ├── middlewares/  # Express middlewares
│   │   ├── models/       # Mongoose models
│   │   ├── repositories/ # Data access layer
│   │   ├── routes/       # Express routes
│   │   ├── services/     # Business logic
│   │   ├── socket/       # Socket.io configurations
│   │   ├── workers/      # BullMQ workers
│   │   ├── jobs/         # Scheduled tasks / queues
│   │   ├── utils/        # Common utilities (ApiResponse, ApiError, etc.)
│   │   ├── validations/  # Request validations
│   │   ├── app.js        # App entry point
│   │   └── server.js     # Server startup script
│   ├── .env
│   ├── .gitignore
│   ├── package.json
│   └── README.md
└── README.md
```

## Getting Started

Refer to the [Backend README](Backend/README.md) for detailed instructions on setting up and running the server locally.
