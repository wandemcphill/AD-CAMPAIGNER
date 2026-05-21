# Backup And Recovery Foundation

- PostgreSQL: daily encrypted logical dumps, point-in-time recovery once production WAL archiving is enabled.
- Redis: append-only persistence for queues, with replay policy documented per queue.
- Object storage: versioned buckets for media assets, generated thumbnails, and audit exports.
- Rollback: application rollbacks should be artifact-based; database migrations require backward-compatible deploy windows.
