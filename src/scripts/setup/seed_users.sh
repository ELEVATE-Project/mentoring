#!/bin/bash

# Exit on error
set -e

# Ensure correct number of arguments are provided
if [ $# -lt 4 ]; then
    echo "Error: Folder names and database URLs not provided. Usage: $0 <folder_name> <database_url> <mentoring_folder_name> <mentoring_database_url>"
    exit 1
fi

# Use the provided folder name
FOLDER_NAME="$1"

# Check if folder exists
if [ ! -d "$FOLDER_NAME" ]; then
    echo "Error: Folder '$FOLDER_NAME' not found."
    exit 1
fi

# Use the provided database URL
DEV_DATABASE_URL="$2"

# Extract database credentials and connection details using awk for portability
DB_USER=$(echo $DEV_DATABASE_URL | awk -F '[:@/]' '{print $4}')
DB_PASSWORD=$(echo $DEV_DATABASE_URL | awk -F '[:@/]' '{print $5}')
DB_HOST=$(echo $DEV_DATABASE_URL | awk -F '[:@/]' '{print $6}')
DB_PORT=$(echo $DEV_DATABASE_URL | awk -F '[:@/]' '{split($7,a,"/"); print a[1]}')
DB_NAME=$(echo $DEV_DATABASE_URL | awk -F '/' '{print $NF}')

# Log database variables
echo "Extracted Database Variables:"
echo "DB_USER: $DB_USER"
echo "DB_PASSWORD: $DB_PASSWORD"
echo "DB_HOST: $DB_HOST"
echo "DB_PORT: $DB_PORT"
echo "DB_NAME: $DB_NAME"

# Define the container name (same as DB_HOST)
CONTAINER_NAME="$DB_HOST"

# Wait for Docker container to be up
echo "Waiting for Docker container '$CONTAINER_NAME' to be up..."
while ! docker inspect "$CONTAINER_NAME" &>/dev/null; do
    echo "Waiting for container..."
    sleep 1
done
echo "Container is now up."

# Wait for PostgreSQL to be ready to accept connections
echo "Waiting for PostgreSQL on '$DB_HOST:$DB_PORT' to accept connections..."
until docker exec "$CONTAINER_NAME" bash -c "pg_isready -h localhost -p $DB_PORT -U $DB_USER"; do
    echo "Waiting for database to be ready..."
    sleep 1
done
echo "Database is ready."

# Function to check if the database exists
check_database() {
    docker exec "$CONTAINER_NAME" bash -c "PGPASSWORD='$DB_PASSWORD' psql -h localhost -U $DB_USER -p $DB_PORT -lqt | cut -d \| -f 1 | grep -qw '$DB_NAME'"
}

echo "Checking existence of database '$DB_NAME'..."
until check_database; do
    echo "Database '$DB_NAME' does not exist, waiting..."
    sleep 5
done
echo "Database '$DB_NAME' exists, proceeding with script."

# Retrieve and prepare SQL file operations
USER_COLUMNS_FILE="$FOLDER_NAME/users.sql"
if [ ! -f "$USER_COLUMNS_FILE" ]; then
    echo "Error: users.sql not found in folder '$FOLDER_NAME'."
    exit 1
fi
echo "Copying users.sql to container '$CONTAINER_NAME'..."
docker cp "$USER_COLUMNS_FILE" "$CONTAINER_NAME:/users.sql"

# Function to check if table exists
check_table() {
    local table=$1
    local exists=$(docker exec "$CONTAINER_NAME" bash -c "PGPASSWORD='$DB_PASSWORD' psql -h localhost -U $DB_USER -d $DB_NAME -p $DB_PORT -t -c \"SELECT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '$table');\"")
    exists=$(echo "$exists" | tr -d '[:space:]')             # Trim whitespace
    echo "Debug: exists result for table $table = '$exists'" # Debug line
    [[ "$exists" == "t" ]]                                   # Checking specifically for 't'
}
declare -a extracted_values=()

# Execute the SQL file with checks for table existence
echo "Seeding users..."
while IFS= read -r line; do
    if [[ $line =~ INSERT\ INTO\ public\.([^ ]+) ]]; then
        table="${BASH_REMATCH[1]}"
        echo "Checking existence of table '$table'..."
        until check_table "$table"; do
            echo "Table '$table' does not exist, waiting..."
            sleep 1
        done
        echo "Table '$table' exists, executing: $line"
        query_response=$(docker exec --user "$DB_USER" "$CONTAINER_NAME" bash -c "PGPASSWORD='$DB_PASSWORD' psql -h localhost -U $DB_USER -d $DB_NAME -p $DB_PORT -c \"$line\"")

        extracted_value=$(echo "$query_response" | awk 'NR==3 {print $1}')
        extracted_values+=("$extracted_value")
    fi
done <"$USER_COLUMNS_FILE"
# Now you can access the array elements containing the extracted values
# For example, to print all extracted values:
for value in "${extracted_values[@]}"; do
    echo "$value"
done

# Use the provided folder name
FOLDER_NAME="$3"

# Check if folder exists
if [ ! -d "$FOLDER_NAME" ]; then
    echo "Error: Folder '$FOLDER_NAME' not found."
    exit 1
fi

# Use the provided database URL
DEV_DATABASE_URL="$4"

# Extract database credentials and connection details using awk for portability
DB_USER=$(echo $DEV_DATABASE_URL | awk -F '[:@/]' '{print $4}')
DB_PASSWORD=$(echo $DEV_DATABASE_URL | awk -F '[:@/]' '{print $5}')
DB_HOST=$(echo $DEV_DATABASE_URL | awk -F '[:@/]' '{print $6}')
DB_PORT=$(echo $DEV_DATABASE_URL | awk -F '[:@/]' '{split($7,a,"/"); print a[1]}')
DB_NAME=$(echo $DEV_DATABASE_URL | awk -F '/' '{print $NF}')

# Log database variables
echo "Extracted Database Variables:"
echo "DB_USER: $DB_USER"
echo "DB_PASSWORD: $DB_PASSWORD"
echo "DB_HOST: $DB_HOST"
echo "DB_PORT: $DB_PORT"
echo "DB_NAME: $DB_NAME"

# Define the container name (same as DB_HOST)
CONTAINER_NAME="$DB_HOST"

# Wait for Docker container to be up
echo "Waiting for Docker container '$CONTAINER_NAME' to be up..."
while ! docker inspect "$CONTAINER_NAME" &>/dev/null; do
    echo "Waiting for container..."
    sleep 1
done
echo "Container is now up."

# Wait for PostgreSQL to be ready to accept connections
echo "Waiting for PostgreSQL on '$DB_HOST:$DB_PORT' to accept connections..."
until docker exec "$CONTAINER_NAME" bash -c "pg_isready -h localhost -p $DB_PORT -U $DB_USER"; do
    echo "Waiting for database to be ready..."
    sleep 1
done
echo "Database is ready."

# Function to check if the database exists
check_database() {
    docker exec "$CONTAINER_NAME" bash -c "PGPASSWORD='$DB_PASSWORD' psql -h localhost -U $DB_USER -p $DB_PORT -lqt | cut -d \| -f 1 | grep -qw '$DB_NAME'"
}

echo "Checking existence of database '$DB_NAME'..."
until check_database; do
    echo "Database '$DB_NAME' does not exist, waiting..."
    sleep 5
done
echo "Database '$DB_NAME' exists, proceeding with script."

# Retrieve and prepare SQL file operations
USER_COLUMNS_FILE="$FOLDER_NAME/users.sql"
if [ ! -f "$USER_COLUMNS_FILE" ]; then
    echo "Error: users.sql not found in folder '$FOLDER_NAME'."
    exit 1
fi
echo "Copying users.sql to container '$CONTAINER_NAME'..."
docker cp "$USER_COLUMNS_FILE" "$CONTAINER_NAME:/users.sql"

# Function to check if table exists
check_table() {
    local table=$1
    local exists=$(docker exec "$CONTAINER_NAME" bash -c "PGPASSWORD='$DB_PASSWORD' psql -h localhost -U $DB_USER -d $DB_NAME -p $DB_PORT -t -c \"SELECT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '$table');\"")
    exists=$(echo "$exists" | tr -d '[:space:]')             # Trim whitespace
    echo "Debug: exists result for table $table = '$exists'" # Debug line
    [[ "$exists" == "t" ]]                                   # Checking specifically for 't'
}

# Execute the SQL file with checks for table existence
echo "Creating distribution columns..."
index=0
while IFS= read -r line; do
    if [[ $line =~ INSERT\ INTO\ public\.([^ ]+) ]]; then

        find="{id}"
        replace=${extracted_values[index]}
        line=${line//$find/$replace}
        index=$(expr $index + 1)

        table="${BASH_REMATCH[1]}"
        echo "Checking existence of table '$table'..."
        until check_table "$table"; do
            echo "Table '$table' does not exist, waiting..."
            sleep 1
        done
        echo "Table '$table' exists, executing: $line"

        docker exec --user "$DB_USER" "$CONTAINER_NAME" bash -c "PGPASSWORD='$DB_PASSWORD' psql -h localhost -U $DB_USER -d $DB_NAME -p $DB_PORT -c \"$line\""
    fi
done <"$USER_COLUMNS_FILE"

echo "User seeding completed."
