-- None of the storage buckets restrict MIME types server-side — only
-- the upload forms hint accept="image/*" client-side, which is no
-- restriction at all against a direct API call with a valid session
-- token. vehicle-photos is a PUBLIC bucket, so an arbitrary file type
-- uploaded there is served back from a public URL: real risk (e.g. an
-- HTML/SVG file with an embedded script hosted at a URL that looks
-- like it belongs to the platform), not just hygiene. Restricting to
-- actual photo formats — the only thing every upload flow in this
-- app ever produces — closes that off with no functional change for
-- real users.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id in ('vehicle-photos', 'condition-reports', 'identity-documents');
