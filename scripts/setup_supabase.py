#!/usr/bin/env python3.11
"""Setup Supabase - execute schema via direct DB connection."""
import psycopg2

# Connexion directe à la base Supabase
# Host: db.{project_ref}.supabase.co (port 5432 direct)
HOSTS = [
    ("db.nnqlazhrwmkrmynoohds.supabase.co", 5432),
    ("aws-0-eu-west-1.pooler.supabase.com", 6543),
    ("aws-0-eu-central-1.pooler.supabase.com", 6543),
]

DB_PASS = "Jaimepaco.307"
conn = None

for host, port in HOSTS:
    try:
        print(f"Tentative connexion: {host}:{port}...")
        conn = psycopg2.connect(
            host=host, port=port, dbname="postgres",
            user="postgres", password=DB_PASS,
            sslmode="require", connect_timeout=10,
        )
        print(f"OK connecté via {host}:{port}")
        break
    except Exception as e:
        print(f"  echec: {str(e)[:80]}")

if not conn:
    print("ERREUR: impossible de se connecter")
    exit(1)

# Lire le schema SQL
with open("/Users/arnaud/app-promo-studio/supabase/migrations/001_initial_schema.sql") as f:
    sql = f.read()

cur = conn.cursor()

# Executer statement par statement
statements = [s.strip() for s in sql.split(";") if s.strip() and not s.strip().startswith("--")]
print(f"\n{len(statements)} statements SQL a executer...")

for i, stmt in enumerate(statements, 1):
    short = stmt.replace("\n", " ")[:70]
    try:
        cur.execute(stmt)
        conn.commit()
        print(f"  {i:2d}/{len(statements)} OK: {short}...")
    except Exception as e:
        err = str(e)
        if "already exists" in err or "duplicate" in err:
            print(f"  {i:2d}/{len(statements)} SKIP (existe deja): {short[:50]}...")
        else:
            print(f"  {i:2d}/{len(statements)} ERREUR: {err[:100]}")
        conn.rollback()

# Inserer les templates par defaut
print("\nInsertion templates...")
templates_sql = """insert into public.templates (id, name, description, config, is_premium) values
  ('classic', 'Classic', 'Template par defaut', '{}', false),
  ('clean-dark', 'Clean Dark', 'Sobre et sombre', '{}', false),
  ('bold-pop', 'Bold Pop', 'Coloré et dynamique', '{}', false),
  ('minimal-light', 'Minimal Light', 'Clair et minimal', '{}', true),
  ('gradient-flow', 'Gradient Flow', 'DeGrades fluides', '{}', true)
on conflict (id) do nothing"""
try:
    cur.execute(templates_sql)
    conn.commit()
    print("  OK templates inseres")
except Exception as e:
    print(f"  SKIP: {str(e)[:80]}")
    conn.rollback()

# Verifier
print("\nVerification:")
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
tables = [r[0] for r in cur.fetchall()]
print(f"  Tables: {tables}")

cur.execute("SELECT name FROM storage.buckets")
buckets = [r[0] for r in cur.fetchall()]
print(f"  Buckets: {buckets}")

cur.execute("SELECT count(*) FROM public.templates")
n = cur.fetchone()[0]
print(f"  Templates: {n}")

cur.close()
conn.close()
print("\nSCHEMA SUPABASE PRET!")
