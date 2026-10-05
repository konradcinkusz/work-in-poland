-- Throwaway CI/dev database: two databases in one instance, one per service (P3).
-- The container runs with trust authentication on a private docker network; no credential exists.
CREATE DATABASE apidb;
CREATE DATABASE authdb;
