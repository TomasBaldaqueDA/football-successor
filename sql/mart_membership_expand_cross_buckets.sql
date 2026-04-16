-- Expansão de buckets em mart.player_position_membership (Supabase SQL Editor).
-- Mapeamento: DC = CB, Lateral = FB, CDM = DM (como no resto do mart).
-- Corre até estabilizar para refletir encadeamentos (ex.: CB → FB → W).
--
-- Nota: para AM automático em todos os CM (Bruno / post anterior), corre também
-- mart_membership_add_am_for_cm.sql — não está incluído aqui porque a regra CM abaixo
-- é só "CDM + W" para quem já tem CM.

DO $$
DECLARE
  inserted bigint;
BEGIN
  LOOP
    INSERT INTO mart.player_position_membership (player_id, position_bucket)
    SELECT DISTINCT p.player_id, pr.target_bucket
    FROM mart.player_position_membership p
    JOIN (
      VALUES
        -- DC (CB): Lateral (FB) + CDM (DM)
        ('CB'::text, 'FB'::text),
        ('CB', 'DM'),
        -- Laterais (FB): CDM + CB + W
        ('FB', 'DM'),
        ('FB', 'CB'),
        ('FB', 'W'),
        -- CDM (DM): Laterais + CM + AM + CB
        ('DM', 'FB'),
        ('DM', 'CM'),
        ('DM', 'AM'),
        ('DM', 'CB'),
        -- CM: CDM + W (CM já existe)
        ('CM', 'DM'),
        ('CM', 'W'),
        -- AM: W + CDM + CM + ST
        ('AM', 'W'),
        ('AM', 'DM'),
        ('AM', 'CM'),
        ('AM', 'ST'),
        -- W: ST + AM
        ('W', 'ST'),
        ('W', 'AM'),
        -- ST: W + AM
        ('ST', 'W'),
        ('ST', 'AM')
    ) AS pr(source_bucket, target_bucket)
      ON pr.source_bucket = p.position_bucket
    WHERE NOT EXISTS (
      SELECT 1
      FROM mart.player_position_membership x
      WHERE x.player_id = p.player_id
        AND x.position_bucket = pr.target_bucket
    );

    GET DIAGNOSTICS inserted = ROW_COUNT;
    EXIT WHEN inserted = 0;
  END LOOP;
END $$;
