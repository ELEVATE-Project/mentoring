<div align="center">

# Mentor Service

<a href="https://shikshalokam.org/elevate/">
<img
    src="https://shikshalokam.org/wp-content/uploads/2021/06/elevate-logo.png"
    height="140"
    width="300"
  />
</a>

</br>

</br>
The Mentor building block enables effective mentoring interactions between mentors and mentees. The capability aims to create a transparent eco-system to learn, connect, solve, and share within communities. Mentor is an open source mentoring application that facilitates peer learning and professional development by creating a community of mentors and mentees.

</div>

<br><br>

## General Notes

-   All environment variables must be verified before deployment.
-   Execute migration scripts only after successful deployment of each respective service.
-   For Docker-based deployments, update the image tag to the latest version as specified for each service.
-   For PM2 deployments, use the specified branch name.
-   Initiate the User Service deployment first, followed by the deployment of the other services.

<br><br>

# New Features

## 1. Strict Tenant Isolation
- Entity types, forms, and notification templates are now scoped strictly to the requesting tenant.
- Previously, queries would return data from the tenant combined with the default tenant's shared data. Data retrieval is now filtered by the current tenant code only, ensuring each tenant operates on its own isolated configuration.
- Materialized views used for performance are now built and refreshed **per tenant**.

## 2. Kafka-Based Tenant & Organization Event Handling
- Event-based communication has been introduced between the **User Service** and **Mentoring Service** for tenant and organization lifecycle management.
- Dedicated Kafka topics are now used to handle **tenant** and **organization** events independently, improving reliability and scalability.
- When a new tenant is created via a Kafka event, the Mentoring Service automatically:
  - Creates the tenant record.
  - Replicates default tenant configuration (entity types, forms, policies) for the new tenant.
  - Builds materialized views for the new tenant.
  - Registers periodic view refresh jobs in the Scheduler Service.

## 3. Per-Tenant Materialized View Refresh Scheduling
- Periodic materialized view refresh jobs are now registered individually per tenant upon tenant creation.
- Each model (e.g. `UserExtension`, `Session`) can have its own configurable refresh interval via environment variables.

#

<br><br>

# Prerequisites

Ensure that the MentorEd system is updated to **version 3.2** before initiating the upgrade process to **version 3.3**.

<br><br>

# **Technical Setup**

<br><br>

## **Deployment of Mentoring Service**

### **Step 1: Update Environment Variables**

Add the following variables to the `.env` file:

```env
# Kafka topic for tenant lifecycle events (create/update) from the User Service
EVENT_TENANT_KAFKA_TOPIC=

# Kafka topic for organization lifecycle events (create/update) from the User Service
EVENT_ORGANIZATION_KAFKA_TOPIC=
```

> **Note:** Ensure these topic names match the corresponding topic configuration in the **User Service**.

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Run Database Migrations

```bash
npm run db:init
```

### Step 4: Restart the Service
Restart the Mentoring Service to apply the latest configurations and updates.

#

<br><br>

## **Backfill Tenant Data** *(Required when upgrading from an older version)*

If you are migrating to **v3.3** from an older version, you must run the tenant backfill script to populate existing tenant data into the Mentoring Service.

### Step 1: Export the Tenant CSV from User Service

Export the `tenant` table from the **User Service** database as a CSV file.

The CSV **must** include a header row with the following required columns:

```
code,name,org_id,org_code
```

Optional columns: `status`, `description`, `logo`

**Example:**
```
code,name,org_id,org_code
tenant_alpha,Alpha School,85,default_code
tenant_beta,Beta Academy,86,default_code
```

> The default tenant configuration will be replicated automatically for any newly created tenant records.

### Step 2: (Optional) Dry Run

Preview what the script will process without making any changes:

```bash
node src/scripts/backfillTenantData.js <path-to-csv> --dry-run
```

### Step 3: Run the Backfill Script

```bash
node src/scripts/backfillTenantData.js <path-to-csv>
```

**Notes:**
- The script is **idempotent** — it is safe to re-run without causing duplicate records.
- Tenant-specific configuration will be replicated from the default tenant for any newly created tenants.
- The script exits with code `1` if any rows fail; check the console output for per-row status.

#
