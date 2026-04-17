"""Utility functions for international survey toplines."""

import datetime

import numpy as np
import pandas as pd


def weighted_percentile(series, weights, percentile):
    """Weighted percentile.

    From prooffreader @ https://stackoverflow.com/a/35349142
    """
    df = pd.concat([series, weights], axis=1)
    df.sort_values(df.columns[0], inplace=True)
    cumsum = df["weight"].cumsum()
    cutoff = df["weight"].sum() * percentile
    return df[df.columns[0]][cumsum >= cutoff].iloc[0]


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


def categorize_age(birthyr):
    current_year = datetime.datetime.now().year
    age = current_year - birthyr
    if age >= 18 and age <= 34:
        return "18-34"
    elif age >= 35 and age <= 50:
        return "35-50"
    elif age >= 51 and age <= 69:
        return "51-69"
    else:
        return "70+"
