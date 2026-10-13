"""WiseSloth.open AI service package."""

import os

# Use the bundled catalog. Importing the app must not fetch remote pricing data.
os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")
