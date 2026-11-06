alter table public.police_evidence_records add column if not exists photo_message_id text;
create unique index if not exists police_evidence_photo_message_unique on public.police_evidence_records(photo_message_id) where photo_message_id is not null;
comment on column public.police_evidence_records.photo_message_id is 'Original Discord screenshot message, when pasted in the evidence channel. No image or image URL is stored.';
