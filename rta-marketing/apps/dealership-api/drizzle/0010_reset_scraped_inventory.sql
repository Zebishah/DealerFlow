DELETE FROM "scraped_items";
--> statement-breakpoint
DELETE FROM "scrape_actor_runs";
--> statement-breakpoint
WITH live_sources(name, base_url, domain) AS (
  VALUES
    ('Romans International', 'https://www.romansinternational.com/used/cars/', 'romansinternational.com'),
    ('Tom Hartley', 'https://www.tomhartley.com/used/', 'tomhartley.com'),
    ('Redline Specialist Cars', 'https://redlinespecialistcars.co.uk/cars/', 'redlinespecialistcars.co.uk')
),
ranked_sites AS (
  SELECT
    site.id,
    source.name,
    source.base_url,
    row_number() OVER (
      PARTITION BY source.domain
      ORDER BY
        CASE
          WHEN lower(regexp_replace(rtrim(site.base_url, '/'), '^https?://(www[.])?', ''))
            = lower(regexp_replace(rtrim(source.base_url, '/'), '^https?://(www[.])?', ''))
          THEN 0
          ELSE 1
        END,
        site.id
    ) AS row_number
  FROM "public"."sites" AS site
  JOIN live_sources AS source
    ON lower(regexp_replace(substring(site.base_url FROM '^https?://([^/]+)'), '^www[.]', '')) = source.domain
)
UPDATE "public"."sites" AS site
SET name = ranked.name,
    base_url = ranked.base_url
FROM ranked_sites AS ranked
WHERE ranked.row_number = 1
  AND site.id = ranked.id;
--> statement-breakpoint
WITH live_sources(name, base_url) AS (
  VALUES
    ('Romans International', 'https://www.romansinternational.com/used/cars/'),
    ('Tom Hartley', 'https://www.tomhartley.com/used/'),
    ('Redline Specialist Cars', 'https://redlinespecialistcars.co.uk/cars/')
)
INSERT INTO "public"."sites" (name, base_url)
SELECT source.name, source.base_url
FROM live_sources AS source
WHERE NOT EXISTS (
  SELECT 1
  FROM "public"."sites" AS site
  WHERE lower(regexp_replace(rtrim(site.base_url, '/'), '^https?://(www[.])?', ''))
    = lower(regexp_replace(rtrim(source.base_url, '/'), '^https?://(www[.])?', ''))
);
