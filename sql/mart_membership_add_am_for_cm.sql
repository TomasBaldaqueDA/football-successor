-- Para jogadores mapeados só como CM (ex.: tokens não abrangem AM), permitir L4L como AM.
-- Correr no Supabase SQL Editor (idempotente).

insert into mart.player_position_membership (player_id, position_bucket)
select distinct p.player_id, 'AM'::text
from mart.player_position_membership p
where p.position_bucket = 'CM'
  and not exists (
    select 1
    from mart.player_position_membership x
    where x.player_id = p.player_id
      and x.position_bucket = 'AM'
  );

-- Verificação (opcional):
-- select count(*) as new_am_rows from mart.player_position_membership where position_bucket = 'AM';
