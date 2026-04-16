-- Fallback Transfermarkt: nome + nacionalidade (sem clube).
-- Pré-requisito: schema mart, mart.normalize_match_text, mart.transfermarkt_market_value_ref, mart.player_dim (já exigidos pelo mart_player_dim_market_value.sql).
--
-- No Supabase SQL Editor: cola e executa ESTE ficheiro inteiro (Run, sem row limit).
-- Depois: select mart.apply_transfermarkt_market_to_player_dim_nationality_fallback(2025, true);
-- (Se a função ainda não existir, 42883 ocorre; casts não resolvem.)
-- Tokens normalizados (igual a mart.normalize_match_text nos nomes PT do TM) a partir do nationality_code em player_dim.
create or replace function mart.nationality_code_norm_tokens(p_code text)
returns text[]
language plpgsql
immutable
parallel safe
as $nat$
declare
  c text := upper(trim(both from coalesce(p_code, '')));
  n text;
begin
  if c = '' then
    return '{}'::text[];
  end if;

  if c in ('POR', 'PT') then return array['portugal']::text[]; end if;
  if c in ('ESP', 'ES') then return array['espanha']::text[]; end if;
  if c in ('FRA', 'FR') then return array['franca']::text[]; end if;
  if c in ('ENG', 'GB', 'GBR') then return array['inglaterra']::text[]; end if;
  if c in ('SCO', 'SCT') then return array['escocia']::text[]; end if;
  if c in ('WAL', 'WLS') then return array['pais de gales', 'gales']::text[]; end if;
  if c in ('NIR') then return array['irlanda do norte']::text[]; end if;
  if c in ('IRL', 'IE') then return array['irlanda']::text[]; end if;
  if c in ('GER', 'DEU', 'DE') then return array['alemanha']::text[]; end if;
  if c in ('ITA', 'IT') then return array['italia']::text[]; end if;
  if c in ('NED', 'NLD', 'NL') then return array['holanda', 'paises baixos']::text[]; end if;
  if c in ('BEL', 'BE') then return array['belgica']::text[]; end if;
  if c in ('SUI', 'CHE', 'CH') then return array['suica']::text[]; end if;
  if c in ('AUT', 'AT') then return array['austria']::text[]; end if;
  if c in ('POL', 'PL') then return array['polonia']::text[]; end if;
  if c in ('CZE', 'CZECHIA', 'CZ') then return array['republica checa', 'chequia']::text[]; end if;
  if c in ('SVK', 'SK') then return array['eslovaquia']::text[]; end if;
  if c in ('HUN', 'HU') then return array['hungria']::text[]; end if;
  if c in ('ROU', 'RO') then return array['romenia']::text[]; end if;
  if c in ('BGR', 'BG') then return array['bulgaria']::text[]; end if;
  if c in ('GRC', 'GR') then return array['grecia']::text[]; end if;
  if c in ('TUR', 'TR') then return array['turquia']::text[]; end if;
  if c in ('HRV', 'CRO') then return array['croacia']::text[]; end if;
  if c in ('SRB', 'RS') then return array['servia']::text[]; end if;
  if c in ('SVN', 'SI') then return array['eslovenia']::text[]; end if;
  if c in ('BIH', 'BA') then return array['bosnia herzegovina']::text[]; end if;
  if c in ('MNE') then return array['montenegro']::text[]; end if;
  if c in ('MKD', 'MK') then return array['macedonia do norte']::text[]; end if;
  if c in ('ALB', 'AL') then return array['albania']::text[]; end if;
  if c in ('KOS', 'KVX') then return array['kosovo']::text[]; end if;
  if c in ('UKR', 'UA') then return array['ucrania']::text[]; end if;
  if c in ('RUS', 'RU') then return array['russia']::text[]; end if;
  if c in ('SWE', 'SE') then return array['suecia']::text[]; end if;
  if c in ('NOR', 'NO') then return array['noruega']::text[]; end if;
  if c in ('DNK', 'DEN', 'DK') then return array['dinamarca']::text[]; end if;
  if c in ('FIN', 'FI') then return array['finlandia']::text[]; end if;
  if c in ('ISL', 'IS') then return array['islandia']::text[]; end if;
  if c in ('EST', 'EE') then return array['estonia']::text[]; end if;
  if c in ('LVA', 'LV') then return array['letonia']::text[]; end if;
  if c in ('LTU', 'LT') then return array['lituania']::text[]; end if;
  if c in ('LUX', 'LU') then return array['luxemburgo']::text[]; end if;
  if c in ('MLT', 'MT') then return array['malta']::text[]; end if;
  if c in ('CYP', 'CY') then return array['chipre']::text[]; end if;
  if c in ('ISR', 'IL') then return array['israel']::text[]; end if;
  if c in ('BRA', 'BR') then return array['brasil']::text[]; end if;
  if c in ('ARG', 'AR') then return array['argentina']::text[]; end if;
  if c in ('URY', 'URU') then return array['uruguai']::text[]; end if;
  if c in ('PAR', 'PRY') then return array['paraguai']::text[]; end if;
  if c in ('CHI', 'CHL', 'CL') then return array['chile']::text[]; end if;
  if c in ('COL', 'CO') then return array['colombia']::text[]; end if;
  if c in ('ECU', 'EC') then return array['equador']::text[]; end if;
  if c in ('PER', 'PE') then return array['peru']::text[]; end if;
  if c in ('BOL', 'BO') then return array['bolivia']::text[]; end if;
  if c in ('VEN', 'VE') then return array['venezuela']::text[]; end if;
  if c in ('MEX', 'MX') then return array['mexico']::text[]; end if;
  if c in ('USA', 'US') then return array['estados unidos']::text[]; end if;
  if c in ('CAN', 'CA') then return array['canada']::text[]; end if;
  if c in ('SEN', 'SN') then return array['senegal']::text[]; end if;
  if c in ('GHA', 'GH') then return array['gana']::text[]; end if;
  if c in ('NGA', 'NG') then return array['nigeria']::text[]; end if;
  if c in ('CIV') then return array['costa do marfim']::text[]; end if;
  if c in ('MAR', 'MA') then return array['marrocos']::text[]; end if;
  if c in ('TUN', 'TN') then return array['tunisia']::text[]; end if;
  if c in ('DZA', 'ALG') then return array['argelia']::text[]; end if;
  if c in ('EGY', 'EG') then return array['egipto']::text[]; end if;
  if c in ('CMR', 'CM') then return array['camaroes']::text[]; end if;
  if c in ('RSA', 'ZAF', 'ZA') then return array['africa do sul']::text[]; end if;
  if c in ('ZAM', 'ZM') then return array['zambia']::text[]; end if;
  if c in ('JPN', 'JP') then return array['japao']::text[]; end if;
  if c in ('KOR', 'KR') then return array['coreia do sul']::text[]; end if;
  if c in ('CHN', 'CN') then return array['china']::text[]; end if;
  if c in ('AUS', 'AU') then return array['australia']::text[]; end if;
  if c in ('IRN', 'IR') then return array['irao']::text[]; end if;

  n := mart.normalize_match_text(p_code);
  if n is null or n = '' then
    return '{}'::text[];
  end if;
  return array[n]::text[];
end;
$nat$;

comment on function mart.nationality_code_norm_tokens(text) is
  'Converte nationality_code (FIFA/ISO) em tokens normalizados para cruzar com nationalities do Transfermarkt (PT).';

create or replace function mart.apply_transfermarkt_market_to_player_dim_nationality_fallback(
  p_season_id int default 2025,
  p_only_where_market_null boolean default true
)
returns int
language plpgsql
volatile
as $nfn$
declare
  n int;
begin
  with ref_nat as (
    select
      r.tm_player_id,
      r.player_name,
      r.club_name,
      r.market_value_text,
      r.market_value_eur,
      mart.normalize_match_text(r.player_name) as name_norm,
      coalesce(
        array(
          select distinct tok
          from (
            select mart.normalize_match_text(trim(x)) as tok
            from unnest(string_to_array(coalesce(r.nationalities, ''), '|')) as u(x)
          ) s
          where tok is not null
        ),
        '{}'::text[]
      ) as nat_tokens
    from mart.transfermarkt_market_value_ref r
    where r.season_id = p_season_id
      and r.market_value_eur is not null
      and trim(coalesce(r.nationalities, '')) <> ''
  ),
  dim_nat as (
    select
      d.player_id,
      mart.normalize_match_text(d.player_name) as name_norm,
      mart.nationality_code_norm_tokens(d.nationality_code) as dim_nat_tokens
    from mart.player_dim d
    where trim(coalesce(d.nationality_code, '')) <> ''
      and (
        not p_only_where_market_null
        or d.market_value_eur is null
      )
  ),
  best as (
    select distinct on (dn.player_id)
      dn.player_id,
      rn.market_value_eur,
      rn.market_value_text,
      rn.tm_player_id,
      rn.club_name as matched_club_name
    from dim_nat dn
    join ref_nat rn
      on rn.name_norm = dn.name_norm
    where cardinality(rn.nat_tokens) > 0
      and cardinality(dn.dim_nat_tokens) > 0
      and rn.nat_tokens && dn.dim_nat_tokens
    order by dn.player_id, rn.market_value_eur desc nulls last
  )
  update mart.player_dim d
  set
    market_value_eur = b.market_value_eur,
    market_value_text = b.market_value_text,
    transfermarkt_player_id = b.tm_player_id,
    market_value_season_id = p_season_id,
    market_value_club_matched = b.matched_club_name,
    market_value_match_version = 'tm_name_nation_v1'
  from best b
  where d.player_id = b.player_id;

  get diagnostics n = row_count;
  return n;
end;
$nfn$;

comment on function mart.apply_transfermarkt_market_to_player_dim_nationality_fallback(int, boolean) is
  'Match nome + nacionalidade (sem clube); por defeito só player_dim.market_value_eur is null.';

