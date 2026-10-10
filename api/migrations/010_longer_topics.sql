-- Topic names can now be up to 59 characters (fact-set names like "diseases and vectors" are topics too).
ALTER TABLE topic_stats MODIFY topic VARCHAR(60) NOT NULL;
ALTER TABLE assignments MODIFY topic VARCHAR(60) NULL;
ALTER TABLE questions MODIFY topic VARCHAR(60) NOT NULL;
