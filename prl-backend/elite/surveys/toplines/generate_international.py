"""Generate international survey topline PDFs.

Reads from surveys.{country}_labelled tables, generates markdown reports,
converts to PDF via pandoc, and uploads to S3 under toplines/international/.
"""

import datetime
import json
import os
import subprocess
import tempfile
import urllib

import boto3
import dataset
import jinja2
import pandas as pd

from elite.surveys.toplines import intl_utils

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Country mapping: display name -> DB table prefix
COUNTRIES = {
    "brazil": "BR",
    "germany": "DE",
    "israel": "IL",
    "india": "IN",
    "poland": "PL",
}

COUNTRY_META = {
    "brazil": {
        "blocks": {
            "Party Affiliation": [
                "party_affiliation",
                "party_affiliation_probe",
                "party_affiliation_sympathy",
            ],
            "Feeling Thermometers": [
                "pt_therm_1",
                "pl_therm_1",
                "mdb_therm_1",
                "psdb_therm_1",
                "psol_therm_1",
                "pdt_therm_1",
                "novo_therm_1",
            ],
            "Trust, Pride, and Values": [
                "general_trust",
                "institutional_corruption",
                "institutional_response",
                "vote_importance",
                "pride",
                "fair_treatment",
                "democracy_importance",
            ],
            "Support for Democratic Norms": [
                "norm_judges",
                "norm_judges_perception",
                "norm_polling",
                "norm_polling_perception",
                "norm_executive",
                "norm_executive_perception",
                "norm_censorship",
                "norm_censorship_perception",
                "norm_loyalty",
                "norm_loyalty_perception",
            ],
            "Support for Political Violence": [
                "violence1",
                "violence2",
                "violence3",
                "violence4",
                "violence5",
                "violence6",
            ],
        },
        "groupbys": ["party_affiliation", "gender"],
    },
    "germany": {
        "blocks": {
            "Party Affiliation": ["party_affiliation"],
            "Feeling Thermometers": [
                "spd_therm_1",
                "cdu_therm_1",
                "greens_therm_1",
                "fdp_therm_1",
                "afd_therm_1",
                "left_therm_1",
            ],
            "Trust, Pride, and Values": [
                "general_trust",
                "institutional_corruption",
                "institutional_response",
                "vote_importance",
                "pride",
                "fair_treatment",
                "democracy_importance",
            ],
            "Support for Democratic Norms": [
                "norm_media_censorship",
                "norm_media_censorship_perception",
                "norm_nomination",
                "norm_nomination_perception",
                "norm_eu",
                "norm_eu_perception",
                "norm_dissolve",
                "norm_dissolve_perception",
                "norm_extremists",
                "norm_extremists_perception",
            ],
            "Support for Political Violence": [
                "violence1",
                "violence2",
                "violence3",
                "violence4",
                "violence5",
                "violence6",
            ],
        },
        "groupbys": ["party_affiliation", "gender"],
    },
    "israel": {
        "blocks": {
            "Party Affiliation": ["party_affiliation"],
            "Feeling Thermometers": ["inparty_therm_1", "outparty_therm_1"],
            "Trust, Pride, and Values": [
                "general_trust",
                "institutional_corruption",
                "institutional_response",
                "vote_importance",
                "pride",
                "fair_treatment",
                "democracy_importance",
            ],
            "Support for Democratic Norms": [
                "norm_judges",
                "norm_judges_perception",
                "norm_polling",
                "norm_polling_perception",
                "norm_executive",
                "norm_executive_perception",
                "norm_censorship",
                "norm_censorship_perception",
                "norm_loyalty",
                "norm_loyalty_perception",
            ],
            "Support for Political Violence": [
                "violence1",
                "violence2",
                "violence3",
                "violence4",
                "violence5",
                "violence6",
            ],
        },
        "groupbys": ["party_affiliation", "gender"],
    },
    "poland": {
        "blocks": {
            "Party Affiliation": ["party_affiliation"],
            "Feeling Thermometers": [
                "nlga_therm_1",
                "psl_therm_1",
                "nl_therm_1",
                "pis_therm_1",
                "nn_therm_1",
                "po_therm_1",
                "pjj_therm_1",
            ],
            "Trust, Pride, and Values": [
                "general_trust",
                "institutional_corruption",
                "institutional_response",
                "vote_importance",
                "pride",
                "fair_treatment",
                "democracy_importance",
            ],
            "Support for Democratic Norms": [
                "norm_1",
                "norm_1_perception",
                "norm_2",
                "norm_2_perception",
                "norm_3",
                "norm_3_perception",
                "norm_4",
                "norm_4_perception",
                "norm_5",
                "norm_5_perception",
            ],
            "Support for Political Violence": [
                "violence1",
                "violence2",
                "violence3",
                "violence4",
                "violence5",
                "violence6",
            ],
        },
        "groupbys": ["party_affiliation", "gender"],
    },
    "india": {
        "blocks": {
            "Party Affiliation": ["party_affiliation"],
            "Feeling Thermometers": [
                "bjp_therm_1",
                "inc_therm_1",
                "hindu_therm_1",
                "muslim_therm_1",
            ],
            "Trust, Pride, and Values": [
                "general_trust",
                "institutional_corruption",
                "institutional_response",
                "vote_importance",
                "pride",
                "fair_treatment",
                "democracy_importance",
            ],
            "Support for Democratic Norms": [
                "norm_judges",
                "norm_judges_perception",
                "norm_polling",
                "norm_polling_perception",
                "norm_censorship",
                "norm_censorship_perception",
                "norm_loyalty",
                "norm_loyalty_perception",
            ],
            "Support for Political Violence": [
                "violence1",
                "violence2",
                "violence3",
                "violence4",
                "violence5",
                "violence6",
            ],
        },
        "groupbys": ["party_affiliation", "gender"],
    },
}


def _generate_topline_content(country, data, questions):
    """Generate topline report content for a single country/wave."""
    print(f"Building {country}")
    content = ""
    d = data.copy()

    for block in COUNTRY_META[country]["blocks"]:
        print(f"\t{block}")
        content += f"""
\\newpage
\\begin{{center}}
\\vspace*{{\\fill}}
\\section{{{block}}}
\\vspace*{{\\fill}}
\\end{{center}}
\\newpage
"""
        for question in COUNTRY_META[country]["blocks"][block]:
            if question not in d.columns:
                print(f"\t\t{question} - SKIPPED (not in data)")
                continue
            if question not in questions.get(country, {}):
                print(f"\t\t{question} - SKIPPED (no metadata)")
                continue

            print(f"\t\t{question}")
            q_meta = questions[country][question]

            content += f"\\newpage\n\n## {q_meta.get('name', question)}\n\n"
            content += f"**Label**: {question}\n\n"
            if "question_text" in q_meta:
                content += f"**Question Text**: {q_meta['question_text']}\n\n"
            content += f"**Type**: {q_meta.get('type', 'unknown')}\n\n"
            content += "### Results\n\n"

            try:
                if q_meta.get("type") == "qualitative":
                    summary = (
                        d.groupby(question).size().reset_index(name="N (Frequency)")
                    )
                    if "options" in q_meta:
                        summary[question] = (
                            summary[question]
                            .astype(str)
                            .apply(lambda x: q_meta["options"].get(x, x))
                        )
                    summary = summary.rename(
                        columns={question: q_meta.get("name", question)}
                    )
                    summary["Percent"] = (
                        (
                            (summary["N (Frequency)"] / summary["N (Frequency)"].sum())
                            * 100
                        )
                        .round(2)
                        .astype(str)
                        .apply(lambda x: x + "%")
                    )
                    content += f"{summary.to_markdown(index=None)}\n\n"

                elif q_meta.get("type") == "quantitative":
                    d[question] = pd.to_numeric(d[question], errors="coerce")
                    if "weight" in d.columns:
                        summary = intl_utils.weighted_describe(d[question], d["weight"])
                    else:
                        summary = d[question].describe().to_dict()
                    summary["NAs"] = int(d[question].isna().sum())
                    summary_df = pd.DataFrame([summary])
                    summary_df = summary_df.rename(
                        columns={
                            "count": "n",
                            "50%": "median",
                            "std": "stdev",
                            "min": "Min",
                            "max": "Max",
                        }
                    )
                    cols = [
                        c
                        for c in ["n", "mean", "median", "stdev", "NAs", "Min", "Max"]
                        if c in summary_df.columns
                    ]
                    content += f"{summary_df[cols].to_markdown(index=None)}\n\n"
            except Exception as e:
                print(f"\t\t\tError processing {question}: {e}")
                content += "*Error generating statistics*\n\n"

    return content


def generate_international_toplines(update=False):
    """Generate international topline PDFs and upload to S3.

    Args:
        update: If True, overwrite existing PDFs in S3.

    Returns:
        dict with key 'generated' (count of PDFs uploaded).
    """
    from shared.config import get_secrets, load_config

    load_config()
    secrets = get_secrets("prl/database")
    db_url = (
        f"mysql+pymysql://{secrets['DB_USER']}:{urllib.parse.quote(secrets['DB_PASSWORD'])}"
        f"@{secrets['DB_HOST']}:{secrets['DB_PORT']}/surveys"
    )

    s3 = boto3.resource("s3")
    bucket = s3.Bucket(os.environ["S3_BUCKET"])
    existing = {
        s3obj.key.split("/")[-1]
        for s3obj in bucket.objects.filter(Prefix="toplines/international/")
        if not s3obj.key.endswith("/")
    }

    # Load question metadata
    questions = {}
    for country in COUNTRY_META:
        questions_file = os.path.join(
            SCRIPT_DIR, "assets", "questions", "intl", f"{country}.json"
        )
        if os.path.exists(questions_file):
            with open(questions_file, "r") as f:
                questions[country] = json.load(f)
        else:
            questions[country] = {}

    # Load template
    template_path = os.path.join(SCRIPT_DIR, "assets", "intl_template.md")
    with open(template_path, "r") as f:
        template = f.read()

    generated = 0
    db = dataset.connect(db_url)

    with tempfile.TemporaryDirectory() as temp_dir:
        for country, table_prefix in COUNTRIES.items():
            table_name = f"{table_prefix}_labelled"

            try:
                print(f"{country}: Checking waves in {table_name}...")
                waves = [row["wave"] for row in db[table_name].distinct("wave")]

                if not waves:
                    print(f"{country}: No data found, skipping.")
                    continue

                print(f"{country}: Found waves: {waves}")

                for wave in waves:
                    wave_num = (
                        wave.replace("wave", "") if isinstance(wave, str) else wave
                    )
                    filename = f"{country}-wave{wave_num}-toplines.pdf"

                    if filename in existing and not update:
                        print(f"{country} {wave}: Topline already exists, skipping.")
                        continue

                    print(f"{country} {wave}: Loading data...")
                    data = pd.DataFrame(db[table_name].find(wave=wave))

                    if len(data) == 0:
                        print(f"{country} {wave}: No data found, skipping.")
                        continue

                    print(f"{country} {wave}: {len(data)} rows loaded.")

                    content = _generate_topline_content(country, data, questions)

                    rendered = jinja2.Template(template).render(
                        country_display=country.capitalize(),
                        title=f"Global Political Pulse - {country.capitalize()} - Wave {wave_num}",
                        date=datetime.datetime.now().strftime("%Y %B %d"),
                        content=content,
                    )

                    md_path = os.path.join(temp_dir, f"{country}_{wave}.md")
                    with open(md_path, "w") as f:
                        f.write(rendered)

                    pdf_path = os.path.join(temp_dir, filename)
                    env = os.environ.copy()
                    assets_dir = os.path.join(SCRIPT_DIR, "assets")
                    env["TEXINPUTS"] = f"{assets_dir}:{assets_dir}//:"
                    result = subprocess.run(
                        [
                            "pandoc",
                            md_path,
                            "-o",
                            pdf_path,
                            f"--resource-path={assets_dir}",
                        ],
                        capture_output=True,
                        text=True,
                        env=env,
                    )

                    if result.returncode != 0:
                        print(
                            f"{country} {wave}: PDF generation failed: {result.stderr}"
                        )
                        continue

                    bucket.upload_file(pdf_path, f"toplines/international/{filename}")
                    generated += 1
                    print(
                        f"{country} {wave}: Uploaded to "
                        f"s3://{os.environ['S3_BUCKET']}/toplines/international/{filename}"
                    )

            except Exception as e:
                print(f"{country}: Error - {e}")
                continue

    db.engine.dispose()

    return {"generated": generated}
