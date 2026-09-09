CREATE UNIQUE INDEX "ingestion_rejections_source_reason_fingerprint_uq" ON "ingestion_rejections" USING btree ("source_run_id","reason_code","record_fingerprint");
