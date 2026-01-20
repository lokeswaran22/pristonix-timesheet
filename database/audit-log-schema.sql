-- Activity History/Audit Log Table
CREATE TABLE IF NOT EXISTS activity_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER,
    user_id INTEGER NOT NULL,
    action_type VARCHAR(20) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'RESTORE'
    action_by INTEGER NOT NULL, -- User ID who performed the action
    action_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Activity details before change
    old_data TEXT, -- JSON string of old activity data
    
    -- Activity details after change
    new_data TEXT, -- JSON string of new activity data
    
    -- Additional metadata
    date_key VARCHAR(10) NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (action_by) REFERENCES users(id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_history_user ON activity_history(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_history_date ON activity_history(date_key);
CREATE INDEX IF NOT EXISTS idx_activity_history_action ON activity_history(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_history_timestamp ON activity_history(action_timestamp);
