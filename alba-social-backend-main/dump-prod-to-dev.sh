#!/bin/bash

# Script to dump production database and restore to development database
# Usage: ./dump-prod-to-dev.sh [--all] [--tables "table1,table2"]
# Make sure you have the production database URL set in PROD_DATABASE_URL environment variable

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse flags
TABLES=""
DUMP_ALL=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --tables|-t)
            if [ -n "$2" ]; then
                TABLES="$2"
                shift 2
            else
                echo -e "${RED}Error: --tables requires a comma-separated list${NC}"
                exit 1
            fi
            ;;
        --all)
            DUMP_ALL=true
            shift 1
            ;;
        --help|-h)
            echo "Usage: ./dump-prod-to-dev.sh [--all] [--tables \"table1,table2\"]"
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option $1${NC}"
            echo "Usage: ./dump-prod-to-dev.sh [--all] [--tables \"table1,table2\"]"
            exit 1
            ;;
    esac
done

if [ -n "$TABLES" ] && [ "$DUMP_ALL" = true ]; then
    echo -e "${RED}Error: Use either --all or --tables, not both${NC}"
    exit 1
fi

# Check if PROD_DATABASE_URL is set
if [ -z "$PROD_DATABASE_URL" ]; then
    echo -e "${RED}Error: PROD_DATABASE_URL environment variable is not set${NC}"
    echo "Usage: PROD_DATABASE_URL='postgresql://user:password@prod-host:5432/db_name' ./dump-prod-to-dev.sh [--all] [--tables \"table1,table2\"]"
    exit 1
fi

# Extract database connection info
DEV_DATABASE_URL="${DATABASE_URL}"
if [ -z "$DEV_DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    exit 1
fi

# Parse connection strings
extract_db_info() {
    local url=$1
    if [[ $url =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        echo "${BASH_REMATCH[1]}|${BASH_REMATCH[2]}|${BASH_REMATCH[3]}|${BASH_REMATCH[4]}|${BASH_REMATCH[5]}"
    else
        # Try without password
        if [[ $url =~ postgresql://([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
            echo "${BASH_REMATCH[1]}||${BASH_REMATCH[2]}|${BASH_REMATCH[3]}|${BASH_REMATCH[4]}"
        fi
    fi
}

PROD_INFO=$(extract_db_info "$PROD_DATABASE_URL")
DEV_INFO=$(extract_db_info "$DEV_DATABASE_URL")

IFS='|' read -r PROD_USER PROD_PASS PROD_HOST PROD_PORT PROD_DB <<< "$PROD_INFO"
IFS='|' read -r DEV_USER DEV_PASS DEV_HOST DEV_PORT DEV_DB <<< "$DEV_INFO"

# Optional: limit to a list of tables (comma-separated)
TABLES_ARG=""
DROP_TABLES=()
if [ -n "$TABLES" ]; then
    IFS=',' read -r -a TABLE_LIST <<< "$TABLES"
    for tbl in "${TABLE_LIST[@]}"; do
        tbl_trimmed=$(echo "$tbl" | xargs)
        if [ -n "$tbl_trimmed" ]; then
            if [[ "$tbl_trimmed" == *.* ]]; then
                TABLES_ARG+=" -t $tbl_trimmed"
                tbl_name="${tbl_trimmed##*.}"
            else
                TABLES_ARG+=" -t public.\"$tbl_trimmed\""
                tbl_name="$tbl_trimmed"
            fi
            tbl_name="${tbl_name#\"}"
            tbl_name="${tbl_name%\"}"
            DROP_TABLES+=("$tbl_name")
        fi
    done
fi

echo -e "${YELLOW}Production Database:${NC}"
echo "  Host: $PROD_HOST:$PROD_PORT"
echo "  Database: $PROD_DB"
echo "  User: $PROD_USER"
if [ -n "$TABLES_ARG" ]; then
    echo "  Tables: ${TABLES}"
    echo "  Schema: ALL (schema-only)"
else
    echo "  Tables: ALL"
fi
echo ""
echo -e "${YELLOW}Development Database:${NC}"
echo "  Host: $DEV_HOST:$DEV_PORT"
echo "  Database: $DEV_DB"
echo "  User: $DEV_USER"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Create dump file with timestamp
DUMP_TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
SCHEMA_DUMP_FILE="prod_schema_${DUMP_TIMESTAMP}.sql"
DATA_DUMP_FILE="prod_data_${DUMP_TIMESTAMP}.sql"
echo -e "${YELLOW}Creating database dump...${NC}"

# Dump production database
if [ -n "$TABLES_ARG" ]; then
    if [ -n "$PROD_PASS" ]; then
        PGPASSWORD="$PROD_PASS" pg_dump -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" --schema-only --clean --if-exists --no-owner --no-privileges "$PROD_DB" > "$SCHEMA_DUMP_FILE"
        PGPASSWORD="$PROD_PASS" pg_dump -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" --data-only --no-owner --no-privileges $TABLES_ARG "$PROD_DB" > "$DATA_DUMP_FILE"
    else
        pg_dump -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" --schema-only --clean --if-exists --no-owner --no-privileges "$PROD_DB" > "$SCHEMA_DUMP_FILE"
        pg_dump -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" --data-only --no-owner --no-privileges $TABLES_ARG "$PROD_DB" > "$DATA_DUMP_FILE"
    fi
    echo -e "${GREEN}✓ Schema dump created: $SCHEMA_DUMP_FILE${NC}"
    echo -e "${GREEN}✓ Data dump created: $DATA_DUMP_FILE${NC}"
else
    FULL_DUMP_FILE="prod_dump_${DUMP_TIMESTAMP}.sql"
    if [ -n "$PROD_PASS" ]; then
        PGPASSWORD="$PROD_PASS" pg_dump -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" --clean --if-exists --no-owner --no-privileges "$PROD_DB" > "$FULL_DUMP_FILE"
    else
        pg_dump -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" --clean --if-exists --no-owner --no-privileges "$PROD_DB" > "$FULL_DUMP_FILE"
    fi
    echo -e "${GREEN}✓ Dump created: $FULL_DUMP_FILE${NC}"
fi

# Drop tables in development database
echo -e "${YELLOW}Cleaning development database...${NC}"

if [ ${#DROP_TABLES[@]} -gt 0 ]; then
    DROP_LIST=""
    for tbl in "${DROP_TABLES[@]}"; do
        if [ -z "$DROP_LIST" ]; then
            DROP_LIST="$tbl"
        else
            DROP_LIST+="','${tbl}"
        fi
    done
    DROP_SQL="SELECT 'DROP TABLE IF EXISTS \"' || tablename || '\" CASCADE;' FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('$DROP_LIST');"
else
    DROP_SQL="SELECT 'DROP TABLE IF EXISTS \"' || tablename || '\" CASCADE;' FROM pg_tables WHERE schemaname = 'public';"
fi

if [ -n "$DEV_PASS" ]; then
    psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" "$DEV_DB" -tc "$DROP_SQL" | psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" "$DEV_DB"
else
    psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" "$DEV_DB" -tc "$DROP_SQL" | psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" "$DEV_DB"
fi

echo -e "${GREEN}✓ Development database cleaned${NC}"

# Restore dump to development database
echo -e "${YELLOW}Restoring dump to development database...${NC}"

if [ -n "$TABLES_ARG" ]; then
    if [ -n "$DEV_PASS" ]; then
        PGPASSWORD="$DEV_PASS" psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" "$DEV_DB" < "$SCHEMA_DUMP_FILE"
        PGPASSWORD="$DEV_PASS" psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" "$DEV_DB" < "$DATA_DUMP_FILE"
    else
        psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" "$DEV_DB" < "$SCHEMA_DUMP_FILE"
        psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" "$DEV_DB" < "$DATA_DUMP_FILE"
    fi
else
    if [ -n "$DEV_PASS" ]; then
        PGPASSWORD="$DEV_PASS" psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" "$DEV_DB" < "$FULL_DUMP_FILE"
    else
        psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" "$DEV_DB" < "$FULL_DUMP_FILE"
    fi
fi


echo -e "${GREEN}✓ Database restored successfully${NC}"

# Seed admin user(s)
echo -e "${YELLOW}Seeding admin user(s)...${NC}"

psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" "$DEV_DB" <<'EOSQL'
INSERT INTO "User" (id, auth_id, admin_status, email, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'btLfsZclLJRROQuczBuneh2uom83',
    true,
    'jwchristie.jc@gmail.com',
    NOW(),
    NOW()
)
ON CONFLICT (auth_id) DO NOTHING;

INSERT INTO "Profile" (id, user_id, first_name, last_name, created_at, updated_at)
SELECT gen_random_uuid(), id, 'James', 'Christie', NOW(), NOW()
FROM "User" WHERE auth_id = 'btLfsZclLJRROQuczBuneh2uom83'
ON CONFLICT (user_id) DO NOTHING;
EOSQL

psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" "$DEV_DB" <<'EOSQL'
INSERT INTO "User" (id, auth_id, admin_status, email, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'mYs9zOeWF2M9YSNomb2HEb2qH3v1',
    true,
    'james@golfalba.co',
    NOW(),
    NOW()
)
ON CONFLICT (auth_id) DO NOTHING;

INSERT INTO "Profile" (id, user_id, first_name, last_name, created_at, updated_at)
SELECT gen_random_uuid(), id, 'James', 'Admin', NOW(), NOW()
FROM "User" WHERE auth_id = 'mYs9zOeWF2M9YSNomb2HEb2qH3v1'
ON CONFLICT (user_id) DO NOTHING;
EOSQL
echo -e "${GREEN}✓ Admin user seeded${NC}"

# Optional: keep dump file or delete
read -p "Keep dump file? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    if [ -n "$TABLES_ARG" ]; then
        rm "$SCHEMA_DUMP_FILE" "$DATA_DUMP_FILE"
        echo -e "${GREEN}✓ Dump files deleted${NC}"
    else
        rm "$FULL_DUMP_FILE"
        echo -e "${GREEN}✓ Dump file deleted${NC}"
    fi
else
    if [ -n "$TABLES_ARG" ]; then
        echo -e "${GREEN}✓ Dump files saved: $SCHEMA_DUMP_FILE, $DATA_DUMP_FILE${NC}"
    else
        echo -e "${GREEN}✓ Dump file saved: $FULL_DUMP_FILE${NC}"
    fi
fi

echo ""
echo -e "${GREEN}All done!${NC}"
