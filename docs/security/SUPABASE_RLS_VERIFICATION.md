# Supabase RLS Verification Checklist

Run after applying the phased migrations in Supabase.

## Role And Backend Checks

- Confirm API/worker `DATABASE_URL` uses service-role/postgres/BYPASSRLS-capable credentials.
- Confirm no browser/mobile environment contains service-role credentials.
- Confirm public clients do not use Prisma database URLs.

## SQL Checks

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

Expected result: only public catalog/listing tables grant `SELECT` to `anon`/`authenticated`; no client role has writes.

## HTTP Checks

- Protected API routes should continue returning `401`/`403` when unauthenticated, not `404`.
- Public marketplace routes should return `200` with arrays.
- Supabase REST direct calls as `anon` should only read public active catalog/listing tables.
- Supabase REST direct calls as `anon`/`authenticated` should fail for wallet, user, session, API key, webhook, payment, voucher-token, reward-QR, and order tables.

## Abuse Cases

- Attempt to select another user's private rows through Supabase REST: must fail.
- Attempt to insert/update/delete public catalogs through Supabase REST: must fail.
- Attempt to read encrypted/token fields through Supabase REST: must fail.
- Attempt to mutate wallet or ledger tables through Supabase REST: must fail.
- Attempt to alter audit logs through Supabase REST: must fail.
