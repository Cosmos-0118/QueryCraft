# Security Model — QueryCraft

See the [ROADMAP.md](../ROADMAP.md#7-security-model) for the full security specification.

## Summary

- **Password hashing**: Argon2id (64 MB memory, 3 iterations)
- **Auth tokens**: JWT (15 min) + HTTP-only refresh tokens (7 days)
- **Rate limiting**: Token-bucket per IP and per user
- **Input validation**: Zod schemas at API boundary
- **Security headers**: CSP, HSTS, X-Frame-Options, etc.
- **SQL sandbox**: 100% client-side (sql.js WASM), never touches the real database
