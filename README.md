
    backend/                 
        app/ ← the actual application
            database.py     ← DB connection setup
            models.py       ← what the database looks like (SQLAlchemy)
            schemas.py      ← what the API accepts/returns (Pydantic)
            main.py         ← the API endpoints (FastAPI)
        alembic/          ← database migration system
            env.py          ← how Alembic connects to the DB
            versions/
                0001_...py    ← the actual SQL that created the tables
        alembic.ini       ← Alembic config file
        requirements.txt  ← Python dependencies
        .env        ← secrets
    .gitignore          ← keeps secrets and junk out of git