# NetBox Docker Setup for ArchiFlow

This directory contains a complete Docker Compose setup for NetBox with PostgreSQL, Redis, and background workers.

## Quick Start

1. **Copy environment file and configure:**
   ```bash
   cp .env.example .env
   # Edit .env file with your configuration
   ```

2. **Generate a new SECRET_KEY for production:**
   ```bash
   ./netbox-docker.sh generate-key
   # Update the SECRET_KEY in your .env file
   ```

3. **Start the services:**
   ```bash
   docker-compose up -d
   # OR use the helper script
   ./netbox-docker.sh start
   ```

4. **Wait for initialization (1-2 minutes), then access NetBox:**
   - URL: http://localhost:8000
   - Default credentials: admin / admin (change immediately!)

## Architecture

### Services

1. **netbox**: Main NetBox application (port 8000)
2. **netbox-postgres**: PostgreSQL 15 database
3. **netbox-redis**: Redis for task queuing
4. **netbox-redis-cache**: Redis for caching
5. **netbox-worker**: Background task processor
6. **netbox-housekeeping**: Periodic maintenance tasks

### Networks

- **netbox-backend**: Internal network for database/cache (isolated)
- **netbox-frontend**: External access network
- **archiflow-network**: Shared network for ArchiFlow integration

### Volumes

- **netbox-postgres-data**: PostgreSQL data persistence
- **netbox-redis-data**: Redis persistence
- **netbox-media**: Uploaded files and images
- **netbox-reports**: Custom reports
- **netbox-scripts**: Custom scripts

## Management Commands

Use the `netbox-docker.sh` script for common operations:

```bash
# Start services
./netbox-docker.sh start

# Stop services
./netbox-docker.sh stop

# View logs
./netbox-docker.sh logs
./netbox-docker.sh logs netbox  # Specific service

# Check status
./netbox-docker.sh status

# Create backup
./netbox-docker.sh backup

# Test installation
./netbox-docker.sh test

# Database operations
./netbox-docker.sh migrate
./netbox-docker.sh dbshell

# Create superuser
./netbox-docker.sh createsuperuser
```

## Docker Compose Commands

```bash
# Start all services
docker-compose up -d

# Stop services
docker-compose stop

# View logs
docker-compose logs -f

# Restart a specific service
docker-compose restart netbox

# Execute command in container
docker-compose exec netbox /bin/bash

# Remove everything (including volumes)
docker-compose down -v
```

## Configuration

### Environment Variables

Key environment variables in `.env`:

- `POSTGRES_PASSWORD`: Database password
- `SECRET_KEY`: NetBox secret key (MUST change for production!)
- `SUPERUSER_NAME`: Initial admin username
- `SUPERUSER_PASSWORD`: Initial admin password
- `DEBUG`: Enable debug mode (set to false for production)
- `LOGGING_LEVEL`: Log verbosity (INFO, DEBUG, WARNING, ERROR)

### Production Considerations

1. **Security:**
   - Generate a new SECRET_KEY
   - Change default passwords
   - Configure ALLOWED_HOSTS
   - Use HTTPS proxy (nginx/traefik)

2. **Performance:**
   - Adjust PostgreSQL settings for your workload
   - Configure Redis memory limits
   - Scale worker containers if needed

3. **Backup:**
   - Regular database backups: `./netbox-docker.sh backup`
   - Consider automated backup solutions
   - Test restore procedures

## Integration with ArchiFlow

The setup includes the `archiflow-network` which allows communication between NetBox and ArchiFlow containers:

```bash
# Connect ArchiFlow container to the network
docker network connect archiflow-network <archiflow-container>

# Access NetBox from ArchiFlow container
curl http://netbox:8080/api/
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs netbox
./netbox-docker.sh logs

# Verify health
./netbox-docker.sh test
```

### Database connection issues
```bash
# Check PostgreSQL status
docker-compose exec netbox-postgres pg_isready -U netbox

# View PostgreSQL logs
docker-compose logs netbox-postgres
```

### Redis connection issues
```bash
# Test Redis connectivity
docker-compose exec netbox-redis redis-cli ping

# Check Redis logs
docker-compose logs netbox-redis
```

### Performance issues
```bash
# Monitor resource usage
docker stats

# Check worker queue
docker-compose exec netbox-redis redis-cli -n 0 llen default
```

## Maintenance

### Updates
```bash
# Pull latest images
docker-compose pull

# Recreate containers
docker-compose up -d --force-recreate

# Run migrations
./netbox-docker.sh migrate
```

### Cleanup
```bash
# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Complete cleanup (CAUTION: removes data!)
docker-compose down -v
```

## Support

- NetBox Documentation: https://docs.netbox.dev/
- Docker Image Docs: https://github.com/netbox-community/netbox-docker
- ArchiFlow Integration: See ArchiFlow documentation