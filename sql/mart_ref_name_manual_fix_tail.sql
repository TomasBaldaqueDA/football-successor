-- Correcoes manuais: nomes truncados (UTF-8 cortado). Confirma no TM antes.
begin;
update mart.transfermarkt_market_value_ref set player_name = 'José Gayà' where player_name = 'JosÃ© GayÃ';
update mart.transfermarkt_market_value_ref set player_name = 'Carlos Macià' where player_name = 'Carlos MaciÃ';
update mart.transfermarkt_market_value_ref set player_name = 'José Marsà' where player_name = 'JosÃ© MarsÃ';
-- where player_name = 'Mohammed El Âdfaoui'  -- ver profile_url no TM para o spelling certo
commit;
