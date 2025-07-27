package migrations

import "embed"

//go:embed 001_initial_schema.sql 002_add_indexes.sql 003_seed_data.sql 004_enhanced_indexes.sql
var EmbeddedMigrations embed.FS