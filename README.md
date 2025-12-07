# Super Grid Scalper

Full-stack application with Next.js frontend and Python FastAPI backend.

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Python FastAPI, SQLAlchemy
- **Database**: PostgreSQL (super_grid)

## Project Structure

```
SuperGridScalper/
├── frontend/          # Next.js frontend
│   ├── src/app/       # App router pages
│   └── package.json
├── backend/           # Python FastAPI backend
│   ├── app/
│   │   ├── main.py    # FastAPI app entry
│   │   ├── database.py
│   │   ├── models.py
│   │   └── config.py
│   ├── requirements.txt
│   └── .env
└── README.md
```

## Quick Start

### Backend (Terminal 1)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Backend runs at: http://localhost:8000

### Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: http://localhost:3000

## API Endpoints

- `GET /` - Welcome message
- `GET /api/health` - Health check (includes database status)

## Database

Update `backend/.env` with your PostgreSQL credentials:
```
DATABASE_URL=postgresql://username:password@localhost:5432/super_grid
```
