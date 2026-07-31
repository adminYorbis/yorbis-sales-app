# Source registry

Public HTTP(S) URLs are canonicalized by normalizing host and ports, removing fragments and common tracking parameters, sorting meaningful query parameters, and trimming redundant trailing slashes. Canonical sources are global; per-run discovery context is stored as immutable source observations. Excerpts are bounded to 2,000 characters and deduplicated by source, run, and content hash.
