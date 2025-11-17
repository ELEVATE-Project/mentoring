<div align="center">

# Mentor Service

<a href="https://shikshalokam.org/elevate/">
<img
    src="https://shikshalokam.org/wp-content/uploads/2021/06/elevate-logo.png"
    height="140"
    width="300"
  />
</a>

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/ELEVATE-Project/mentoring/tree/master.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/ELEVATE-Project/mentoring/tree/master)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=ELEVATE-Project_mentoring&metric=duplicated_lines_density&branch=master)](https://sonarcloud.io/summary/new_code?id=ELEVATE-Project_mentoring)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=ELEVATE-Project_mentoring&metric=coverage)](https://sonarcloud.io/summary/new_code?id=ELEVATE-Project_mentoring)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=ELEVATE-Project_mentoring&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=ELEVATE-Project_mentoring)
[![Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io)
[![Docs](https://img.shields.io/badge/Docs-success-informational)](https://elevate-docs.shikshalokam.org/mentorEd/intro)

![GitHub package.json version (subfolder of monorepo)](https://img.shields.io/github/package-json/v/ELEVATE-Project/mentoring?filename=src%2Fpackage.json)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

<details><summary>CircleCI insights</summary>

[![CircleCI](https://dl.circleci.com/insights-snapshot/gh/ELEVATE-Project/mentoring/master/buil-and-test/badge.svg?window=30d)](https://app.circleci.com/insights/github/ELEVATE-Project/mentoring/workflows/buil-and-test/overview?branch=integration-testing&reporting-window=last-30-days&insights-snapshot=true)

</details>

<details><summary>develop</summary>

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/ELEVATE-Project/mentoring/tree/develop.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/ELEVATE-Project/mentoring/tree/develop)
![GitHub package.json version (subfolder of monorepo)](https://img.shields.io/github/package-json/v/ELEVATE-Project/mentoring/develop?filename=src%2Fpackage.json)

[![CircleCI](https://dl.circleci.com/insights-snapshot/gh/ELEVATE-Project/mentoring/dev/buil-and-test/badge.svg?window=30d)](https://app.circleci.com/insights/github/ELEVATE-Project/mentoring/workflows/buil-and-test/overview?branch=develop&reporting-window=last-30-days&insights-snapshot=true)

[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=ELEVATE-Project_mentoring&metric=duplicated_lines_density&branch=develop)](https://sonarcloud.io/summary/new_code?id=ELEVATE-Project_mentoring)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=ELEVATE-Project_mentoring&metric=coverage&branch=develop)](https://sonarcloud.io/summary/new_code?id=ELEVATE-Project_mentoring)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=ELEVATE-Project_mentoring&metric=vulnerabilities&branch=develop)](https://sonarcloud.io/summary/new_code?id=ELEVATE-Project_mentoring)

</details>

</br>
The Mentor building block enables effective mentoring interactions between mentors and mentees. The capability aims to create a transparent eco-system to learn, connect, solve, and share within communities. Mentor is an open source mentoring application that facilitates peer learning and professional development by creating a community of mentors and mentees.

</div>
<!-- [![CircleCI](https://dl.circleci.com/status-badge/img/gh/ELEVATE-Project/mentoring/tree/dev.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/ELEVATE-Project/mentoring/tree/dev)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=ELEVATE-Project_mentoring&metric=duplicated_lines_density&branch=master)](https://sonarcloud.io/summary/new_code?id=ELEVATE-Project_mentoring)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=ELEVATE-Project_mentoring&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=ELEVATE-Project_mentoring)
<a href="https://shikshalokam.org/elevate/">
<img
    src="https://shikshalokam.org/wp-content/uploads/2021/06/elevate-logo.png"
    height="140"
    width="300"
   align="right"
  />
</a>
(Dev)
 -->





# New Features
## 1. Chat Communication
- Mentees can send chat requests to the mentors.
- Mentors can accept or decline chat requests.
- Real-time communication is enabled through Rocket.Chat.
## 2. Session creation -> Upload Evidences / resources in session
- Mentors and Session Managers can add **pre-session** and **post-session** resources.
## 3. Session Requests
- Mentees can send a session request to mentors.
- Mentors can review the request and accept or reject it based on their availability on the requested date.
- Until the mentor responds, the mentee cannot send another session request.
- Once the request is accepted, both mentee and mentor can start chatting.
- If the request is accepted, the session will proceed as scheduled, and the mentee can submit another request afterward.
- Mentors can also reject a session request with a note, so the mentee can clearly understand the reason.
- If the request is rejected, the mentee can send a new session request
## 4. Private Session Scheduling
- Mentors can schedule private sessions with mentees.
- For SM, we introduced a filter called Type, which allows them to view either mentees who are connected with a mentor or those who are not connected.
## 5. Account Deletion
- Both mentors and mentees can delete their accounts.
- Provides complete control over personal data and privacy.
## 6. Events Introduced
- Event-based communication has been introduced between the **User Service** and **Mentoring Service** for improved performance and reliability.
##
#


## Prerequisites

Ensure that the MentorEd system is updated to **version 3.1.2** before initiating the upgrade process to **version 3.2**.

# ⚙️ Technical Setup

The setup for **MentorEd version 3.2** involves configuring two primary components:

1. **Rocket.Chat** – Used as the real-time communication platform to enable chat functionality between the users.

2. **Chat Communication Service** – The Chat Communications Service is an internal microservice designed to act as middleware between the core application services and chat platforms like Rocket.Chat. It simplifies the integration, management, and scalability of chat-based communications for various use cases.

For More Details  : https://github.com/ELEVATE-Project/chat-communications/blob/develop/README.md


## **Rocket.Chat Setup**

For detailed deployment and configuration instructions, refer to the official **Rocket.Chat Deployment Guide**:

[Rocket.Chat Deployment Documentation](https://docs.rocket.chat/deploy)

## Chat Communication Service Setup

For detailed deployment and configuration instructions, refer to the official  
[Chat Communication Service Documentation](https://github.com/ELEVATE-Project/chat-communications/blob/develop/README.md).


### Step 1 : Add Chat Service .env
File Path : src/.env

```env

  "APPLICATION_ENV" = "development"
  "APPLICATION_PORT" = 3123    
  "CHAT_PLATFORM" = "rocketchat"  
  "CHAT_PLATFORM_ACCESS_TOKEN" = ""  // rocket chat access token
  "CHAT_PLATFORM_ADMIN_EMAIL" = "" //  rocket-chat admin email address
  "CHAT_PLATFORM_ADMIN_PASSWORD" = "" // rocket-chat admin password
  "CHAT_PLATFORM_ADMIN_USER_ID" = "" //  rocket chat admin user id 

  // update the domain of the rocket chat, sample url will be added below.
  "CHAT_PLATFORM_URL" = "https://chat-dev-temp.elevate-apis.shikshalokam.org"   

 
  "DEV_DATABASE_URL" = "postgres://shikshalokam:password@localhost:5432/
chat_elevate_communications"  

  "INTERNAL_ACCESS_TOKEN":"FqHQ0gXydRtBCg5l",  //same as mentoring service 
 

  "PASSWORD_HASH_SALT": ""
  "PASSWORD_HASH_LENGTH": 10
 

  "USERNAME_HASH_SALT": ""
  "USERNAME_HASH_LENGTH": 10

```



### Step 2 : Install Dependencies

```bash
    npm run install
```
### Step 2 : Run Database Migrations

```bash
    npm run db:init
```

### Step 4: Start the Service
   Start the Chat Communication Service


#

# Deployment of Mentoring Service

### **Step 1: Update Environment Variables**

Update the `.env` file with the following configuration:

```env
COMMUNICATION_SERVICE_BASE_URL=/communications
COMMUNICATION_SERVICE_HOST=http://localhost:3123
ENABLE_CHAT=true
PORTAL_BASE_URL=https://dev.elevate-mentoring.shikshalokam.org
EVENTS_TOPIC=qa.userCreate   # Ensure this matches the User Service configuration

```

### Step 2 : Install Dependencies

```bash
    npm run install
```
### Step 2 : Run Database Migrations

```bash
    npm run db:init
```

### Step 4: Restart the Service
   Restart the Mentoring Service to apply the latest configurations and updates.


# 

# **Deployment of Interface Service**

### Step 1: update .env 

```env

    "ROUTE_CONFIG_JSON_URLS_PATHS": "https://raw.githubusercontent.com/ELEVATE-Project/utils/refs/heads/staging/interface-routes/elevate-routes.json"
    // update elevate-mentoring package version
    "REQUIRED_PACKAGES": "elevate-mentoring@1.2.93”
```

### Step 2 : Install Dependencies

```bash
    npm run install
```

### Step 3: Restart the Service
   Restart the Interface Service to apply the latest configurations and updates.

#

# **Deployment of User Service**

### Step 1: update .env

```env
    "EVENT_USER_KAFKA_TOPIC": "qa.userCreate" // Make sure topic is same as mentoring 
```
### Step 2 : Install Dependencies

```bash
    npm run install
```
### Step 3 : Run Database Migrations

```bash
    npm run db:init
```

### Step 4: Restart the Service
   Restart the User Service to apply the latest configurations and updates.

#

# **Deployment of the Mentoring frontend**

### Step 1: update .env

```env
    "chatBaseUrl": "https://chat-dev-temp.elevate-apis.shikshalokam.org/",
    "chatWebSocketUrl": "wss://chat-dev-temp.elevate-apis.shikshalokam.org/websocket",

```
### Step 2: Run form script

> export AUTH_TOKEN= \< ADMIN_ACCESS_TOKEN \>
>
> export API_URL= \< API_BASE_URL \>
>
> **npm run manage-forms**

### Step 3:** **Restart the pm2

# 

# 

# \*\* \*\*

# **References**

\- Rocket.Chat Docs: https://docs.rocket.chat/

\- Chat Communication Service Repo:
https://github.com/ELEVATE-Project/chat-communications/tree/develop

\- Docker Installation Guide:
https://docs.docker.com/engine/install/ubuntu/

\- Docker Compose Docs: https://docs.docker.com/compose/
</div>