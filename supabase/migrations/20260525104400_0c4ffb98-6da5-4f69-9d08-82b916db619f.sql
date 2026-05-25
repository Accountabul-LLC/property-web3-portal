-- Drop existing schedule of the same name (idempotent)
do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'accountabul_campaign_release_due';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end $$;

select cron.schedule(
  'accountabul_campaign_release_due',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://gveavwqyrwqvafsnhnqc.supabase.co/functions/v1/campaign-release-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZWF2d3F5cndxdmFmc25obnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MjYxODQsImV4cCI6MjA4ODEwMjE4NH0.mdSf5CWPtBOpbIPdg0LYwrUozs66PjZDv4Td5VVCvfQ',
      'x-accountabul-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'CAMPAIGN_RELEASE_CRON_SECRET' limit 1),
        ''
      )
    ),
    body := jsonb_build_object('triggered_at', now(), 'limit', 20)
  );
  $$
);