# Deployment Guide for Timesheet Application

This application handles timesheets using a Node.js backend and a **SQLite** database.

## Prerequisites

- **Node.js** (v14 or higher) must be installed on the deployment machine/server.

## Option 1: Running on a Windows Server / Local PC (Recommended)

Since the application uses SQLite (`database/timesheet.db`), the easiest deployment is running it directly on your server or a designated PC on your network.

### Steps:
1.  **Copy Files**: Copy the entire project folder to the destination server (e.g., `C:\Apps\Timesheet`).
2.  **Install Dependencies**:
    Open Command Prompt in that folder and run:
    ```cmd
    npm install
    ```
    *(If you copied `node_modules`, you can skip this, but a fresh install is safer).*

3.  **Start the Application**:
    Run the included batch file:
    ```cmd
    start-prod.bat
    ```
    This will start the server on Port 3000.

4.  **Access**:
    - **Localhost**: `http://localhost:3000`
    - **Network**: Find the server's IP address (run `ipconfig`), e.g., `192.168.1.50`.
    - Other users can access it via `http://192.168.1.50:3000`.
    - *Note: Ensure Windows Firewall allows traffic on Port 3000.*

## Option 2: Running with PM2 (Production Process Manager)

For a more professional setup where the app restarts automatically if it crashes or on boot:

1.  **Install PM2**:
    ```cmd
    npm install -g pm2
    ```

2.  **Start App**:
    ```cmd
    pm2 start server/server-sqlite.js --name "timesheet-app"
    ```

3.  **Save List**:
    ```cmd
    pm2 save
    ```

4.  **Startup Script** (Optional):
    PM2 can generate a startup script so the app launches when Windows boots.
    ```cmd
    npm install pm2-windows-startup -g
    pm2-startup install
    ```

## Database Backups

Your data is stored in `database/timesheet.db`.
**Regularly backup this file.** You can simply copy it to another location.

## Configuration

  Example (Windows): `set PORT=8080 && npm start`

## Option 3: Cloud Deployment with PostgreSQL (Render/Neon/Railways)

To deploy to a cloud provider where persistent local storage is not guaranteed, you must use PostgreSQL.

### Steps:
1.  **Get a PostgreSQL Database**:
    - Sign up for [Neon.tech](https://neon.tech) (Free) or [Render PostgreSQL](https://render.com).
    - Get the **Connection String** (e.g., `postgres://user:pass@host/db`).

2.  **Configure Environment**:
    - In your cloud dashboard, add an **Environment Variable**:
      - Key: `DATABASE_URL`
      - Value: `(Your connection string)`

3.  **Deploy Code**:
    - Connect your GitHub repository to the cloud provider (Render/Vercel).
    - **Build Command**: `npm install`
    - **Start Command**: `npm run start:pg`

4.  **Local Postgres Testing**:
    - Create a `.env` file in the project root:
      ```
      DATABASE_URL=postgres://user:pass@localhost:5432/timesheet
      ```
    - Run `npm run start:pg` locally.
