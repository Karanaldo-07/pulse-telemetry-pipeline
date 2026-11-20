from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from app.core.config import settings

pool = ConnectionPool(
    conninfo=settings.DATABASE_URL,
    min_size=1,
    max_size=5,
    kwargs={"prepare_threshold": None, "row_factory": dict_row},
    open=False,
)


def get_db_conn():
    with pool.connection() as conn:
        yield conn