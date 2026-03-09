# Hi-Lo Stock Market Trading Game

A sophisticated multiplayer stock market simulation game built with React Native (Expo) frontend and Flask backend.

## Game Overview

Players participate in a real-time stock trading simulation with different roles:
- **Contractors**: Receive trading contracts (long/short positions)
- **Insiders**: Get privileged information (dice rolls or coin flip outcomes)

The game features a bid/ask system where players can place orders and trade against each other in real-time.

## Setup Instructions

### Frontend Setup
```bash
cd frontend
npm install
```

Start the development server:
```bash
npx expo start
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

Start the backend server:
```bash
python app.py
```

## Environment Variables

For production deployment, set the following environment variable:
- `MONGODB_URI`: Your MongoDB connection string

## Technology Stack

- **Frontend**: React Native with Expo, TypeScript
- **Backend**: Flask with Socket.IO
- **Database**: MongoDB
- **Real-time Communication**: WebSocket via Socket.IO

## Game Features

- Real-time multiplayer trading
- Different player roles with unique information
- Market maker/taker system
- Live leaderboards
- Round-based gameplay
- Spectator mode