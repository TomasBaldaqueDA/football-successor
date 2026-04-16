-- mart.role_metric_weights (Role replacement)
-- v1_manual: pesos por `position_bucket` que definem o role_score.
--
-- Run in Supabase SQL Editor (or psql).

create schema if not exists mart;

create table if not exists mart.role_metric_weights (
  position_bucket text not null,
  metric_column text not null,
  weight numeric not null check (weight >= 0),
  weight_version text not null default 'v1_manual',
  primary key (position_bucket, metric_column, weight_version)
);

-- Reinsere apenas a versão pedida (idempotente).
delete from mart.role_metric_weights
where weight_version = 'v1_manual';

insert into mart.role_metric_weights (position_bucket, metric_column, weight, weight_version) values
-- CB (DC)
('CB','aerial_won_p90_adj_merged',0.18,'v1_manual'),
('CB','interceptions_p90_adj_merged',0.17,'v1_manual'),
('CB','tackles_p90_adj_merged',0.13,'v1_manual'),
('CB','blocks_p90_adj_merged',0.08,'v1_manual'),
('CB','pass_success_pct_adj_merged',0.09,'v1_manual'),
('CB','passes_p90_adj_merged',0.08,'v1_manual'),
('CB','xg_per_90_adj_merged',0.03,'v1_manual'),
('CB','accurate_long_passes_p90_adj_merged',0.04,'v1_manual'),
('CB','dribbles_won_p90_adj_merged',0.04,'v1_manual'),
('CB','dispossessed_p90_adj_merged',0.05,'v1_manual'),
('CB','turnovers_p90_adj_merged',0.03,'v1_manual'),
('CB','offsides_p90_adj_merged',0.03,'v1_manual'),
('CB','fouls_defensive_p90_adj_merged',0.05,'v1_manual'),

-- FB (Lateral)
('FB','accurate_crosses_p90_adj_merged',0.18,'v1_manual'),
('FB','key_passes_p90_adj_merged',0.14,'v1_manual'),
('FB','dribbles_won_p90_adj_merged',0.10,'v1_manual'),
('FB','passes_p90_adj_merged',0.10,'v1_manual'),
('FB','pass_success_pct_adj_merged',0.08,'v1_manual'),
('FB','accurate_long_passes_p90_adj_merged',0.02,'v1_manual'),
('FB','xg_per_90_adj_merged',0.06,'v1_manual'),
('FB','tackles_p90_adj_merged',0.08,'v1_manual'),
('FB','interceptions_p90_adj_merged',0.04,'v1_manual'),
('FB','blocks_p90_adj_merged',0.04,'v1_manual'),
('FB','dispossessed_p90_adj_merged',0.04,'v1_manual'),
('FB','dribbled_past_p90_adj_merged',0.05,'v1_manual'),
('FB','turnovers_p90_adj_merged',0.04,'v1_manual'),
('FB','fouls_defensive_p90_adj_merged',0.03,'v1_manual'),

-- DM
('DM','interceptions_p90_adj_merged',0.18,'v1_manual'),
('DM','tackles_p90_adj_merged',0.16,'v1_manual'),
('DM','blocks_p90_adj_merged',0.08,'v1_manual'),
('DM','pass_success_pct_adj_merged',0.10,'v1_manual'),
('DM','passes_p90_adj_merged',0.12,'v1_manual'),
('DM','accurate_long_passes_p90_adj_merged',0.05,'v1_manual'),
('DM','xg_per_90_adj_merged',0.07,'v1_manual'),
('DM','accurate_through_balls_p90_adj_merged',0.04,'v1_manual'),
('DM','dispossessed_p90_adj_merged',0.05,'v1_manual'),
('DM','turnovers_p90_adj_merged',0.01,'v1_manual'),
('DM','dribbled_past_p90_adj_merged',0.05,'v1_manual'),
('DM','fouls_defensive_p90_adj_merged',0.05,'v1_manual'),
('DM','dribbles_won_p90_adj_merged',0.04,'v1_manual'),

-- CM
('CM','passes_p90_adj_merged',0.10,'v1_manual'),
('CM','pass_success_pct_adj_merged',0.10,'v1_manual'),
('CM','key_passes_p90_adj_merged',0.12,'v1_manual'),
('CM','accurate_through_balls_p90_adj_merged',0.10,'v1_manual'),
('CM','accurate_long_passes_p90_adj_merged',0.08,'v1_manual'),
('CM','dribbles_won_p90_adj_merged',0.06,'v1_manual'),
('CM','tackles_p90_adj_merged',0.08,'v1_manual'),
('CM','interceptions_p90_adj_merged',0.05,'v1_manual'),
('CM','blocks_p90_adj_merged',0.02,'v1_manual'),
('CM','xg_per_90_adj_merged',0.09,'v1_manual'),
('CM','turnovers_p90_adj_merged',0.05,'v1_manual'),
('CM','dispossessed_p90_adj_merged',0.05,'v1_manual'),
('CM','fouls_defensive_p90_adj_merged',0.04,'v1_manual'),
('CM','aerial_won_p90_adj_merged',0.06,'v1_manual'),

-- AM
('AM','key_passes_p90_adj_merged',0.20,'v1_manual'),
('AM','assists_p90_adj_merged',0.12,'v1_manual'),
('AM','xg_per_90_adj_merged',0.14,'v1_manual'),
('AM','shots_p90_adj_merged',0.08,'v1_manual'),
('AM','passes_p90_adj_merged',0.10,'v1_manual'),
('AM','accurate_through_balls_p90_adj_merged',0.08,'v1_manual'),
('AM','dribbles_won_p90_adj_merged',0.06,'v1_manual'),
('AM','accurate_long_passes_p90_adj_merged',0.05,'v1_manual'),
('AM','accurate_crosses_p90_adj_merged',0.03,'v1_manual'),
('AM','turnovers_p90_adj_merged',0.06,'v1_manual'),
('AM','dispossessed_p90_adj_merged',0.04,'v1_manual'),
('AM','offsides_p90_adj_merged',0.04,'v1_manual'),

-- W
('W','dribbles_won_p90_adj_merged',0.22,'v1_manual'),
('W','goals_p90_adj_merged',0.10,'v1_manual'),
('W','xg_per_90_adj_merged',0.12,'v1_manual'),
('W','assists_p90_adj_merged',0.10,'v1_manual'),
('W','accurate_crosses_p90_adj_merged',0.12,'v1_manual'),
('W','key_passes_p90_adj_merged',0.10,'v1_manual'),
('W','shots_p90_adj_merged',0.06,'v1_manual'),
('W','passes_p90_adj_merged',0.06,'v1_manual'),
('W','pass_success_pct_adj_merged',0.04,'v1_manual'),
('W','interceptions_p90_adj_merged',0.03,'v1_manual'),
('W','dispossessed_p90_adj_merged',0.03,'v1_manual'),
('W','dribbled_past_p90_adj_merged',0.02,'v1_manual'),

-- ST
('ST','goals_p90_adj_merged',0.27,'v1_manual'),
('ST','xg_per_90_adj_merged',0.21,'v1_manual'),
('ST','shots_p90_adj_merged',0.16,'v1_manual'),
('ST','assists_p90_adj_merged',0.07,'v1_manual'),
('ST','dribbles_won_p90_adj_merged',0.08,'v1_manual'),
('ST','key_passes_p90_adj_merged',0.05,'v1_manual'),
('ST','accurate_through_balls_p90_adj_merged',0.06,'v1_manual'),
('ST','pass_success_pct_adj_merged',0.04,'v1_manual'),
('ST','turnovers_p90_adj_merged',0.04,'v1_manual'),
('ST','offsides_p90_adj_merged',0.02,'v1_manual');

-- Verificação: cada bucket deve somar 1.00
select
  position_bucket,
  round(sum(weight)::numeric, 6) as s
from mart.role_metric_weights
where weight_version = 'v1_manual'
group by position_bucket
order by position_bucket;

