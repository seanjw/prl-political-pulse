"""Entry point for rhetoric classification (daily).

Runs 3 scripts sequentially:
1. insert_performance.py - chunk data and insert into DB
2. classify.py - classify newly inserted data via OpenAI
3. batch_monitor.py - monitor OpenAI batch processing
"""

from shared.runner import run_scripts, job_collector

with job_collector("rhetoric-classify") as c:
    with c.step("insert_performance"):
        run_scripts(
            "elite/rhetoric/classify", ["insert_performance.py"], unbuffered=True
        )

    with c.step("classify"):
        run_scripts("elite/rhetoric/classify", ["classify.py"], unbuffered=True)

    with c.step("batch_monitor"):
        run_scripts(
            "elite/rhetoric/classify",
            [["batch_monitor.py", "--action", "monitor"]],
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
