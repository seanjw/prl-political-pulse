"""Entry point for US survey data export (daily).

After uploading survey data, also regenerates topline PDFs, the toplines
index JSON, and the all-data.zip download so everything stays in sync.
"""

from shared.runner import run_scripts, job_collector

with job_collector("survey-upload") as c:
    run_scripts(
        "surveys/process", ["1 - push raw csvs to rds.py", "2 - push rds to s3.py"]
    )

    # Chain toplines generation so PDFs update whenever new data lands
    with c.step("us_toplines"):
        from elite.surveys.toplines.generate_us import generate_us_toplines

        stats = generate_us_toplines(update=True)
        c.set("us_pdfs_generated", stats["generated"])
        c.set("us_pdfs_skipped", stats["skipped"])

    with c.step("international_toplines"):
        from elite.surveys.toplines.generate_international import (
            generate_international_toplines,
        )

        stats = generate_international_toplines(update=True)
        c.set("intl_pdfs_generated", stats["generated"])

    # Regenerate toplines index so the frontend picks up new waves
    with c.step("toplines_index"):
        from elite.surveys.toplines.generate_index import generate_toplines_index

        idx_stats = generate_toplines_index()
        c.set("index_us_waves", idx_stats["us_waves"])

    # Regenerate all-data.zip so the download includes the latest survey data
    with c.step("regenerate_all_data_zip"):
        from elite.surveys.regenerate_all_data import regenerate_all_data_zip

        zip_stats = regenerate_all_data_zip()
        c.set("zip_rows", zip_stats["rows_exported"])
        c.set("zip_size", zip_stats["zip_size"])

    c.set_headlines(
        [
            {"key": "rows_inserted", "label": "Rows Inserted", "format": "number"},
            {"key": "files_exported", "label": "Files Exported", "format": "number"},
            {"key": "us_pdfs_generated", "label": "US PDFs", "format": "number"},
            {"key": "intl_pdfs_generated", "label": "Intl PDFs", "format": "number"},
            {"key": "zip_rows", "label": "Download Rows", "format": "number"},
        ]
    )
