-- Diagnosticos para cobertura market_value (Transfermarkt) em mart.player_dim.
-- Substitui 2025 se a tua season for outra.

-- 1) Resumo geral
select
  count(*) as total_players,
  count(*) filter (where market_value_eur is not null) as com_valor,
  count(*) filter (where market_value_eur is null) as sem_valor,
  count(*) filter (where trim(coalesce(last_club, '')) = '') as sem_last_club
from mart.player_dim;

-- 2) Versoes de match
select coalesce(market_value_match_version, '(null)') as versao, count(*) as n
from mart.player_dim
where market_value_eur is not null
group by 1
order by 2 desc;

-- 3) Sem valor mas com last_club: nome normalizado aparece na ref?
with dim_miss as (
  select
    d.player_id,
    mart.normalize_match_text(d.player_name) as name_norm
  from mart.player_dim d
  where d.market_value_eur is null
    and trim(coalesce(d.last_club, '')) <> ''
),
ref_names as (
  select distinct mart.normalize_match_text(r.player_name) as name_norm
  from mart.transfermarkt_market_value_ref r
  where r.season_id = 2025
    and r.market_value_eur is not null
)
select
  count(*) filter (where dm.name_norm in (select name_norm from ref_names)) as com_nome_na_ref,
  count(*) filter (where dm.name_norm not in (select name_norm from ref_names)) as nome_ausente_na_ref
from dim_miss dm;

-- 4) nationality_code em jogadores sem valor (para expandir nationality_code_norm_tokens)
select d.nationality_code, count(*) as n
from mart.player_dim d
where d.market_value_eur is null
  and trim(coalesce(d.nationality_code, '')) <> ''
group by 1
order by 2 desc
limit 50;

-- 5) Jogadores distintos TM na ref (teto aproximado)
select count(distinct tm_player_id) as tm_jogadores_distintos
from mart.transfermarkt_market_value_ref
where season_id = 2025
  and market_value_eur is not null;
