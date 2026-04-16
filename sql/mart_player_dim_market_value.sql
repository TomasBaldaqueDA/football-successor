-- Market value (Transfermarkt) em mart.player_dim
-- 1) Tabela de referÃªncia (preenchida via CSV â€” ver load_transfermarkt_market_to_supabase.py)
-- 2) Match: nome + clube (normalizado + similaridade de clube com pg_trgm)
-- 3) Colunas novas em mart.player_dim
--
-- 4) Fallback nome unico na ref: apply_transfermarkt_market_to_player_dim_name_unique_ref
-- Diagnosticos: sql/mart_player_dim_market_value_diagnostics.sql

-- Correr no Supabase SQL Editor (ou psql). Ajusta GRANTs se precisares.

create schema if not exists mart;

-- ExtensÃµes (Supabase costuma permitir)
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- Normalizacao para comparacao: minusculas, unaccent, espacos,
-- remover invisiveis (ZWSP/BOM/word joiner), NBSP e espacos unicode -> espaco,
-- aspas e tracos tipograficos -> ASCII.
create or replace function mart.normalize_match_text(t text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(
    trim(
      both ' ' from regexp_replace(
        lower(
          public.unaccent(
            trim(
              both ' ' from replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          translate(
                            replace(coalesce(t, ''), chr(160)::text, ' '),
                            chr(8203)||chr(8204)||chr(8205)||chr(65279)||chr(8288)||chr(8239),
                            ''
                          ),
                          chr(8211)::text,
                          '-'
                        ),
                        chr(8212)::text,
                        '-'
                      ),
                      chr(8217)::text,
                      ''''
                    ),
                    chr(8216)::text,
                    ''''
                  ),
                  chr(8220)::text,
                  '"'
                ),
                chr(8221)::text,
                '"'
              )
            )
          )
        ),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

-- Corrige mojibake: UTF-8 lido como Windows-1252 / Latin-1.
-- Ordem: prepass U+02DC->byte 0x98, WIN1252 roundtrip, reconstrucao byte-a-byte, LATIN1.
-- Gate na funcao: [ÃÂÄÅ] (turco/nordico/acentos partidos).
create or replace function mart.fix_utf8_mojibake_latin1(t text)
returns text
language plpgsql
immutable
parallel safe
as $fix$
declare
  t2 text;
  fixed text;
  win text;
  lat text;
  b bytea;
  i int;
  cp int;
begin
  if t is null or length(trim(both from t)) = 0 then
    return t;
  end if;
  -- Gate: padroes tipicos de UTF-8 lido como Latin-1 / CP1252 (incl. nomes turcos "Ä°", "ÅŸ", etc.)
  if t !~ E'[ÃÂÄÅ]' then
    return t;
  end if;
  -- U+02DC (tecla til tipografica) costuma substituir o 2o byte 0x98 de sequencias como Ø
  t2 := replace(t, chr(732)::text, chr(152)::text);

  begin
    win := convert_from(convert_to(t2, 'WIN1252'), 'UTF8');
    if win is not null and btrim(win) <> '' and win is distinct from t then
      return win;
    end if;
  exception
    when others then
      null;
  end;

  begin
    win := convert_from(convert_to(t2, 'WIN1250'), 'UTF8');
    if win is not null and btrim(win) <> '' and win is distinct from t then
      return win;
    end if;
  exception
    when others then
      null;
  end;

  begin
    b := ''::bytea;
    for i in 1..length(t2) loop
      cp := ascii(substr(t2, i, 1));
      if cp > 255 then
        b := null;
        exit;
      end if;
      b := b || decode(lpad(to_hex(cp), 2, '0'), 'hex');
    end loop;
    if b is not null and length(b) > 0 then
      fixed := convert_from(b, 'UTF8');
      if fixed is not null and btrim(fixed) <> '' and fixed is distinct from t then
        return fixed;
      end if;
    end if;
  exception
    when others then
      null;
  end;

  begin
    lat := convert_from(convert_to(t2, 'LATIN1'), 'UTF8');
    if lat is not null and btrim(lat) <> '' and lat is distinct from t then
      return lat;
    end if;
  exception
    when others then
      null;
  end;

  return t;
end;
$fix$;

comment on function mart.fix_utf8_mojibake_latin1(text) is
  'Repara mojibake TM (WIN1252/Latin-1 + bytes). Evitar se UTF-8 ja correto.';

-- Manutencao manual (correr no Supabase quando precisares):
--
-- A) Mojibake na ref (nomes e clubes):
-- update mart.transfermarkt_market_value_ref
-- set player_name = mart.fix_utf8_mojibake_latin1(player_name)
-- where player_name ~ E'[ÃÂÄÅ]';
-- update mart.transfermarkt_market_value_ref
-- set club_name = mart.fix_utf8_mojibake_latin1(club_name)
-- where club_name ~ E'[ÃÂÄÅ]';
--
-- B) Nome certo a partir do dim quando ja ha ligacao TM (* so onde o dim difere):
-- update mart.transfermarkt_market_value_ref r
-- set player_name = d.player_name
-- from mart.player_dim d
-- where d.transfermarkt_player_id is not null
--   and btrim(d.transfermarkt_player_id) <> ''
--   and d.transfermarkt_player_id = r.tm_player_id
--   and d.player_name is not null
--   and btrim(d.player_name) <> ''
--   and r.player_name is distinct from d.player_name;

-- Dados brutos do scrape (coluna player_id do CSV = tm_player_id TM)
create table if not exists mart.transfermarkt_market_value_ref (
  competition_code text not null,
  competition_name text,
  season_id int not null,
  club_id text not null,
  club_name text not null,
  tm_player_id text not null,
  player_name text not null,
  profile_url text,
  position_detail text,
  age int,
  nationalities text,
  market_value_text text,
  market_value_eur bigint,
  source_url text,
  imported_at timestamptz not null default now(),
  primary key (tm_player_id, club_id, season_id)
);

create index if not exists idx_transfermarkt_ref_season on mart.transfermarkt_market_value_ref (season_id);
create index if not exists idx_transfermarkt_ref_name_norm on mart.transfermarkt_market_value_ref (
  mart.normalize_match_text(player_name)
);
create index if not exists idx_transfermarkt_ref_club_norm on mart.transfermarkt_market_value_ref (
  mart.normalize_match_text(club_name)
);

-- Colunas no dim (idempotente)
alter table mart.player_dim
  add column if not exists market_value_eur bigint,
  add column if not exists market_value_text text,
  add column if not exists transfermarkt_player_id text,
  add column if not exists market_value_season_id int,
  add column if not exists market_value_club_matched text,
  add column if not exists market_value_match_version text;

comment on column mart.player_dim.market_value_eur is 'Valor de mercado (EUR inteiro), fonte Transfermarkt.';
comment on column mart.player_dim.transfermarkt_player_id is 'ID jogador no Transfermarkt (/profil/spieler/<id>).';

-- Aplica match TM -> player_dim. Preferencia: melhor similaridade de clube, depois maior valor.
-- last_club vazio nao entra no match (evita homonimos).
-- Terceiro arg p_only_where_market_null: true = so atualiza onde market_value_eur is null (afinar limiar sem alterar ja matched).
drop function if exists mart.apply_transfermarkt_market_to_player_dim(int, real);

create or replace function mart.apply_transfermarkt_market_to_player_dim(
  p_season_id int default 2025,
  p_min_club_similarity real default 0.38,
  p_only_where_market_null boolean default false
)
returns int
language plpgsql
volatile
as $fn$
declare
  n int;
begin
  with ref_norm as (
    select
      r.tm_player_id,
      r.player_name,
      r.club_name,
      r.market_value_text,
      r.market_value_eur,
      mart.normalize_match_text(r.player_name) as name_norm,
      mart.normalize_match_text(r.club_name) as club_norm
    from mart.transfermarkt_market_value_ref r
    where r.season_id = p_season_id
      and r.market_value_eur is not null
  ),
  dim_norm as (
    select
      d.player_id,
      d.player_name,
      d.last_club,
      mart.normalize_match_text(d.player_name) as name_norm,
      mart.normalize_match_text(coalesce(d.last_club, '')) as club_norm
    from mart.player_dim d
    where trim(coalesce(d.last_club, '')) <> ''
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
      rn.club_name as matched_club_name,
      case
        when dn.club_norm is not null and dn.club_norm = rn.club_norm then 1.0::real
        else greatest(
          similarity(coalesce(dn.club_norm, ''), coalesce(rn.club_norm, '')),
          0.0::real
        )
      end as club_sim
    from dim_norm dn
    join ref_norm rn on rn.name_norm = dn.name_norm
    where dn.club_norm is not null
      and length(dn.club_norm) > 0
      and rn.club_norm is not null
      and length(rn.club_norm) > 0
      and (
        dn.club_norm = rn.club_norm
        or similarity(dn.club_norm, rn.club_norm) >= p_min_club_similarity
      )
    order by dn.player_id, club_sim desc, rn.market_value_eur desc nulls last
  )
  update mart.player_dim d
  set
    market_value_eur = b.market_value_eur,
    market_value_text = b.market_value_text,
    transfermarkt_player_id = b.tm_player_id,
    market_value_season_id = p_season_id,
    market_value_club_matched = b.matched_club_name,
    market_value_match_version = 'tm_name_club_v1'
  from best b
  where d.player_id = b.player_id;

  get diagnostics n = row_count;
  return n;
end;
$fn$;

comment on function mart.apply_transfermarkt_market_to_player_dim(int, real, boolean) is
  'Preenche mart.player_dim.market_value_* a partir de mart.transfermarkt_market_value_ref; nome + clube (exato ou pg_trgm). Terceiro arg: so onde market_value_eur is null.';

-- Match quando o nome normalizado na ref tem um unico tm_player_id na temporada.
create or replace function mart.apply_transfermarkt_market_to_player_dim_name_unique_ref(
  p_season_id int default 2025,
  p_only_where_market_null boolean default true
)
returns int
language plpgsql
volatile
as $ufn$
declare
  n int;
begin
  with ref_agg as (
    select
      mart.normalize_match_text(r.player_name) as name_norm,
      count(distinct r.tm_player_id) as n_tm
    from mart.transfermarkt_market_value_ref r
    where r.season_id = p_season_id
      and r.market_value_eur is not null
    group by mart.normalize_match_text(r.player_name)
  ),
  uniq as (
    select ra.name_norm
    from ref_agg ra
    where ra.n_tm = 1
      and ra.name_norm is not null
  ),
  ref_norm as (
    select
      r.tm_player_id,
      r.player_name,
      r.club_name,
      r.market_value_text,
      r.market_value_eur,
      mart.normalize_match_text(r.player_name) as name_norm
    from mart.transfermarkt_market_value_ref r
    inner join uniq u on u.name_norm = mart.normalize_match_text(r.player_name)
    where r.season_id = p_season_id
      and r.market_value_eur is not null
  ),
  dim_n as (
    select
      d.player_id,
      mart.normalize_match_text(d.player_name) as name_norm
    from mart.player_dim d
    where mart.normalize_match_text(d.player_name) is not null
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
    from dim_n dn
    join ref_norm rn on rn.name_norm = dn.name_norm
    order by dn.player_id, rn.market_value_eur desc nulls last
  )
  update mart.player_dim d
  set
    market_value_eur = b.market_value_eur,
    market_value_text = b.market_value_text,
    transfermarkt_player_id = b.tm_player_id,
    market_value_season_id = p_season_id,
    market_value_club_matched = b.matched_club_name,
    market_value_match_version = 'tm_name_unique_ref_v1'
  from best b
  where d.player_id = b.player_id;

  get diagnostics n = row_count;
  return n;
end;
$ufn$;

comment on function mart.apply_transfermarkt_market_to_player_dim_name_unique_ref(int, boolean) is
  'So nome: quando na ref existe exatamente um tm_player_id para esse nome normalizado na temporada; por defeito so dim.market_value_eur is null.';

-- So nome: exige (1) um unico jogador em player_dim com esse nome normalizado E (2) um unico tm_player_id na ref
-- para o mesmo nome na temporada. Evita atribuir o mesmo perfil TM a dois homonimos no dim; preferir a este passo em vez de name_unique_ref quando isso for problema.
create or replace function mart.apply_transfermarkt_market_to_player_dim_name_dim_unique(
  p_season_id int default 2025,
  p_only_where_market_null boolean default true
)
returns int
language plpgsql
volatile
as $dufn$
declare
  n int;
begin
  with dim_name_cnt as (
    select
      mart.normalize_match_text(d.player_name) as name_norm,
      count(*)::int as n_dim
    from mart.player_dim d
    group by mart.normalize_match_text(d.player_name)
  ),
  dim_name_single as (
    select dnc.name_norm
    from dim_name_cnt dnc
    where dnc.n_dim = 1
      and dnc.name_norm is not null
  ),
  ref_agg as (
    select
      mart.normalize_match_text(r.player_name) as name_norm,
      count(distinct r.tm_player_id) as n_tm
    from mart.transfermarkt_market_value_ref r
    where r.season_id = p_season_id
      and r.market_value_eur is not null
    group by mart.normalize_match_text(r.player_name)
  ),
  ref_name_single as (
    select ra.name_norm
    from ref_agg ra
    where ra.n_tm = 1
      and ra.name_norm is not null
  ),
  ref_norm as (
    select
      r.tm_player_id,
      r.player_name,
      r.club_name,
      r.market_value_text,
      r.market_value_eur,
      mart.normalize_match_text(r.player_name) as name_norm
    from mart.transfermarkt_market_value_ref r
    inner join ref_name_single rs on rs.name_norm = mart.normalize_match_text(r.player_name)
    where r.season_id = p_season_id
      and r.market_value_eur is not null
  ),
  dim_target as (
    select
      d.player_id,
      mart.normalize_match_text(d.player_name) as name_norm
    from mart.player_dim d
    inner join dim_name_single ds on ds.name_norm = mart.normalize_match_text(d.player_name)
    where mart.normalize_match_text(d.player_name) is not null
      and (
        not p_only_where_market_null
        or d.market_value_eur is null
      )
  ),
  best as (
    select distinct on (dt.player_id)
      dt.player_id,
      rn.market_value_eur,
      rn.market_value_text,
      rn.tm_player_id,
      rn.club_name as matched_club_name
    from dim_target dt
    join ref_norm rn on rn.name_norm = dt.name_norm
    order by dt.player_id, rn.market_value_eur desc nulls last
  )
  update mart.player_dim d
  set
    market_value_eur = b.market_value_eur,
    market_value_text = b.market_value_text,
    transfermarkt_player_id = b.tm_player_id,
    market_value_season_id = p_season_id,
    market_value_club_matched = b.matched_club_name,
    market_value_match_version = 'tm_name_dim_unique_v1'
  from best b
  where d.player_id = b.player_id;

  get diagnostics n = row_count;
  return n;
end;
$dufn$;

comment on function mart.apply_transfermarkt_market_to_player_dim_name_dim_unique(int, boolean) is
  'So nome: 1 jogador no dim com esse nome_norm E 1 tm_player_id na ref; por defeito so market_value_eur null. Mais seguro que name_unique_ref com homonimos no dim.';

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
