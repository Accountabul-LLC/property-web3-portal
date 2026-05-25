-- Scheduled auto-release for Causes campaigns.
-- Required Vault secrets:
--   project_url
--   publishable_key
--   campaign_release_cron_secret
--
-- The edge function also needs the signer seed configured in project secrets:
--   CAMPAIGN_RELEASE_SIGNER_SEED

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'accountabul_campaign_release_due'
  ) then
    perform cron.schedule(
      'accountabul_campaign_release_due',
      '*/5 * * * *',
      $cron$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/campaign-release-due',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
            'X-Accountabul-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_release_cron_secret')
          ),
          body := jsonb_build_object(
            'source', 'cron',
            'limit', 20
          )
        ) as request_id;
      $cron$
    );
  end if;
end $$;
