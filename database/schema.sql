-- Database Schema for Timesheet Application (PostgreSQL)

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'employee',
    email VARCHAR(255),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    dateKey VARCHAR(255) NOT NULL,
    userId INTEGER NOT NULL,
    timeSlot VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    pagesDone VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_activities_date_user 
ON activities(dateKey, userId);

-- Leave requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL,
    dateKey VARCHAR(255) NOT NULL,
    startSlot VARCHAR(255),
    endSlot VARCHAR(255),
    isFullDay BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_leave_user FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Permission requests table
CREATE TABLE IF NOT EXISTS permission_requests (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL,
    dateKey VARCHAR(255) NOT NULL,
    startSlot VARCHAR(255) NOT NULL,
    endSlot VARCHAR(255) NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_permission_user FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    dateKey VARCHAR(255),
    employeeName VARCHAR(255) NOT NULL,
    activityType VARCHAR(255) NOT NULL,
    description TEXT,
    timeSlot VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    editedBy VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default Admin User (Password: !pristonixadmin@2025)
-- Note: Password should be hashed using bcrypt in the application. 
-- This SQL just shows the intent. The application handles the actual insertion with hashing.
