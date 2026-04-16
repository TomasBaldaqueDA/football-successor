-- Role neighbors: same bucket, role outcome similarity via role_score
-- score:
--   role_score = sum_i (w_i * metric_i) where metric_i are *_adj_merged columns
-- ranking:
--   role_distance = abs(role_score_cand - role_score_target)
-- output:
--   role_score_final = 100/(1+role_distance)
--
-- Expects:
--   mart.role_metric_weights exists (run mart_role_metric_weights_v1_manual.sql first)

create schema if not exists mart;

drop function if exists mart.role_neighbors(bigint, text, int, text, int, int);

create or replace function mart.role_neighbors(
  p_target_player_id bigint,
  p_selected_bucket text,
  p_top_n int default 20,
  p_weight_version text default 'v1_manual',
  p_min_age int default null,
  p_max_age int default null
)
returns table (
  role_rank bigint,
  player_id bigint,
  player_name text,
  role_distance double precision,
  role_score_final double precision,
  role_score double precision
)
language sql
stable
parallel safe
as $fn$
with
tgt as (
  select to_jsonb(m) as j
  from mart.player_profile_merged_v1 m
  where m.player_id = p_target_player_id
),
tgt_has_bucket as (
  select 1 as ok
  from mart.player_position_membership pm
  where pm.player_id = p_target_player_id
    and pm.position_bucket = p_selected_bucket
  limit 1
),
weights as (
  select
    w.metric_column,
    w.weight::double precision as weight
  from mart.role_metric_weights w
  where w.position_bucket = p_selected_bucket
    and w.weight_version = p_weight_version
),
candidates as (
  select m.player_id, to_jsonb(m) as j
  from mart.player_profile_merged_v1 m
  join mart.player_position_membership pm
    on pm.player_id = m.player_id
   and pm.position_bucket = p_selected_bucket
  join mart.player_dim dim
    on dim.player_id = m.player_id
  where m.player_id <> p_target_player_id
    and (
      (p_min_age is null and p_max_age is null)
      or (
        dim.age_last_season is not null
        and (p_min_age is null or dim.age_last_season >= p_min_age)
        and (p_max_age is null or dim.age_last_season <= p_max_age)
      )
    )
),
role_target as (
  select
    coalesce(sum(
      w.weight * coalesce((t.j ->> w.metric_column)::double precision, 0.0)
    ), 0.0) as role_score_target
  from tgt t
  cross join weights w
  where exists (select 1 from tgt_has_bucket)
),
role_scores as (
  select
    c.player_id,
    coalesce(sum(
      w.weight * coalesce((c.j ->> w.metric_column)::double precision, 0.0)
    ), 0.0) as role_score
  from candidates c
  cross join weights w
  where exists (select 1 from tgt_has_bucket)
  group by c.player_id
),
role_sd as (
  select stddev_samp(role_score) as sd
  from role_scores
),
ranked as (
  select
    rs.player_id,
    rs.role_score,
    (abs(rs.role_score - rt.role_score_target) / coalesce(nullif(role_sd.sd, 0), 1)) as role_distance
  from role_scores rs
  cross join role_target rt
  cross join role_sd
)
select
  row_number() over (order by r.role_distance asc)::bigint as role_rank,
  r.player_id,
  coalesce(dim.player_name, ''::text) as player_name,
  r.role_distance,
  (100.0::double precision / (1.0::double precision + r.role_distance)) as role_score_final,
  r.role_score
from ranked r
left join mart.player_dim dim on dim.player_id = r.player_id
order by r.role_distance asc
limit greatest(coalesce(nullif(p_top_n, 0), 20), 1);
$fn$;

comment on function mart.role_neighbors(bigint, text, int, text, int, int) is
  'Role replacement: same selected_bucket, score via role_score (weighted sum of *_adj_merged) and rank by abs difference vs target.';

-- Example:
-- select * from mart.role_neighbors(12345::bigint, 'DM', 20, 'v1_manual', 24, 30);

