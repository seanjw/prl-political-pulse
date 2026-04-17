"""Survey utility functions for weighted statistics and demographic recoding."""

import datetime

import numpy as np
import pandas as pd


def weighted_mean(series, weights):
    return np.average(series[~np.isnan(series)], weights=weights[~np.isnan(series)])


def agg_weighted_mean(x, data):
    """Weighted mean for use with groupby apply.

    From pansen @ https://stackoverflow.com/a/43049373/6794367
    """
    dropped = x.dropna()
    if x[dropped.index].shape[0] == 0:
        return np.nan
    else:
        return np.average(dropped, weights=data.loc[dropped.index, "weight"])


def remove_disengaged(data):
    return data[
        (
            (data["engaged"] == 7)
            & (data["year"] == 2022)
            & ((data["week"] == 40) | (data["week"] == 39))
        )
        | (
            (data["engaged"] == 1)
            & ~((data["year"] == 2022) & ((data["week"] == 40) | (data["week"] == 39)))
        )
        | ((data["engaged"] == 1) & ((data["year"] == 2023) & (data["week"] < 25)))
        | (data["engaged"] == True)  # noqa: E712 — pandas Series comparison
    ]


def recode_violence_or_norm_measures(x):
    if pd.isna(x):
        return 5
    else:
        return x


def binarize_violence(x):
    if x > 2:
        return 0
    elif x <= 2:
        return 1


def get_partisanship(pid7):
    pid = pid7.apply(lambda x: None)
    pid.loc[pid7 < 4] = "1"
    pid.loc[(pid7 > 4) & (pid7 < 8)] = "2"
    pid.loc[(pid7 == 4) | (pid7 >= 8)] = "3"
    return pid


def get_age(birthyr, coding="category"):
    current_year = datetime.datetime.now().year
    age = current_year - birthyr
    if coding == "category":
        age = age.apply(categorize_age)
    elif coding == "id":
        age = age.apply(categorize_age_id)
    return age


def categorize_age(age):
    if age >= 18 and age <= 34:
        return "18-34"
    elif age >= 35 and age <= 50:
        return "35-50"
    elif age >= 51 and age <= 69:
        return "51-69"
    else:
        return "70+"


def categorize_age_id(age):
    if age >= 18 and age <= 34:
        return "1"
    elif age >= 35 and age <= 50:
        return "2"
    elif age >= 51 and age <= 69:
        return "3"
    else:
        return "4"


def get_affpol(data):
    data["pid"] = get_partisanship(data["pid7"])
    data["affpol"] = None
    data.loc[data["pid"] == "1", "affpol"] = (
        data.loc[data["pid"] == "1", "democrat_therm_1"]
        - data.loc[data["pid"] == "1", "republican_therm_1"]
    )
    data.loc[data["pid"] == "2", "affpol"] = (
        data.loc[data["pid"] == "2", "republican_therm_1"]
        - data.loc[data["pid"] == "2", "democrat_therm_1"]
    )
    return data


def remove_nonpartisans(data):
    """Filter to partisans only (pid == '1' or '2').

    Expects the column "pid" — run get_partisanship() first.
    """
    return data[data["pid"].isin(["1", "2"])]


def weighted_describe(series, weights):
    weights = weights.astype(float)
    weighted_series = series * weights
    weighted_sum = weighted_series.sum()
    sum_weights = weights.sum()
    count = len(series)

    w_mean = weighted_sum / sum_weights
    weighted_var = np.sum(weights * (series - w_mean) ** 2) / (sum_weights - 1)
    weighted_std = np.sqrt(weighted_var)

    weighted_descriptive = {
        "count": count,
        "mean": w_mean,
        "stdev": weighted_std,
        "min": series.min(),
        "25%": weighted_percentile(series, weights, 0.25),
        "50%": weighted_percentile(series, weights, 0.50),
        "75%": weighted_percentile(series, weights, 0.75),
        "max": series.max(),
    }
    return pd.Series(weighted_descriptive)


def weighted_percentile(series, weights, percentile):
    """Weighted percentile.

    From prooffreader @ https://stackoverflow.com/a/35349142
    """
    df = pd.concat([series, weights], axis=1)
    df.sort_values(df.columns[0], inplace=True)
    cumsum = df["weight"].cumsum()
    cutoff = df["weight"].sum() * percentile
    return df[df.columns[0]][cumsum >= cutoff].iloc[0]
