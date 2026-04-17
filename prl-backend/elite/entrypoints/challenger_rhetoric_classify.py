"""Entry point for challenger rhetoric classification (daily).

Runs 3 scripts sequentially:
1. insert_challengers.py - find unclassified tweets, insert into classifications_challengers
2. classify_challengers.py - submit to OpenAI batch API
3. monitor_challengers.py - monitor and write results to DB
"""

from shared.runner import run_scripts, job_collector

with job_collector("challenger-rhetoric-classify") as c:
    with c.step("insert_challengers"):
        run_scripts(
            "elite/challengers/classify", ["insert_challengers.py"], unbuffered=True
        )

    with c.step("classify_challengers"):
        run_scripts(
            "elite/challengers/classify", ["classify_challengers.py"], unbuffered=True
        )

    with c.step("monitor_challengers"):
        run_scripts(
            "elite/challengers/classify",
            [["monitor_challengers.py", "--action", "monitor"]],
            unbuffered=True,
        )

    c.set_headlines(
        [
            {
                "key": "records_classified",
                "label": "Records Classified",
                "format": "number",
            },
            {
                "key": "batches_submitted",
                "label": "Batches Submitted",
                "format": "number",
            },
        ]
    )
