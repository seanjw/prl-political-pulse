"""
Static Tortoise ORM model definitions for the Pulse database.
Column definitions match the actual Aurora MySQL schema.
"""

from tortoise import fields
from tortoise.models import Model


class Data(Model):
    id = fields.IntField(pk=True)
    endpoint = fields.TextField(null=True)
    data = fields.JSONField(null=True)

    class Meta:
        table = "data"


class Legislators(Model):
    id = fields.IntField(pk=True)
    bioguide_id = fields.TextField(null=True)
    first_name = fields.TextField(null=True)
    last_name = fields.TextField(null=True)
    party = fields.TextField(null=True)
    state = fields.TextField(null=True)
    scores = fields.JSONField(null=True)
    type = fields.TextField(null=True)
    state_name = fields.TextField(null=True)
    level = fields.TextField(null=True)
    name = fields.TextField(null=True)
    source_id = fields.TextField(null=True)
    image_url = fields.TextField(null=True)

    class Meta:
        table = "legislators"


class FederalProfiles(Model):
    id = fields.IntField(pk=True)
    first_name = fields.TextField(null=True)
    last_name = fields.TextField(null=True)
    gender = fields.TextField(null=True)
    state = fields.TextField(null=True)
    party = fields.TextField(null=True)
    government_website = fields.TextField(null=True)
    twitter_id = fields.TextField(null=True)
    facebook = fields.TextField(null=True)
    district = fields.TextField(null=True)
    type = fields.TextField(null=True)
    bioguide_id = fields.TextField(null=True)
    serving_public_since = fields.DatetimeField(null=True)
    serving_position_since = fields.DatetimeField(null=True)
    federal = fields.JSONField(null=True)
    birthday = fields.TextField(null=True)
    ideology_ideology = fields.FloatField(null=True)
    ideology_ideology_rank_lib = fields.FloatField(null=True)
    ideology_ideology_rank_con = fields.TextField(null=True)
    ideology_ideology_percentile_lib = fields.FloatField(null=True)
    ideology_ideology_percentile_con = fields.TextField(null=True)
    ideology_propublica = fields.JSONField(null=True)
    ideology_last_update = fields.DatetimeField(null=True)
    ideology_rank = fields.FloatField(null=True)
    ideology_percentile = fields.FloatField(null=True)
    ideology_rank_max = fields.FloatField(null=True)
    efficacy_sponsored = fields.JSONField(null=True)
    efficacy_cosponsored = fields.JSONField(null=True)
    efficacy_topics = fields.JSONField(null=True)
    efficacy_last_update = fields.DatetimeField(null=True)
    attendance_total = fields.BigIntField(null=True)
    attendance_max = fields.BigIntField(null=True)
    attendance_avg = fields.BigIntField(null=True)
    attendance_last_update = fields.DatetimeField(null=True)
    money_total_money = fields.FloatField(null=True)
    money_total_money_avg = fields.FloatField(null=True)
    money_total_ind_don = fields.FloatField(null=True)
    money_total_ind_don_avg = fields.FloatField(null=True)
    money_instate_total = fields.FloatField(null=True)
    money_instate_count = fields.FloatField(null=True)
    money_outstate_total = fields.FloatField(null=True)
    money_outstate_count = fields.FloatField(null=True)
    money_state_map = fields.JSONField(null=True)
    money_total_money_rank = fields.FloatField(null=True)
    money_total_ind_don_rank = fields.FloatField(null=True)
    money_last_update = fields.DatetimeField(null=True)
    communication_count = fields.BigIntField(null=True)
    communication_attack_personal_sum = fields.BigIntField(null=True)
    communication_outcome_creditclaiming_sum = fields.FloatField(null=True)
    communication_policy_sum = fields.FloatField(null=True)
    communication_policy_legislative_discussion_sum = fields.FloatField(null=True)
    communication_outcome_bipartisanship_sum = fields.FloatField(null=True)
    communication_attack_personal_mean = fields.FloatField(null=True)
    communication_outcome_creditclaiming_mean = fields.FloatField(null=True)
    communication_policy_mean = fields.FloatField(null=True)
    communication_policy_legislative_discussion_mean = fields.FloatField(null=True)
    communication_outcome_bipartisanship_mean = fields.FloatField(null=True)
    communication_party = fields.TextField(null=True)
    communication_attack_personal_rank = fields.FloatField(null=True)
    communication_outcome_creditclaiming_rank = fields.FloatField(null=True)
    communication_policy_rank = fields.FloatField(null=True)
    communication_policy_legislative_discussion_rank = fields.FloatField(null=True)
    communication_outcome_bipartisanship_rank = fields.FloatField(null=True)
    communication_source = fields.TextField(null=True)
    communication_attack_personal_count = fields.BigIntField(null=True)
    communication_outcome_creditclaiming_count = fields.BigIntField(null=True)
    communication_policy_count = fields.BigIntField(null=True)
    communication_policy_legislative_discussion_count = fields.BigIntField(null=True)
    communication_outcome_bipartisanship_count = fields.BigIntField(null=True)
    communication_attack_policy_count = fields.BigIntField(null=True)
    communication_attack_policy_sum = fields.FloatField(null=True)
    communication_attack_policy_mean = fields.FloatField(null=True)
    communication_attack_policy_rank = fields.FloatField(null=True)
    communication_attack_count = fields.TextField(null=True)
    communication_attack_sum = fields.TextField(null=True)
    communication_attack_mean = fields.TextField(null=True)
    communication_attack_rank = fields.TextField(null=True)
    communication_last_update = fields.DatetimeField(null=True)
    next_election = fields.BigIntField(null=True)
    communication_scores = fields.JSONField(null=True)
    communication_scores_by_source = fields.JSONField(null=True)
    communication_examples = fields.JSONField(null=True)
    state_name = fields.TextField(null=True)
    source_id = fields.TextField(null=True)
    level = fields.TextField(null=True)
    image_url = fields.TextField(null=True)
    posts = fields.JSONField(null=True)

    class Meta:
        table = "federal_profiles"


class StateProfiles(Model):
    id = fields.IntField(pk=True)
    gender = fields.TextField(null=True)
    state = fields.TextField(null=True)
    title = fields.TextField(null=True)
    party = fields.TextField(null=True)
    email = fields.TextField(null=True)
    government_website = fields.TextField(null=True)
    campaign_website = fields.TextField(null=True)
    linkedin = fields.TextField(null=True)
    twitter_handle = fields.TextField(null=True)
    twitter_id = fields.TextField(null=True)
    facebook = fields.TextField(null=True)
    instagram = fields.TextField(null=True)
    youtube = fields.TextField(null=True)
    truth_social = fields.TextField(null=True)
    position = fields.TextField(null=True)
    level = fields.TextField(null=True)
    district = fields.TextField(null=True)
    tiktok = fields.TextField(null=True)
    date_elected = fields.DatetimeField(null=True)
    type = fields.TextField(null=True)
    serving_public_since = fields.DatetimeField(null=True)
    serving_position_since = fields.DatetimeField(null=True)
    birthday = fields.TextField(null=True)
    name = fields.TextField(null=True)
    state_abbr = fields.TextField(null=True)
    birth_date = fields.TextField(null=True)
    source_id = fields.TextField(null=True)
    image_url = fields.TextField(null=True)
    rhetoric = fields.JSONField(null=True)
    posts = fields.JSONField(null=True)

    class Meta:
        table = "state_profiles"


class PrimaryStatements(Model):
    id = fields.BigIntField(pk=True)
    candidate_id = fields.TextField(null=True)
    date = fields.DateField(null=True)
    source = fields.TextField(null=True)
    text = fields.TextField(null=True)
    categories = fields.JSONField(null=True)
    tweet_id = fields.TextField(null=True)

    class Meta:
        table = "primary_statements"


class DownloadCounts(Model):
    id = fields.IntField(pk=True)
    file = fields.TextField(null=True)
    downloads = fields.BigIntField(null=True)

    class Meta:
        table = "download_counts"
