# Features Research: Production Readiness

## Admin Dashboard
**Table stakes:**
- List all analyses with sortable/filterable data table
- View individual analysis details (image, CV output, LLM output, confidence)
- Correct/override analysis results (already exists at API level)
- Admin authentication via Bearer token (already exists)

**Differentiators:**
- Analytics dashboard with charts: scan volume over time, accuracy distribution, failure rate trends
- Side-by-side comparison: CV pipeline vs LLM output vs admin correction
- Export data (CSV) for offline analysis

## Accuracy Pipeline
**Table stakes:**
- Real ONNX regression model replacing mock
- Heuristic scoring improvements (continue M003 work)
- Eval runner with holdout set

**Differentiators:**
- Active learning loop: flag low-confidence predictions for admin review
- Model version tracking and A/B comparison

## Operations
**Table stakes:**
- GitHub Actions CI/CD pipeline
- Production wrangler configuration
- Error monitoring and alerting
- Secret management

**Differentiators:**
- Gradual/canary deployments
- Automated rollback on failure threshold
- SLA monitoring dashboard
