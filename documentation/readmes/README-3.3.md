<div align="center">

# Mentor Service

<a href="https://shikshalokam.org/elevate/">
<img
    src="https://shikshalokam.org/wp-content/uploads/2021/06/elevate-logo.png"
    height="140"
    width="300"
  />
</a>

<br>

<br>
The Mentor building block enables effective mentoring interactions between mentors and mentees. The capability aims to create a transparent eco-system to learn, connect, solve, and share within communities. Mentor is an open source mentoring application that facilitates peer learning and professional development by creating a community of mentors and mentees.

</div>

<br><br>

## General Notes

- All environment variables must be verified before deployment.
- Execute migration scripts only after successful deployment of each respective service.
- For Docker-based deployments, update the image tag to the latest version as specified for each service.
- For PM2 deployments, use the specified branch name.
- Initiate the User Service deployment first, followed by the deployment of the other services.

<br><br>

# New Features

## 1. Multi-Tenant Architecture
- Complete tenant isolation with tenant codes across all services.
- Domain-based tenant identification and routing.
- Per-tenant feature management and configuration.
- Multi-organization user management with role-based access control.

## 2. Enhanced Database Schema
- Tenant-aware database architecture with comprehensive isolation.
- Automatic tenant code assignment and validation.
- Optimized queries with tenant-based filtering.
- Citus distribution support for horizontal scaling.

## 3. Cache Management System
- Organization-based cache isolation with Redis.
- Intelligent cache invalidation strategies.
- Performance optimization with tenant-specific TTL policies.

## 4. Advanced Migration Framework
- Migration scripts with pre-validation and rollback capabilities.
- Batch processing for large datasets (30+ lakh records).
- Zero data loss during multi-tenant migration.

## 5. Tenant Data Management
- Complete data isolation between organizations.
- Tenant-aware foreign key relationships.
- Performance indexes on tenant columns.

<br><br>

# Prerequisites

Ensure that the MentorEd system is updated to **version 3.2** before initiating the upgrade process to **version 3.3**.

<br><br>

# Technical Setup

The setup for **MentorEd version 3.3** involves:

1. **Multi-Tenant Database Migration** – Database schema updates for tenant isolation.
2. **Cache Architecture Setup** – Redis-based caching with organization-specific isolation.
3. **Code Updates** – Service-level changes to support tenant-aware operations.

<br><br>

---

## Database Upgrade Scripts - Mentoring Service

### **Step 1: Fetch Data Codes from User Database (For Existing Databases Only)**

> **Note:** This step is **optional for new database creation**. It is **required for existing databases** to generate the `data_codes.csv` mapping file used in the tenant data migration.

```bash
# Run the following command against your User Service database
psql -U your_username -d your_database -h your_host -p 5432 \
-c "\copy (SELECT tenant_code, code, id FROM public.organizations ORDER BY id ASC) TO 'data_codes.csv' CSV HEADER"
```

Once the file is downloaded, follow these steps:

1. **Create a new file** named `data_codes.csv` inside the `mentoring/src/data/` directory.
2. **Copy the data** from the downloaded CSV and paste it into the newly created file.
3. **Replace the existing header row** with the following header:
   ```
   "tenant_code","organization_code","organization_id"
   ```

The final `mentoring/src/data/data_codes.csv` should look like:
```csv
"tenant_code","organization_code","organization_id"
default_tenant,default_org,1
shikshalokam_tenant,shikshalokam,2
```

### **Step 2: Apply Existing Sequelize Migrations**

```bash
cd mentoring/src
npx sequelize-cli db:migrate
npx sequelize-cli db:migrate:status
```

### **Step 3: Run Pre-Migration Integrity Check**

```bash
cd mentoring/src/scripts/tenantDataMigrations
node pre-migration-integrity-check.js
```

### **Step 4: Run Main Data Migration Script**

```bash
# Run from the same directory as Step 3 (mentoring/src/scripts/tenantDataMigrations)
node fill-tenant-data-from-csv.js
```

### **Step 5: Run Database Setup Scripts**

```bash
# Navigate from repo root
cd mentoring/src/scripts
node psqlFunction.js
node viewsScript.js
```

### Mentoring Service - Migration Checklist

- [ ] `data_codes.csv` created with correct headers in `mentoring/src/data/`
- [ ] Sequelize migrations applied successfully
- [ ] Pre-migration integrity check passed without errors
- [ ] Tenant data migration completed (`fill-tenant-data-from-csv.js`)
- [ ] Database functions and views updated (`psqlFunction.js`, `viewsScript.js`)

### Mentoring Service - Post-Migration Verification

```bash
# Verify no NULL tenant_code in sessions (should return 0)
psql -h localhost -U postgres -d mentoring -c "SELECT COUNT(*) FROM sessions WHERE tenant_code IS NULL;"

# Verify no NULL organization_code (should return 0)
psql -h localhost -U postgres -d mentoring -c "SELECT COUNT(*) FROM organization_extension WHERE organization_code IS NULL;"

# Check migration status
cd mentoring/src && npx sequelize-cli db:migrate:status
```

### Version & Build Information

| Item          | Value                                         |
|---------------|-----------------------------------------------|
| Git Branch    | `release-3.3.0`                               |
| Docker Image  | `shikshalokamqa/elevate-mentoring:3.3`        |

---

<br><br>

## Deployment of Chat Communication Service

### **Step 1: Fetch User Tenant Mapping from User Database**

> **Note:** This step is **optional for new database creation**. It is **required for existing databases** to generate the `user_tenant_mapping.csv` file used in the tenant data migration.

```bash
# Run the following command against your User Service database
psql -U your_username -d your_database -h your_host -p 5432 \
-c "\copy (SELECT user_id, tenant_code FROM public.user_organizations) TO 'user_tenant_mapping.csv' CSV HEADER"
```

Once the file is downloaded, follow these steps:

1. **Create a new file** named `user_tenant_mapping.csv` inside the `chat-communications/src/data/` directory.
2. **Copy the data** from the downloaded CSV and paste it into the newly created file.

### **Step 2: Run Tenant Migration Scripts**

```bash
cd chat-communications/src/scripts/tenantDataMigrations
node pre-migration-integrity-check.js
node fill-tenant-data-from-csv.js
cd ../../../
```

### **Step 3: Start the Service**

```bash
node app.js
```

### Chat Service - Migration Checklist

- [ ] `user_tenant_mapping.csv` created in `chat-communications/src/data/`
- [ ] Pre-migration integrity check passed without errors
- [ ] Tenant data migration completed (`fill-tenant-data-from-csv.js`)
- [ ] Service started successfully

### Chat Service - Post-Migration Verification

```bash
# Verify service is running
curl -I http://localhost:3123

# Check Redis connectivity
redis-cli ping
```

### Version & Build Information

| Item          | Value                                                    |
|---------------|----------------------------------------------------------|
| Git Branch    | `release-3.3.0`                                          |
| Docker Image  | `shikshalokamqa/elevate-chat-communications:1.1`         |

---

<br><br>

## Cache Management and Redis Setup

### **Step 1: Update Redis Configuration**

Add the following to your `.env` file:

```env
CACHE_ENABLED=true
CACHE_TTL_ORG_DATA=86400      # 24 hours for organization data
CACHE_TTL_SESSION_DATA=7200   # 2 hours for session data
CACHE_TTL_USER_DATA=21600     # 6 hours for user profiles
```

### **Step 2: Clear Existing Cache**

```bash
# Clear all cached data before upgrade
redis-cli FLUSHDB

# Or clear specific organization data
redis-cli --scan --pattern "org:*" | xargs redis-cli DEL
```

### **Step 3: Restart Redis Service**

```bash
sudo service redis-server restart
```

### Version & Build Information

| Item          | Value              |
|---------------|--------------------|
| Git Branch    | `release-3.3.0`    |
| Docker Image  | `redis:6.2-alpine` |

---

<br><br>

# Overall Health Check

```bash
# Database connectivity
psql -h localhost -U postgres -d mentoring -c "SELECT version();"

# Redis connectivity
redis-cli ping

# Check all tables are present
psql -h localhost -U postgres -d mentoring -c "\dt"
```

---

# Rollback Commands

### Undo Last Migration
```bash
cd mentoring/src
npx sequelize-cli db:migrate:undo
```

### Restore from Backup (Emergency)
```bash
dropdb mentoring
createdb mentoring
psql -h localhost -U postgres mentoring < mentoring_backup_YYYYMMDD_HHMMSS.sql
```

---

# References

- Multi-Tenant Architecture: https://docs.microsoft.com/en-us/azure/architecture/patterns/multitenancy
- Redis Caching Best Practices: https://redis.io/docs/getting-started/
- Sequelize Migration Guide: https://sequelize.org/docs/v6/other-topics/migrations/
- PostgreSQL Documentation: https://www.postgresql.org/docs/current/
- Citus Database Distribution: https://docs.citusdata.com/
