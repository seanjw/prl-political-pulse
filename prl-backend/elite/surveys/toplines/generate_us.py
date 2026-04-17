"""Generate US survey topline PDFs.

Reads from surveys.us_unlabelled, generates LaTeX tables + matplotlib plots,
renders via pandoc to PDF, and uploads to S3 under toplines/.
"""

import json
import os
import subprocess
import tempfile
import urllib
import warnings

warnings.filterwarnings("ignore")

import boto3  # noqa: E402
import dataset as database  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402
import seaborn as sns  # noqa: E402
from jinja2 import Template  # noqa: E402

from elite.surveys.toplines import pulse_utils  # noqa: E402

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

VARIABLES = [
    "democrat_therm_1",
    "republican_therm_1",
    "general_trust",
    "institutional_corruption",
    "institutional_response",
    "vote_importance",
    "pride",
    "fair_treatment",
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
    "violence1",
    "violence2",
    "violence3",
    "violence4",
    "violence5",
    "violence6",
]

DEMOGRAPHICS = {
    "Partisanship": "pid",
    "Sex": "gender",
    "Race": "race",
    "Age": "age",
    "Highest Education": "educ",
    "2020 Vote Choice": "presvote20post",
    "Born Again": "pew_bornagain",
}

NORM_VIOLENCE_VARS = [
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
    "violence1",
    "violence2",
    "violence3",
    "violence4",
    "violence5",
    "violence6",
]


def _merge_dataframes(df1, df2):
    merged_df = pd.DataFrame()
    for column in df1.columns:
        merged_df[column] = (
            "\\textbf{"
            + df1[column].apply(_round_floats).astype(str)
            + "} \\textcolor{gray}{("
            + df2[column].apply(_round_floats).astype(str)
            + ")}"
        )
    return merged_df


def _round_floats(value):
    if isinstance(value, float):
        return round(value, 2)
    return value


def _is_post_engagement_change(year, week):
    """After 2023 week 24, every subject is considered engaged."""
    return (year > 2023) or (year == 2023 and week >= 25)


def generate_us_toplines(update=False):
    """Generate US topline PDFs and upload to S3.

    Args:
        update: If True, overwrite existing PDFs in S3.

    Returns:
        dict with keys 'generated' and 'skipped' (counts).
    """
    from shared.config import get_secrets, load_config

    load_config()
    secrets = get_secrets("prl/database")
    db_url = (
        f"mysql+pymysql://{secrets['DB_USER']}:{urllib.parse.quote(secrets['DB_PASSWORD'])}"
        f"@{secrets['DB_HOST']}:{secrets['DB_PORT']}/surveys"
    )
    db = database.connect(db_url)

    questions_path = os.path.join(SCRIPT_DIR, "assets", "questions.json")
    with open(questions_path, "r") as f:
        meta = json.load(f)

    s3 = boto3.resource("s3")
    bucket = s3.Bucket(os.environ["S3_BUCKET"])
    existing = {
        s3obj.key.split("/")[-1]
        for s3obj in bucket.objects.filter(Prefix="toplines/")
        if not s3obj.key.endswith("/")
    }

    generated = 0
    skipped = 0

    with tempfile.TemporaryDirectory() as temp_dir:
        os.makedirs(os.path.join(temp_dir, "images"), exist_ok=True)

        for data_obj in db["us_unlabelled"].distinct("year", "week", "survey"):
            year = data_obj["year"]
            week = data_obj["week"]
            survey = data_obj["survey"]

            if survey is None or week is None:
                continue

            name = f"s{survey}-{year}_week{week}.pdf"

            if name in existing and not update:
                skipped += 1
                continue

            print(f"\n=== {name} ===")

            data = pd.DataFrame(db["us_unlabelled"].find(survey=survey))
            data["pid"] = pulse_utils.get_partisanship(data["pid7"])
            data["age"] = pulse_utils.get_age(data["birthyr"], coding="id")

            post_engage = _is_post_engagement_change(year, week)
            if post_engage:
                datas = [data]
            else:
                datas = [pulse_utils.remove_disengaged(data), data]

            formatted_tables = {}

            # Demographics table
            demos = [[] for _ in range(len(datas))]
            for i in range(len(datas)):
                for var in DEMOGRAPHICS:
                    dem_stats = (
                        datas[i]
                        .groupby([DEMOGRAPHICS[var]])
                        .size()
                        .reset_index(name="N (Frequency)")
                    )
                    dem_stats[DEMOGRAPHICS[var]] = (
                        dem_stats[DEMOGRAPHICS[var]]
                        .astype(int)
                        .astype(str)
                        .replace(
                            {
                                key: val
                                for key, val in meta[DEMOGRAPHICS[var]][
                                    "options"
                                ].items()
                            }
                        )
                    )
                    dem_stats = dem_stats.pivot_table(
                        index=DEMOGRAPHICS[var], values="N (Frequency)", fill_value=0
                    )
                    dem_stats["Percent"] = (
                        (
                            (
                                dem_stats["N (Frequency)"]
                                / dem_stats["N (Frequency)"].sum()
                            )
                            * 100
                        )
                        .round(2)
                        .astype(str)
                        .apply(lambda x: x + "%")
                    )
                    dem_stats.index.name = var
                    demos[i].append(dem_stats)

            combined_demos = {}
            for v, var in enumerate(DEMOGRAPHICS):
                if post_engage:
                    combined_demos[var] = demos[0][v]
                else:
                    combined_demos[var] = _merge_dataframes(demos[0][v], demos[1][v])

            table = (
                "\\begin{table}[!ht] \\begin{adjustbox}{max width=1\\textwidth}\\small"
            )
            table += (
                "\n".join(combined_demos[var].to_latex().splitlines()[:3])
                + "\n\\toprule"
            )
            for t in combined_demos:
                table += "\n" + "\n".join(
                    combined_demos[t].to_latex().splitlines()[3:-1]
                ).replace("\\midrule\n", "").replace(f"{t} &", "\\textbf{" + t + "} &")
            table += "\n\\end{tabular} \\end{adjustbox} \\end{table}"
            table = table.replace("%", "\\%").replace("nan", "-").replace("NaN", "-")
            formatted_tables["demographics_table"] = table

            # Calculate summary statistics for each variable
            for v in VARIABLES:
                if post_engage:
                    tables = [{}]
                else:
                    tables = [{}, {}]

                combined_tables = {}

                for i in range(len(datas)):
                    datas[i][v] = datas[i][v].astype(float)

                    if v in NORM_VIOLENCE_VARS:
                        datas[i] = pulse_utils.remove_nonpartisans(datas[i])

                    if meta[v]["type"] == "quantitative":
                        summary = pulse_utils.weighted_describe(
                            datas[i][v], datas[i]["weight"]
                        )
                        summary["NAs"] = datas[i][v].isna().sum().astype(str)
                        summary = pd.DataFrame([summary], index=["total"])
                        summary = summary.rename(
                            columns={
                                "count": "n",
                                "50%": "median",
                                "std": "stdev",
                                "min": "Min",
                                "max": "Max",
                            }
                        )
                        summary = summary[
                            ["n", "mean", "median", "stdev", "NAs", "Min", "Max"]
                        ]
                        tables[i]["total"] = summary

                        for var in DEMOGRAPHICS:
                            dem_stats = (
                                datas[i]
                                .groupby(DEMOGRAPHICS[var])
                                .apply(
                                    lambda x: pulse_utils.weighted_describe(
                                        x[v], x["weight"]
                                    )
                                )
                            )
                            dem_stats["NAs"] = (
                                datas[i]
                                .groupby(DEMOGRAPHICS[var])[v]
                                .apply(lambda x: x.isna().sum().astype(str))
                            )
                            dem_stats.index = dem_stats.index.astype(str)
                            dem_stats = dem_stats.rename(
                                index={
                                    option: meta[DEMOGRAPHICS[var]]["options"][option]
                                    for option in meta[DEMOGRAPHICS[var]]["options"]
                                }
                            )
                            dem_stats = dem_stats.rename(
                                columns={
                                    "count": "n",
                                    "50%": "median",
                                    "std": "stdev",
                                    "min": "Min",
                                    "max": "Max",
                                }
                            )
                            dem_stats = dem_stats[
                                ["n", "mean", "median", "stdev", "NAs", "Min", "Max"]
                            ]
                            dem_stats = dem_stats.rename_axis(var)
                            tables[i][var] = dem_stats

                    elif meta[v]["type"] == "qualitative":
                        summary = (
                            datas[i].groupby(v).size().reset_index(name="N (Frequency)")
                        )
                        summary[v] = (
                            summary[v]
                            .astype(int)
                            .astype(str)
                            .replace(
                                {key: val for key, val in meta[v]["options"].items()}
                            )
                        )
                        summary["Percent"] = (
                            (
                                (
                                    summary["N (Frequency)"]
                                    / summary["N (Frequency)"].sum()
                                )
                                * 100
                            )
                            .round(2)
                            .astype(str)
                            .apply(lambda x: x + "%")
                        )
                        summary = summary.rename(columns={v: meta[v]["name"]})
                        tables[i]["total"] = summary

                        for var in DEMOGRAPHICS:
                            dem_stats = (
                                datas[i]
                                .groupby([v, DEMOGRAPHICS[var]])
                                .size()
                                .reset_index(name="N (Frequency)")
                            )
                            dem_stats[v] = (
                                dem_stats[v]
                                .astype(int)
                                .astype(str)
                                .replace(
                                    {
                                        key: val
                                        for key, val in meta[v]["options"].items()
                                    }
                                )
                            )
                            dem_stats[DEMOGRAPHICS[var]] = (
                                dem_stats[DEMOGRAPHICS[var]]
                                .astype(int)
                                .astype(str)
                                .replace(
                                    {
                                        key: val
                                        for key, val in meta[DEMOGRAPHICS[var]][
                                            "options"
                                        ].items()
                                    }
                                )
                            )
                            dem_stats = dem_stats.pivot_table(
                                index=DEMOGRAPHICS[var],
                                columns=v,
                                values="N (Frequency)",
                                fill_value=0,
                            )
                            dem_stats = dem_stats.reindex(
                                columns=meta[v]["options"].values(), fill_value=0
                            )
                            dem_stats.index.name = var

                            dem_stats["N (Frequency)"] = dem_stats.sum(axis=1)
                            for val in meta[v]["options"].values():
                                dem_stats[val] = (
                                    (
                                        (dem_stats[val] / dem_stats["N (Frequency)"])
                                        * 100
                                    )
                                    .round(2)
                                    .astype(str)
                                    .apply(lambda x: x + "%")
                                )

                            dem_stats = dem_stats.rename(
                                columns={
                                    val: val + " (%)"
                                    for val in meta[v]["options"].values()
                                }
                            )
                            tables[i][var] = dem_stats

                # Format tables
                img_path = os.path.join(temp_dir, f"images/{v}.png")
                table = f"\n\n\\includegraphics[width=\\textwidth]{{{img_path}}}\n\n"

                if meta[v]["type"] == "quantitative":
                    for i in range(len(tables)):
                        tables[i]["total"]["n"] = tables[i]["total"]["n"].astype(int)

                    if post_engage:
                        combined_tables["total"] = (
                            tables[0]["total"].round(2).astype(str)
                        )
                    else:
                        combined_tables["total"] = _merge_dataframes(
                            tables[0]["total"], tables[1]["total"]
                        )

                    for var in DEMOGRAPHICS:
                        for i in range(len(tables)):
                            tables[i][var]["n"] = tables[i][var]["n"].astype(int)
                        if post_engage:
                            combined_tables[var] = tables[0][var].round(2).astype(str)
                        else:
                            combined_tables[var] = _merge_dataframes(
                                tables[0][var], tables[1][var]
                            )

                    table += "\\begin{table}[!ht] \\begin{adjustbox}{max width=1\\textwidth}\\small"
                    table += "\n".join(
                        combined_tables["total"].to_latex().splitlines()[0:-1]
                    ).replace("total &", "\\textbf{total} &")

                    for t in combined_tables:
                        if t != "total":
                            table += "\n" + "\n".join(
                                combined_tables[t].to_latex().splitlines()[3:-1]
                            ).replace("\\midrule\n", "").replace(
                                f"{t} &", "\\textbf{" + t + "} &"
                            )
                    table += "\n\\end{tabular} \\end{adjustbox} \\end{table}"
                    formatted_tables[v] = table

                    # Build KDE plot
                    sns.set_theme()
                    plt.figure(figsize=(10, 2))
                    ax = sns.kdeplot(datas[0][v], fill=True)
                    ax.spines["top"].set_visible(False)
                    ax.spines["right"].set_visible(False)
                    ax.spines["left"].set_visible(False)
                    ax.spines["bottom"].set_visible(False)
                    ax.set_xlim(
                        int(meta[v]["options"]["min"]),
                        int(meta[v]["options"]["max"]),
                    )
                    ax.yaxis.set_visible(False)
                    ax.set_ylabel("")
                    ax.set_xlabel("")
                    ax.tick_params(axis="both", which="both", length=0)
                    plt.tight_layout()

                elif meta[v]["type"] == "qualitative":
                    if post_engage:
                        combined_tables["total"] = (
                            tables[0]["total"].round(2).astype(str)
                        )
                    else:
                        combined_tables["total"] = _merge_dataframes(
                            tables[0]["total"], tables[1]["total"]
                        )
                    for var in DEMOGRAPHICS:
                        if post_engage:
                            combined_tables[var] = tables[0][var].round(2).astype(str)
                        else:
                            combined_tables[var] = _merge_dataframes(
                                tables[0][var], tables[1][var]
                            )
                    table += "\n".join(
                        combined_tables["total"].to_latex(index=False).splitlines()
                    )

                    table += "\n\n\\begin{table}[!ht] \\begin{adjustbox}{max width=1\\textwidth}\\small"
                    first_demo_key = list(combined_tables.keys())[1]
                    table += (
                        "\n".join(
                            combined_tables[first_demo_key]
                            .rename_axis("", axis=1)
                            .to_latex()
                            .splitlines()[:3]
                        )
                        + "\n\\toprule"
                    )
                    for t in combined_tables:
                        if t != "total":
                            table += "\n" + "\n".join(
                                combined_tables[t].to_latex().splitlines()[3:-1]
                            ).replace("\\midrule\n", "").replace(
                                f"{t} &", "\\textbf{" + t + "} &"
                            )

                    table += "\n\\end{tabular} \\end{adjustbox} \\end{table}"
                    table = (
                        table.replace("%", "\\%")
                        .replace("nan", "-")
                        .replace("NaN", "-")
                    )

                    if not post_engage:
                        table += "\n\nNote: bold text: engaged participants only; grey text in parentheses: includes disengaged participants\n\n"

                    formatted_tables[v] = table

                    # Build stacked bar plot
                    sns.set_theme()
                    tables[0]["total"] = tables[0]["total"].set_index(meta[v]["name"])
                    ax = pd.DataFrame(tables[0]["total"]["N (Frequency)"]).T.plot.barh(
                        stacked=True, figsize=(10, 2)
                    )
                    for container in ax.containers:
                        for bar in container:
                            width = bar.get_width()
                            total = (
                                pd.DataFrame(tables[0]["total"]["N (Frequency)"])
                                .T.sum(axis=1)
                                .values[0]
                            )
                            label = f"{int(round(width / total * 100))}%"
                            ax.text(
                                bar.get_x() + width / 2,
                                bar.get_y() + bar.get_height() / 2,
                                label,
                                ha="center",
                                va="center",
                                color="white",
                            )

                    ax.spines["top"].set_visible(False)
                    ax.spines["right"].set_visible(False)
                    ax.spines["left"].set_visible(False)
                    ax.spines["bottom"].set_visible(False)
                    ax.xaxis.set_visible(False)
                    ax.yaxis.set_visible(False)
                    ax.tick_params(axis="both", which="both", length=0)
                    ax.legend(
                        loc="upper center",
                        bbox_to_anchor=(0.5, -0.1),
                        ncol=len(tables[0]["total"]),
                        frameon=False,
                    )
                    plt.tight_layout()

                plt.savefig(img_path, transparent=True)
                plt.close()

            # Render template
            template_path = os.path.join(SCRIPT_DIR, "assets", "topline.md")
            with open(template_path, "r") as f:
                template = f.read()

            data["starttime"] = data["starttime"].replace(
                {"0000-00-00 00:00:00": pd.NaT}
            )
            startdate = data["starttime"].min().strftime("%b %d")

            data["endtime"] = data["endtime"].replace({"0000-00-00 00:00:00": pd.NaT})
            enddate = data["endtime"].max().strftime("%b %d")

            date = f"{startdate} - {enddate} ({year})"
            rendered = Template(template).render(
                n=f"{data.shape[0]}",
                date=date,
                **formatted_tables,
            )

            topline_filename = f"s{survey}-{year}_week{week}"
            md_path = os.path.join(temp_dir, topline_filename + ".md")
            with open(md_path, "w") as f:
                f.write(rendered)

            env = os.environ.copy()
            assets_dir = os.path.join(SCRIPT_DIR, "assets")
            env["TEXINPUTS"] = f"{assets_dir}:{assets_dir}//:"
            subprocess.run(
                [
                    "pandoc",
                    md_path,
                    "-o",
                    os.path.join(temp_dir, topline_filename + ".pdf"),
                    f"--resource-path={assets_dir}",
                ],
                check=True,
                env=env,
            )

            bucket.upload_file(
                os.path.join(temp_dir, topline_filename + ".pdf"),
                f"toplines/{topline_filename}.pdf",
            )
            generated += 1
            print(f"  Uploaded toplines/{topline_filename}.pdf")

    return {"generated": generated, "skipped": skipped}
