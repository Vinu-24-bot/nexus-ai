import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL and "?" not in DATABASE_URL:
    DATABASE_URL += "?sslmode=require"
elif DATABASE_URL and "sslmode=" not in DATABASE_URL:
    DATABASE_URL += "&sslmode=require"

# UPGRADE: Enterprise pooling to permanently stop Neon connection drops
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,
    pool_recycle=280,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()