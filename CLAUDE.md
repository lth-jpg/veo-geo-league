# VEO GEO LEAGUE — Project Notes

## URLs
- **Production**: https://veo-geo-league-production.up.railway.app

## Secrets
- `CRON_SECRET`: `veogeosecret2026`

## Useful Commands

### Test morning Slack post
```bash
curl -X POST https://veo-geo-league-production.up.railway.app/api/cron/morning \
  -H "Authorization: Bearer veogeosecret2026"
```

### Test daily summary/wrap post
```bash
curl -X POST https://veo-geo-league-production.up.railway.app/api/cron/summary \
  -H "Authorization: Bearer veogeosecret2026"
```
