-- Like-for-Like neighbors: weighted L2 on *_adj_merged via mart.l4l_metric_weights.
-- Expects: mart.l4l_metric_weights(position_bucket, metric_column, weight, weight_version)
--          metric_column = physical column name on mart.player_profile_merged_v1 (json keys match).
--
-- Run in Supabase SQL Editor (or psql). Adjust GRANTs for your roles.

drop function if exists mart.l4l_neighbors(bigint, text, int, text);

create or replace function mart.l4l_neighbors(
  p_target_player_id bigint,
  p_selected_bucket text,
  p_top_n int default 20,
  p_weight_version text default 'v1_manual',
  p_min_age int default null,
  p_max_age int default null
)
returns table (
  l4l_rank bigint,
  player_id bigint,
  player_name text,
  l2_distance double precision,
  l4l_score double precision
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
  from mart.l4l_metric_weights w
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
dist as (
  select
    c.player_id,
    sqrt(
      sum(
        w.weight * power(
          coalesce((c.j ->> w.metric_column)::double precision, 0.0)
          - coalesce((t.j ->> w.metric_column)::double precision, 0.0),
          2.0
        )
      )
    ) as l2_distance
  from candidates c
  cross join tgt t
  cross join weights w
  where exists (select 1 from tgt)
    and exists (select 1 from tgt_has_bucket)
  group by c.player_id, t.j
)
select
  row_number() over (order by d.l2_distance asc)::bigint as l4l_rank,
  d.player_id,
  coalesce(dim.player_name, ''::text) as player_name,
  d.l2_distance,
  (100.0::double precision / (1.0::double precision + d.l2_distance)) as l4l_score
from dist d
left join mart.player_dim dim on dim.player_id = d.player_id
order by d.l2_distance asc
limit greatest(coalesce(nullif(p_top_n, 0), 20), 1);
$fn$;

comment on function mart.l4l_neighbors(bigint, text, int, text, int, int) is
  'L4L ranking: sqrt(sum w*(c-t)^2); candidates filtered by optional age (player_dim.age_last_season).';

-- Example:
-- select * from mart.l4l_neighbors(12345::bigint, 'AM', 20, 'v1_manual', 22, 30);
