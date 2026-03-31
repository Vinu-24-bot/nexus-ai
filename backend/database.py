import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Fix for older postgres:// URLs
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Ensure SSL mode is required for Cloud Databases like Neon
if DATABASE_URL and "?" not in DATABASE_URL:
    DATABASE_URL += "?sslmode=require"
elif DATABASE_URL and "sslmode=" not in DATABASE_URL:
    DATABASE_URL += "&sslmode=require"

# THE FIX: pool_pre_ping tests the connection before using it.
# pool_recycle forces it to refresh the connection every 5 minutes (300 seconds).
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,
    pool_recycle=300
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()