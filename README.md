# BQResultsProcessor v0.5

## Revisions

v0.1: first version, just creates a new column "variants" and assigns the correct variant name to each row.
v0.2: outputs the aggregated results as required.
v0.3: made a more modern, good-looking UI.
v0.4: count only unique events per user: only 1 event will count for each encoded_recipient_id per campaign_id, delivery_id, var_code, event_type. Filename now is the original filename + _processed.
v0.5: order variants alphabetically in final report but keep DEF variants before D variants.
