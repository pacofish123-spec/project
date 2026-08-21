-- yoRento: raise the photo upload cap from the unset default (whatever
-- the project-wide Storage limit happens to be) to an explicit 25MB on
-- both photo buckets. Real phone camera photos regularly exceed the
-- previous 8MB client-side check this app enforced, which is what
-- prompted this — the client-side checks in the vehicle-listing and
-- condition-report photo uploaders were raised to match this same 25MB
-- figure, so a file that passes the client check is guaranteed to pass
-- here too. Already applied live via the Storage admin API; this
-- migration just keeps that change in the schema history.
update storage.buckets set file_size_limit = 25000000 where id = 'vehicle-photos';
update storage.buckets set file_size_limit = 25000000 where id = 'condition-reports';
