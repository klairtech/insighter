# Database Connectors Documentation

This document provides comprehensive information about all supported database connectors in Insighter.

## 🗄️ Supported Database Types

### SQL Databases

#### 1. PostgreSQL

- **Type**: `postgresql`
- **Default Port**: 5432
- **Description**: Advanced open source relational database
- **Features**: Full schema support, table/column analysis, relationship mapping
- **Connection**: Standard PostgreSQL connection string or individual parameters

#### 2. MySQL

- **Type**: `mysql`
- **Default Port**: 3306
- **Description**: Popular open source relational database
- **Features**: Full schema support, table/column analysis, relationship mapping
- **Connection**: Standard MySQL connection string or individual parameters

#### 3. SQLite

- **Type**: `sqlite`
- **Default Port**: N/A
- **Description**: Lightweight embedded database
- **Features**: File-based connection, schema analysis
- **Connection**: File path to SQLite database file

#### 4. BigQuery

- **Type**: `bigquery`
- **Default Port**: N/A
- **Description**: Google's cloud data warehouse
- **Features**: Dataset and table analysis, column metadata
- **Connection**: Google Cloud service account credentials

#### 5. Amazon Redshift

- **Type**: `redshift`
- **Default Port**: 5439
- **Description**: AWS cloud data warehouse
- **Features**: PostgreSQL-compatible protocol, schema analysis, table/column metadata
- **Connection**: Redshift cluster endpoint, username/password
- **Requirements**: SSL connection required

#### 6. Azure SQL Database

- **Type**: `azure-sql`
- **Default Port**: 1433
- **Description**: Microsoft Azure managed SQL database
- **Features**: Full SQL Server compatibility, schema analysis, table/column metadata
- **Connection**: Azure SQL server endpoint, username/password
- **Requirements**: Encryption required

#### 7. Snowflake

- **Type**: `snowflake`
- **Default Port**: 443
- **Description**: Cloud data platform for data warehousing
- **Features**: Schema and table analysis, warehouse information
- **Connection**: Account identifier, username/password, warehouse, role
- **Requirements**: Snowflake account and warehouse access

#### 8. Oracle Database

- **Type**: `oracle`
- **Default Port**: 1521
- **Description**: Enterprise relational database system
- **Features**: Full schema support, table/column analysis, TNS support
- **Connection**: Host/port, service name or SID, username/password
- **Requirements**: Oracle client libraries

#### 9. SQL Server

- **Type**: `mssql`
- **Default Port**: 1433
- **Description**: Microsoft SQL Server database
- **Features**: Full schema support, table/column analysis, Windows Authentication
- **Connection**: Server endpoint, username/password, database name
- **Requirements**: SQL Server access and appropriate permissions

### NoSQL Databases

#### 1. MongoDB

- **Type**: `mongodb`
- **Default Port**: 27017
- **Description**: NoSQL document database
- **Features**: Collection analysis, document structure insights
- **Connection**: MongoDB connection string or individual parameters

#### 2. Redis

- **Type**: `redis`
- **Default Port**: 6379
- **Description**: In-memory data structure store
- **Features**: Key analysis, data type insights
- **Connection**: Redis server endpoint, authentication if required

## 🔧 Connection Configuration

### Common Parameters

All database connections support these common parameters:

- **Host**: Database server hostname or IP address
- **Port**: Database server port (uses default if not specified)
- **Database**: Database name
- **Username**: Database username
- **Password**: Database password
- **SSL**: Enable/disable SSL connection (required for some cloud databases)

### Database-Specific Parameters

#### Amazon Redshift

```json
{
  "type": "redshift",
  "host": "your-cluster.region.redshift.amazonaws.com",
  "port": "5439",
  "database": "your_database",
  "username": "your_username",
  "password": "your_password",
  "ssl": true
}
```

#### Azure SQL Database

```json
{
  "type": "azure-sql",
  "host": "your-server.database.windows.net",
  "port": "1433",
  "database": "your_database",
  "username": "your_username",
  "password": "your_password",
  "ssl": true
}
```

#### Snowflake

```json
{
  "type": "snowflake",
  "account": "your-account.snowflakecomputing.com",
  "username": "your_username",
  "password": "your_password",
  "database": "your_database",
  "warehouse": "your_warehouse",
  "role": "your_role"
}
```

#### Oracle Database

```json
{
  "type": "oracle",
  "host": "your-oracle-server.com",
  "port": "1521",
  "database": "your_service_name",
  "username": "your_username",
  "password": "your_password",
  "connectionString": "your-oracle-server.com:1521/your_service_name"
}
```

#### SQL Server

```json
{
  "type": "mssql",
  "host": "your-sql-server.com",
  "port": "1433",
  "database": "your_database",
  "username": "your_username",
  "password": "your_password",
  "ssl": false
}
```

## 🔐 Security Considerations

### SSL/TLS Encryption

- **Required**: Amazon Redshift, Azure SQL Database
- **Recommended**: All cloud databases
- **Optional**: On-premise databases

### Authentication Methods

- **Username/Password**: All databases
- **Windows Authentication**: SQL Server (planned)
- **OAuth**: Snowflake (planned)
- **Service Accounts**: BigQuery, Azure SQL (planned)

### Connection Security

- All passwords are encrypted before storage
- Connection strings are encrypted in the database
- SSL connections are enforced for cloud databases
- Connection timeouts prevent hanging connections

## 🚀 Getting Started

### 1. Choose Your Database Type

Select the appropriate database type from the connection modal.

### 2. Enter Connection Details

Provide the required connection parameters for your database.

### 3. Test Connection

Use the "Test Connection" button to verify your settings before saving.

### 4. Configure Schema

Select the schema/database to analyze and choose tables of interest.

### 5. Generate AI Insights

Let Insighter analyze your database structure and generate intelligent descriptions.

## 🔍 Schema Analysis Features

### Table Analysis

- Table names and types (BASE TABLE, VIEW)
- Row counts and size information
- Last modified timestamps
- Table descriptions and comments

### Column Analysis

- Column names and data types
- Nullable constraints
- Default values
- Column descriptions and comments

### Relationship Mapping

- Foreign key relationships
- Primary key identification
- Index information
- Constraint analysis

## 🛠️ Troubleshooting

### Common Connection Issues

#### Connection Refused

- Verify host and port are correct
- Check if database server is running
- Ensure firewall allows connections

#### Authentication Failed

- Verify username and password
- Check user permissions
- Ensure user has access to the specified database

#### SSL/TLS Errors

- Enable SSL for cloud databases
- Check certificate validity
- Verify SSL configuration

#### Schema Access Issues

- Ensure user has schema access permissions
- Check if schema exists
- Verify table/view permissions

### Database-Specific Issues

#### Amazon Redshift

- Ensure cluster is running and accessible
- Check security group settings
- Verify VPC configuration

#### Azure SQL Database

- Check firewall rules
- Verify Azure AD authentication if used
- Ensure database exists and is accessible

#### Snowflake

- Verify account identifier format
- Check warehouse is running
- Ensure user has appropriate role permissions

#### Oracle Database

- Verify TNS configuration
- Check service name or SID
- Ensure Oracle client is properly configured

## 📊 Performance Considerations

### Connection Pooling

- Connections are pooled for efficiency
- Automatic connection cleanup
- Configurable pool sizes

### Query Optimization

- Schema queries are optimized for each database type
- Minimal data transfer for metadata
- Efficient table and column enumeration

### Caching

- Schema information is cached
- Connection test results are cached
- AI-generated descriptions are cached

## 🔄 Future Enhancements

### Planned Features

- **Additional Connectors**: DynamoDB, Cassandra, CouchDB
- **Advanced Authentication**: OAuth, SAML, LDAP
- **Real-time Sync**: Live schema monitoring
- **Performance Metrics**: Query performance analysis
- **Data Sampling**: Intelligent data sampling for analysis

### Integration Improvements

- **API Endpoints**: RESTful API for connector management
- **Webhook Support**: Real-time notifications
- **Batch Operations**: Bulk connector management
- **Template System**: Pre-configured connection templates

## 📞 Support

For issues with specific database connectors:

1. Check the troubleshooting section above
2. Verify your connection parameters
3. Test with a database client tool
4. Contact support with specific error messages

## 📝 Changelog

### Version 1.0.0

- Initial release with PostgreSQL, MySQL, SQLite, BigQuery support
- Basic schema analysis and AI insights

### Version 1.1.0

- Added Amazon Redshift connector
- Added Azure SQL Database connector
- Added Snowflake connector
- Added Oracle Database connector
- Added SQL Server connector
- Enhanced error handling and connection testing
- Improved schema analysis capabilities
