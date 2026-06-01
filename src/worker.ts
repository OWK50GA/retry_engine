import db from './db';

const getDueRequests = db.prepare(`
    SELECT * FROM requests
    WHERE status IN ('pending', 'retrying')    
    AND (next_retry_at IS NULL OR next_retry_at <= ?)
    LIMIT 10
`);

const due = getDueRequests.all(Date.now());