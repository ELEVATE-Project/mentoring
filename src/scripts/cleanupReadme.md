# 🧹 PostgreSQL Cleanup Script for Mentoring

This Node.js script connects to a PostgreSQL database and deletes specific records from tables used in a mentoring platform. It's designed to **clean up development, staging, or QA environments** by removing test data related to sessions, user extensions, and organization metadata.

---

## 📄 What This Script Does

The script connects to a PostgreSQL database and deletes **all records** from the following tables:

| Table Name               | Description                                                               |
| ------------------------ | ------------------------------------------------------------------------- |
| `sessions`               | Deletes all session records                                               |
| `session_attendees`      | Removes attendees linked to sessions                                      |
| `session_enrollments`    | Clears all session enrollment records                                     |
| `session_ownerships`     | Removes ownership associations with sessions                              |
| `user_extensions`        | Deletes all user-related extension data                                   |
| `organization_extension` | Deletes all records **except** the one with name `'Default Organization'` |
| `feedbacks`              | Removes all user feedback entries                                         |

Each deletion logs the number of rows removed for transparency.

---

## ⚙️ Prerequisites

-   **Node.js** installed (version 14 or higher)
-   Access to a **PostgreSQL** database
-   Install the required PostgreSQL package:

```bash
npm install pg
```

update the below config before executing the script

const client = new Client({
user: 'postgres',
host: 'localhost',
database: 'mentoringfeb15',
password: 'postgres',
port: 5432,
});

```bash
node dataCleanUp.js
```

You should see output similar to:

Connected to PostgreSQL
Deleted 5 record(s) from sessions
Deleted 12 record(s) from session_attendees
Deleted 9 record(s) from session_enrollments
Deleted 3 record(s) from session_ownerships
Deleted 10 record(s) from user_extensions
Deleted 2 record(s) from orgnization_extension (except org 1)
Deleted 6 record(s) from feedbacks
Disconnected from PostgreSQL
