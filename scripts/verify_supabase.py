import psycopg2

conn = psycopg2.connect(
    host="db.nnqlazhrwmkrmynoohds.supabase.co", port=5432,
    dbname="postgres", user="postgres", password="Jaimepaco.307",
    sslmode="require"
)
cur = conn.cursor()

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
print("Tables:", [r[0] for r in cur.fetchall()])

cur.execute("SELECT id, name FROM public.templates ORDER BY id")
print("Templates:", cur.fetchall())

cur.execute("SELECT name FROM storage.buckets")
print("Buckets:", [r[0] for r in cur.fetchall()])

print("\nSUPABASE 100% OK")
cur.close()
conn.close()
