import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# La cadena de conexión se toma SIEMPRE de la variable de entorno DATABASE_URL (no se guardan contraseñas en el código).
# Ejemplo: export DATABASE_URL="postgresql+psycopg2://geo:<contraseña>@127.0.0.1:5432/durango_geo"
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("Defina la variable de entorno DATABASE_URL (vea servidor/.env.ejemplo y el README).")
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=5)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
