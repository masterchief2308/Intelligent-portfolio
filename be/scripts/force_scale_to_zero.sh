#!/usr/bin/env bash
# Force Cloud Run to scale-to-zero (no always-on CPU, no warm instances).
# Run from a machine with gcloud auth for the portfolio project:
#
#   bash be/scripts/force_scale_to_zero.sh YOUR_GCP_PROJECT_ID
#
# Or:
#   gcloud run services update intelligent-portfolio-backend \
#     --project=YOUR_GCP_PROJECT_ID --region=asia-south1 \
#     --min-instances=0 --max-instances=1 --cpu-throttling

set -euo pipefail
PROJECT="${1:?Usage: $0 GCP_PROJECT_ID}"
SERVICE="${SERVICE:-intelligent-portfolio-backend}"
REGION="${REGION:-asia-south1}"

echo "Updating $SERVICE in $PROJECT ($REGION) → scale-to-zero + CPU throttling..."
gcloud run services update "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --min-instances=0 \
  --max-instances=1 \
  --cpu-throttling

echo ""
echo "Current scaling / CPU settings:"
gcloud run services describe "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --format="yaml(spec.template.metadata.annotations)"
