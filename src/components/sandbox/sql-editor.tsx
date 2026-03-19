'use client';

import { useRef, useEffect, useState } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorSelection, EditorState } from '@codemirror/state';
import { sql, MySQL } from '@codemirror/lang-sql';
import { defaultKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  autocompletion,
  completionStatus,
  closeBrackets,
  closeBracketsKeymap,
  type CompletionContext,
  type Completion,
} from '@codemirror/autocomplete';
import type { TableSchema } from '@/types/database';

// ── MySQL keywords (ALL CAPS, matching real MySQL style) ──────────
const SQL_KEYWORDS = [
  // DML
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'REPLACE', 'MERGE', 'TRUNCATE',
  // Joins
  'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'FULL OUTER JOIN',
  'CROSS JOIN', 'NATURAL JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'ON', 'USING',
  // Clauses
  'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'ALL', 'AS',
  'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT', 'MINUS',
  // Subqueries & expressions
  'IN', 'NOT IN', 'EXISTS', 'NOT EXISTS', 'ANY', 'SOME',
  'BETWEEN', 'LIKE', 'NOT LIKE', 'REGEXP', 'IS NULL', 'IS NOT NULL',
  'AND', 'OR', 'NOT', 'XOR', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  // DDL
  'CREATE TABLE', 'CREATE TABLE IF NOT EXISTS', 'ALTER TABLE', 'DROP TABLE',
  'DROP TABLE IF EXISTS', 'CREATE INDEX', 'DROP INDEX', 'CREATE VIEW', 'DROP VIEW',
  'CREATE DATABASE', 'DROP DATABASE', 'USE', 'RENAME TABLE',
  // Table modifiers
  'ADD COLUMN', 'DROP COLUMN', 'MODIFY COLUMN', 'CHANGE COLUMN', 'RENAME COLUMN',
  'ADD CONSTRAINT', 'DROP CONSTRAINT', 'ADD INDEX',
  // Constraints
  'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'NOT NULL', 'DEFAULT',
  'CHECK', 'AUTO_INCREMENT', 'ON DELETE CASCADE', 'ON UPDATE CASCADE',
  'ON DELETE SET NULL', 'ON DELETE RESTRICT',
  // Data types
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
  'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL',
  'CHAR', 'VARCHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT',
  'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
  'BOOLEAN', 'BOOL', 'ENUM', 'SET', 'JSON', 'UUID',
  // Transaction
  'BEGIN', 'START TRANSACTION', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
  'RELEASE SAVEPOINT', 'ROLLBACK TO SAVEPOINT',
  // Control
  'IF', 'ELSE', 'ELSEIF', 'WHILE', 'LOOP', 'REPEAT', 'LEAVE', 'ITERATE',
  'DECLARE', 'CURSOR', 'OPEN', 'FETCH', 'CLOSE',
  // Triggers & procedures
  'CREATE TRIGGER', 'DROP TRIGGER', 'CREATE PROCEDURE', 'DROP PROCEDURE',
  'CREATE FUNCTION', 'DROP FUNCTION', 'CALL', 'RETURN', 'RETURNS',
  'BEFORE', 'AFTER', 'FOR EACH ROW', 'DELIMITER',
  // Temporary & special
  'CREATE TEMPORARY TABLE', 'DROP TEMPORARY TABLE',
  'CREATE OR REPLACE VIEW', 'CREATE UNIQUE INDEX',
  // Locking reads
  'FOR UPDATE', 'FOR SHARE', 'LOCK IN SHARE MODE',
  'SKIP LOCKED', 'NOWAIT',
  // Table maintenance
  'OPTIMIZE TABLE', 'ANALYZE TABLE', 'CHECK TABLE', 'REPAIR TABLE',
  'CHECKSUM TABLE',
  // Table/index locking
  'LOCK TABLES', 'UNLOCK TABLES', 'READ', 'WRITE',
  // Prepared statements
  'PREPARE', 'EXECUTE', 'DEALLOCATE PREPARE',
  // Index hints
  'USE INDEX', 'FORCE INDEX', 'IGNORE INDEX',
  // SHOW variants
  'SHOW TABLES', 'SHOW COLUMNS', 'SHOW DATABASES', 'SHOW SCHEMAS',
  'SHOW CREATE TABLE', 'SHOW CREATE VIEW', 'SHOW CREATE DATABASE',
  'SHOW INDEX', 'SHOW INDEXES', 'SHOW KEYS',
  'SHOW STATUS', 'SHOW GLOBAL STATUS', 'SHOW SESSION STATUS',
  'SHOW VARIABLES', 'SHOW GLOBAL VARIABLES', 'SHOW SESSION VARIABLES',
  'SHOW PROCESSLIST', 'SHOW FULL PROCESSLIST',
  'SHOW GRANTS', 'SHOW GRANTS FOR',
  'SHOW WARNINGS', 'SHOW ERRORS', 'SHOW COUNT',
  'SHOW TABLE STATUS', 'SHOW FULL TABLES', 'SHOW FULL COLUMNS',
  'SHOW CHARACTER SET', 'SHOW COLLATION',
  'SHOW ENGINE', 'SHOW ENGINES', 'SHOW STORAGE ENGINES',
  'SHOW PLUGINS', 'SHOW PRIVILEGES',
  'SHOW TRIGGERS', 'SHOW EVENTS',
  'SHOW CREATE TRIGGER', 'SHOW CREATE PROCEDURE',
  'SHOW FUNCTION STATUS', 'SHOW PROCEDURE STATUS',
  'SHOW OPEN TABLES', 'SHOW MASTER STATUS', 'SHOW SLAVE STATUS',
  'SHOW BINARY LOGS', 'SHOW BINLOG EVENTS',
  'SHOW RELAYLOG EVENTS',
  // SET variants
  'SET NAMES', 'SET CHARACTER SET', 'SET CHARSET',
  'SET GLOBAL', 'SET SESSION', 'SET LOCAL',
  'SET AUTOCOMMIT', 'SET TRANSACTION ISOLATION LEVEL',
  'READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE',
  // Character sets & collation
  'CHARACTER SET', 'COLLATE', 'BINARY',
  'UTF8', 'UTF8MB4', 'LATIN1', 'ASCII',
  // Fulltext search
  'MATCH', 'AGAINST', 'IN BOOLEAN MODE', 'IN NATURAL LANGUAGE MODE',
  'WITH QUERY EXPANSION',
  // CTE & Window
  'WITH', 'RECURSIVE', 'LATERAL',
  'WINDOW', 'ROWS BETWEEN', 'RANGE BETWEEN',
  'UNBOUNDED PRECEDING', 'UNBOUNDED FOLLOWING',
  'CURRENT ROW', 'PRECEDING', 'FOLLOWING',
  // Partitioning
  'PARTITION BY', 'PARTITIONS', 'SUBPARTITION',
  'PARTITION', 'HASH', 'KEY', 'RANGE', 'LIST', 'LINEAR',
  // Events & scheduling
  'CREATE EVENT', 'DROP EVENT', 'ALTER EVENT',
  'ON SCHEDULE', 'AT', 'EVERY', 'STARTS', 'ENDS', 'ON COMPLETION',
  'ENABLE', 'DISABLE', 'DO',
  // Error handling
  'SIGNAL', 'RESIGNAL', 'GET DIAGNOSTICS', 'CONDITION',
  'SQLSTATE', 'SQLWARNING', 'SQLEXCEPTION', 'NOT FOUND',
  'HANDLER', 'CONTINUE', 'EXIT', 'UNDO',
  // Load & export
  'LOAD DATA INFILE', 'LOAD DATA LOCAL INFILE',
  'INTO OUTFILE', 'INTO DUMPFILE',
  'FIELDS TERMINATED BY', 'ENCLOSED BY', 'ESCAPED BY',
  'LINES TERMINATED BY', 'STARTING BY',
  // User management
  'CREATE USER', 'DROP USER', 'ALTER USER', 'RENAME USER',
  'CREATE USER IF NOT EXISTS', 'DROP USER IF EXISTS',
  'SHOW USERS', 'SET USER', 'CHANGE USER',
  'SET PASSWORD', 'IDENTIFIED BY',
  'GRANT', 'REVOKE', 'FLUSH PRIVILEGES',
  'GRANT ALL PRIVILEGES', 'GRANT SELECT', 'GRANT INSERT',
  'GRANT UPDATE', 'GRANT DELETE', 'GRANT EXECUTE',
  'WITH GRANT OPTION',
  // Kill & misc
  'KILL', 'KILL QUERY', 'KILL CONNECTION',
  'RESET', 'RESET MASTER', 'RESET SLAVE',
  'PURGE BINARY LOGS', 'PURGE BINARY LOGS BEFORE',
  // Misc keywords
  'ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST',
  'EXPLAIN', 'EXPLAIN ANALYZE', 'EXPLAIN FORMAT',
  'DESCRIBE', 'DESC',
  'INSERT IGNORE', 'REPLACE INTO', 'ON DUPLICATE KEY UPDATE',
  'STRAIGHT_JOIN', 'SQL_CALC_FOUND_ROWS',
  'HIGH_PRIORITY', 'LOW_PRIORITY', 'DELAYED', 'IGNORE',
  'SQL_NO_CACHE', 'SQL_CACHE',
  'SOUNDS LIKE', 'DIV',
  'TRUE', 'FALSE', 'NULL', 'UNKNOWN',
  'INTERVAL', 'MICROSECOND', 'SECOND', 'MINUTE', 'HOUR', 'DAY',
  'WEEK', 'MONTH', 'QUARTER', 'YEAR',
  'SECOND_MICROSECOND', 'MINUTE_MICROSECOND', 'MINUTE_SECOND',
  'HOUR_MICROSECOND', 'HOUR_SECOND', 'HOUR_MINUTE',
  'DAY_MICROSECOND', 'DAY_SECOND', 'DAY_MINUTE', 'DAY_HOUR',
  'YEAR_MONTH',
  // Storage engines
  'ENGINE', 'INNODB', 'MYISAM', 'MEMORY', 'CSV', 'ARCHIVE',
  'COMMENT', 'TABLESPACE', 'ROW_FORMAT',
  'DYNAMIC', 'FIXED', 'COMPRESSED', 'REDUNDANT', 'COMPACT',
  // Replication
  'CHANGE MASTER TO', 'CHANGE REPLICATION SOURCE TO',
  'START SLAVE', 'STOP SLAVE', 'START REPLICA', 'STOP REPLICA',
  'MASTER_HOST', 'MASTER_USER', 'MASTER_PASSWORD', 'MASTER_LOG_FILE', 'MASTER_LOG_POS',
  // PL/SQL style blocks
  'EXCEPTION', 'WHEN OTHERS THEN', 'NO_DATA_FOUND',
  'DBMS_OUTPUT.PUT_LINE', 'RAISE_APPLICATION_ERROR',
];

const SQL_FUNCTIONS = [
  // Aggregate
  { label: 'COUNT', detail: 'COUNT(expr)', info: 'Returns count of non-NULL values' },
  { label: 'SUM', detail: 'SUM(expr)', info: 'Returns sum of values' },
  { label: 'AVG', detail: 'AVG(expr)', info: 'Returns average of values' },
  { label: 'MIN', detail: 'MIN(expr)', info: 'Returns minimum value' },
  { label: 'MAX', detail: 'MAX(expr)', info: 'Returns maximum value' },
  { label: 'GROUP_CONCAT', detail: 'GROUP_CONCAT(expr)', info: 'Concatenates grouped values' },
  // String
  { label: 'CONCAT', detail: 'CONCAT(s1, s2, ...)', info: 'Concatenates strings' },
  { label: 'CONCAT_WS', detail: 'CONCAT_WS(sep, s1, s2)', info: 'Concatenates with separator' },
  { label: 'SUBSTRING', detail: 'SUBSTRING(str, pos, len)', info: 'Extracts a substring' },
  { label: 'SUBSTR', detail: 'SUBSTR(str, pos, len)', info: 'Alias for SUBSTRING' },
  { label: 'LENGTH', detail: 'LENGTH(str)', info: 'Returns string length in bytes' },
  { label: 'CHAR_LENGTH', detail: 'CHAR_LENGTH(str)', info: 'Returns string length in chars' },
  { label: 'UPPER', detail: 'UPPER(str)', info: 'Converts to uppercase' },
  { label: 'LOWER', detail: 'LOWER(str)', info: 'Converts to lowercase' },
  { label: 'TRIM', detail: 'TRIM(str)', info: 'Removes leading/trailing whitespace' },
  { label: 'LTRIM', detail: 'LTRIM(str)', info: 'Removes leading whitespace' },
  { label: 'RTRIM', detail: 'RTRIM(str)', info: 'Removes trailing whitespace' },
  { label: 'REPLACE', detail: 'REPLACE(str, from, to)', info: 'Replaces occurrences in string' },
  { label: 'REVERSE', detail: 'REVERSE(str)', info: 'Reverses a string' },
  { label: 'LEFT', detail: 'LEFT(str, len)', info: 'Returns leftmost characters' },
  { label: 'RIGHT', detail: 'RIGHT(str, len)', info: 'Returns rightmost characters' },
  { label: 'LPAD', detail: 'LPAD(str, len, pad)', info: 'Left-pads a string' },
  { label: 'RPAD', detail: 'RPAD(str, len, pad)', info: 'Right-pads a string' },
  { label: 'LOCATE', detail: 'LOCATE(substr, str)', info: 'Returns position of substring' },
  { label: 'INSTR', detail: 'INSTR(str, substr)', info: 'Returns position of substring' },
  { label: 'FORMAT', detail: 'FORMAT(num, dec)', info: 'Formats number with commas' },
  // Numeric
  { label: 'ABS', detail: 'ABS(num)', info: 'Returns absolute value' },
  { label: 'CEIL', detail: 'CEIL(num)', info: 'Rounds up to nearest integer' },
  { label: 'CEILING', detail: 'CEILING(num)', info: 'Alias for CEIL' },
  { label: 'FLOOR', detail: 'FLOOR(num)', info: 'Rounds down to nearest integer' },
  { label: 'ROUND', detail: 'ROUND(num, dec)', info: 'Rounds to decimal places' },
  { label: 'TRUNCATE', detail: 'TRUNCATE(num, dec)', info: 'Truncates to decimal places' },
  { label: 'MOD', detail: 'MOD(a, b)', info: 'Returns remainder of a/b' },
  { label: 'POWER', detail: 'POWER(base, exp)', info: 'Returns base raised to exp' },
  { label: 'SQRT', detail: 'SQRT(num)', info: 'Returns square root' },
  { label: 'RAND', detail: 'RAND()', info: 'Returns random float 0..1' },
  // Date & Time
  { label: 'NOW', detail: 'NOW()', info: 'Returns current date and time' },
  { label: 'CURDATE', detail: 'CURDATE()', info: 'Returns current date' },
  { label: 'CURTIME', detail: 'CURTIME()', info: 'Returns current time' },
  { label: 'DATE', detail: 'DATE(expr)', info: 'Extracts date part' },
  { label: 'TIME', detail: 'TIME(expr)', info: 'Extracts time part' },
  { label: 'YEAR', detail: 'YEAR(date)', info: 'Extracts year' },
  { label: 'MONTH', detail: 'MONTH(date)', info: 'Extracts month' },
  { label: 'DAY', detail: 'DAY(date)', info: 'Extracts day' },
  { label: 'HOUR', detail: 'HOUR(time)', info: 'Extracts hour' },
  { label: 'MINUTE', detail: 'MINUTE(time)', info: 'Extracts minute' },
  { label: 'SECOND', detail: 'SECOND(time)', info: 'Extracts second' },
  { label: 'DATE_ADD', detail: 'DATE_ADD(date, INTERVAL)', info: 'Adds interval to date' },
  { label: 'DATE_SUB', detail: 'DATE_SUB(date, INTERVAL)', info: 'Subtracts interval from date' },
  { label: 'DATEDIFF', detail: 'DATEDIFF(d1, d2)', info: 'Returns difference in days' },
  { label: 'TIMESTAMPDIFF', detail: 'TIMESTAMPDIFF(unit, d1, d2)', info: 'Returns difference in units' },
  { label: 'DATE_FORMAT', detail: 'DATE_FORMAT(date, fmt)', info: 'Formats date as string' },
  { label: 'STR_TO_DATE', detail: 'STR_TO_DATE(str, fmt)', info: 'Parses string to date' },
  // Conditional
  { label: 'IF', detail: 'IF(cond, then, else)', info: 'Conditional expression' },
  { label: 'IFNULL', detail: 'IFNULL(expr, alt)', info: 'Returns alt if expr is NULL' },
  { label: 'NULLIF', detail: 'NULLIF(a, b)', info: 'Returns NULL if a = b' },
  { label: 'COALESCE', detail: 'COALESCE(v1, v2, ...)', info: 'Returns first non-NULL value' },
  // Type casting
  { label: 'CAST', detail: 'CAST(expr AS type)', info: 'Converts to specified type' },
  { label: 'CONVERT', detail: 'CONVERT(expr, type)', info: 'Converts expression type' },
  // Numeric (extra)
  { label: 'SIGN', detail: 'SIGN(num)', info: 'Returns sign (-1, 0, or 1)' },
  { label: 'LOG', detail: 'LOG(num)', info: 'Returns natural logarithm' },
  { label: 'LOG2', detail: 'LOG2(num)', info: 'Returns base-2 logarithm' },
  { label: 'LOG10', detail: 'LOG10(num)', info: 'Returns base-10 logarithm' },
  { label: 'EXP', detail: 'EXP(num)', info: 'Returns e raised to num' },
  { label: 'PI', detail: 'PI()', info: 'Returns value of π' },
  { label: 'SIN', detail: 'SIN(num)', info: 'Returns sine' },
  { label: 'COS', detail: 'COS(num)', info: 'Returns cosine' },
  { label: 'TAN', detail: 'TAN(num)', info: 'Returns tangent' },
  { label: 'ASIN', detail: 'ASIN(num)', info: 'Returns arc sine' },
  { label: 'ACOS', detail: 'ACOS(num)', info: 'Returns arc cosine' },
  { label: 'ATAN', detail: 'ATAN(num)', info: 'Returns arc tangent' },
  { label: 'ATAN2', detail: 'ATAN2(y, x)', info: 'Returns arc tangent of y/x' },
  { label: 'COT', detail: 'COT(num)', info: 'Returns cotangent' },
  { label: 'DEGREES', detail: 'DEGREES(rad)', info: 'Converts radians to degrees' },
  { label: 'RADIANS', detail: 'RADIANS(deg)', info: 'Converts degrees to radians' },
  { label: 'GREATEST', detail: 'GREATEST(v1, v2, ...)', info: 'Returns largest argument' },
  { label: 'LEAST', detail: 'LEAST(v1, v2, ...)', info: 'Returns smallest argument' },
  { label: 'CRC32', detail: 'CRC32(str)', info: 'Returns cyclic redundancy check value' },
  { label: 'CONV', detail: 'CONV(num, from, to)', info: 'Converts between number bases' },
  // String (extra)
  { label: 'ASCII', detail: 'ASCII(str)', info: 'Returns ASCII code of first char' },
  { label: 'ORD', detail: 'ORD(str)', info: 'Returns code for leftmost char' },
  { label: 'CHAR', detail: 'CHAR(n, ...)', info: 'Returns char for each integer arg' },
  { label: 'BIN', detail: 'BIN(num)', info: 'Returns binary string of num' },
  { label: 'OCT', detail: 'OCT(num)', info: 'Returns octal string of num' },
  { label: 'HEX', detail: 'HEX(val)', info: 'Returns hexadecimal string' },
  { label: 'UNHEX', detail: 'UNHEX(str)', info: 'Converts hex string to bytes' },
  { label: 'INSERT', detail: 'INSERT(str, pos, len, new)', info: 'Inserts string at position' },
  { label: 'ELT', detail: 'ELT(n, s1, s2, ...)', info: 'Returns the n-th string' },
  { label: 'FIELD', detail: 'FIELD(str, s1, s2, ...)', info: 'Returns index of str in list' },
  { label: 'FIND_IN_SET', detail: 'FIND_IN_SET(str, strlist)', info: 'Returns position in comma-delimited list' },
  { label: 'MAKE_SET', detail: 'MAKE_SET(bits, s1, s2, ...)', info: 'Returns set of strings from bits' },
  { label: 'EXPORT_SET', detail: 'EXPORT_SET(bits, on, off)', info: 'Returns string for each bit' },
  { label: 'REPEAT', detail: 'REPEAT(str, count)', info: 'Repeats string count times' },
  { label: 'SPACE', detail: 'SPACE(n)', info: 'Returns string of n spaces' },
  { label: 'QUOTE', detail: 'QUOTE(str)', info: 'Escapes for use in SQL statement' },
  { label: 'SOUNDEX', detail: 'SOUNDEX(str)', info: 'Returns soundex string' },
  { label: 'STRCMP', detail: 'STRCMP(s1, s2)', info: 'Compares two strings' },
  { label: 'SUBSTRING_INDEX', detail: 'SUBSTRING_INDEX(str, delim, n)', info: 'Returns substring before n-th delimiter' },
  { label: 'WEIGHT_STRING', detail: 'WEIGHT_STRING(str)', info: 'Returns weight string for sorting' },
  { label: 'TO_BASE64', detail: 'TO_BASE64(str)', info: 'Converts to base-64 string' },
  { label: 'FROM_BASE64', detail: 'FROM_BASE64(str)', info: 'Decodes base-64 string' },
  // Regex
  { label: 'REGEXP_LIKE', detail: 'REGEXP_LIKE(str, pat)', info: 'Tests if string matches regex' },
  { label: 'REGEXP_REPLACE', detail: 'REGEXP_REPLACE(str, pat, rep)', info: 'Replaces regex matches' },
  { label: 'REGEXP_INSTR', detail: 'REGEXP_INSTR(str, pat)', info: 'Returns position of regex match' },
  { label: 'REGEXP_SUBSTR', detail: 'REGEXP_SUBSTR(str, pat)', info: 'Returns substring matching regex' },
  // Date & Time (extra)
  { label: 'ADDDATE', detail: 'ADDDATE(date, INTERVAL)', info: 'Adds interval to date' },
  { label: 'SUBDATE', detail: 'SUBDATE(date, INTERVAL)', info: 'Subtracts interval from date' },
  { label: 'ADDTIME', detail: 'ADDTIME(time, time2)', info: 'Adds time to time/datetime' },
  { label: 'SUBTIME', detail: 'SUBTIME(time, time2)', info: 'Subtracts time from time/datetime' },
  { label: 'TIMEDIFF', detail: 'TIMEDIFF(t1, t2)', info: 'Returns time difference' },
  { label: 'PERIOD_ADD', detail: 'PERIOD_ADD(period, n)', info: 'Adds n months to period' },
  { label: 'PERIOD_DIFF', detail: 'PERIOD_DIFF(p1, p2)', info: 'Returns months between periods' },
  { label: 'TIME_FORMAT', detail: 'TIME_FORMAT(time, fmt)', info: 'Formats time as string' },
  { label: 'TIME_TO_SEC', detail: 'TIME_TO_SEC(time)', info: 'Converts time to seconds' },
  { label: 'SEC_TO_TIME', detail: 'SEC_TO_TIME(sec)', info: 'Converts seconds to time' },
  { label: 'TO_DAYS', detail: 'TO_DAYS(date)', info: 'Returns day number from date' },
  { label: 'FROM_DAYS', detail: 'FROM_DAYS(n)', info: 'Converts day number to date' },
  { label: 'TO_SECONDS', detail: 'TO_SECONDS(date)', info: 'Returns seconds since year 0' },
  { label: 'UNIX_TIMESTAMP', detail: 'UNIX_TIMESTAMP(date?)', info: 'Returns Unix timestamp' },
  { label: 'FROM_UNIXTIME', detail: 'FROM_UNIXTIME(ts)', info: 'Formats Unix timestamp as date' },
  { label: 'MAKEDATE', detail: 'MAKEDATE(year, dayofyear)', info: 'Creates date from year and day' },
  { label: 'MAKETIME', detail: 'MAKETIME(h, m, s)', info: 'Creates time from h, m, s' },
  { label: 'DAYNAME', detail: 'DAYNAME(date)', info: 'Returns name of the weekday' },
  { label: 'DAYOFWEEK', detail: 'DAYOFWEEK(date)', info: 'Returns weekday index (1=Sun)' },
  { label: 'DAYOFYEAR', detail: 'DAYOFYEAR(date)', info: 'Returns day of year (1-366)' },
  { label: 'MONTHNAME', detail: 'MONTHNAME(date)', info: 'Returns name of the month' },
  { label: 'QUARTER', detail: 'QUARTER(date)', info: 'Returns quarter (1-4)' },
  { label: 'WEEK', detail: 'WEEK(date, mode?)', info: 'Returns week number' },
  { label: 'WEEKDAY', detail: 'WEEKDAY(date)', info: 'Returns weekday index (0=Mon)' },
  { label: 'WEEKOFYEAR', detail: 'WEEKOFYEAR(date)', info: 'Returns calendar week (1-53)' },
  { label: 'YEARWEEK', detail: 'YEARWEEK(date, mode?)', info: 'Returns year and week' },
  { label: 'EXTRACT', detail: 'EXTRACT(unit FROM date)', info: 'Extracts part of a date' },
  { label: 'LAST_DAY', detail: 'LAST_DAY(date)', info: 'Returns last day of the month' },
  { label: 'SYSDATE', detail: 'SYSDATE()', info: 'Returns current date and time' },
  { label: 'CURRENT_DATE', detail: 'CURRENT_DATE()', info: 'Returns current date' },
  { label: 'CURRENT_TIME', detail: 'CURRENT_TIME()', info: 'Returns current time' },
  { label: 'CURRENT_TIMESTAMP', detail: 'CURRENT_TIMESTAMP()', info: 'Returns current timestamp' },
  { label: 'LOCALTIME', detail: 'LOCALTIME()', info: 'Synonym for NOW()' },
  { label: 'LOCALTIMESTAMP', detail: 'LOCALTIMESTAMP()', info: 'Synonym for NOW()' },
  { label: 'UTC_DATE', detail: 'UTC_DATE()', info: 'Returns current UTC date' },
  { label: 'UTC_TIME', detail: 'UTC_TIME()', info: 'Returns current UTC time' },
  { label: 'UTC_TIMESTAMP', detail: 'UTC_TIMESTAMP()', info: 'Returns current UTC datetime' },
  { label: 'CONVERT_TZ', detail: 'CONVERT_TZ(dt, from, to)', info: 'Converts datetime between timezones' },
  { label: 'GET_FORMAT', detail: 'GET_FORMAT(type, locale)', info: 'Returns date format string' },
  // JSON functions
  { label: 'JSON_EXTRACT', detail: 'JSON_EXTRACT(doc, path)', info: 'Extracts value from JSON document' },
  { label: 'JSON_UNQUOTE', detail: 'JSON_UNQUOTE(val)', info: 'Unquotes a JSON value' },
  { label: 'JSON_SET', detail: 'JSON_SET(doc, path, val)', info: 'Sets value in JSON document' },
  { label: 'JSON_INSERT', detail: 'JSON_INSERT(doc, path, val)', info: 'Inserts into JSON document' },
  { label: 'JSON_REPLACE', detail: 'JSON_REPLACE(doc, path, val)', info: 'Replaces value in JSON document' },
  { label: 'JSON_REMOVE', detail: 'JSON_REMOVE(doc, path)', info: 'Removes element from JSON' },
  { label: 'JSON_CONTAINS', detail: 'JSON_CONTAINS(doc, val)', info: 'Tests if JSON contains value' },
  { label: 'JSON_CONTAINS_PATH', detail: 'JSON_CONTAINS_PATH(doc, one_or_all, path)', info: 'Tests if JSON contains path' },
  { label: 'JSON_TYPE', detail: 'JSON_TYPE(val)', info: 'Returns type of JSON value' },
  { label: 'JSON_VALID', detail: 'JSON_VALID(val)', info: 'Tests if value is valid JSON' },
  { label: 'JSON_KEYS', detail: 'JSON_KEYS(doc, path?)', info: 'Returns keys from JSON object' },
  { label: 'JSON_LENGTH', detail: 'JSON_LENGTH(doc, path?)', info: 'Returns number of elements' },
  { label: 'JSON_DEPTH', detail: 'JSON_DEPTH(doc)', info: 'Returns maximum depth of JSON' },
  { label: 'JSON_SEARCH', detail: 'JSON_SEARCH(doc, one_or_all, str)', info: 'Searches for string in JSON' },
  { label: 'JSON_OBJECT', detail: 'JSON_OBJECT(k1, v1, ...)', info: 'Creates JSON object' },
  { label: 'JSON_ARRAY', detail: 'JSON_ARRAY(v1, v2, ...)', info: 'Creates JSON array' },
  { label: 'JSON_MERGE_PRESERVE', detail: 'JSON_MERGE_PRESERVE(d1, d2)', info: 'Merges JSON documents (preserving)' },
  { label: 'JSON_MERGE_PATCH', detail: 'JSON_MERGE_PATCH(d1, d2)', info: 'Merges JSON documents (RFC 7396)' },
  { label: 'JSON_PRETTY', detail: 'JSON_PRETTY(doc)', info: 'Pretty-prints JSON' },
  { label: 'JSON_QUOTE', detail: 'JSON_QUOTE(str)', info: 'Quotes a string as JSON value' },
  { label: 'JSON_STORAGE_SIZE', detail: 'JSON_STORAGE_SIZE(doc)', info: 'Returns bytes used to store JSON' },
  { label: 'JSON_TABLE', detail: 'JSON_TABLE(doc, path COLUMNS(...))', info: 'Extracts JSON data as relational table' },
  { label: 'JSON_ARRAYAGG', detail: 'JSON_ARRAYAGG(col)', info: 'Aggregates values into JSON array' },
  { label: 'JSON_OBJECTAGG', detail: 'JSON_OBJECTAGG(key, val)', info: 'Aggregates key-value pairs into JSON object' },
  // Encryption & hashing
  { label: 'MD5', detail: 'MD5(str)', info: 'Returns MD5 hash (128-bit)' },
  { label: 'SHA1', detail: 'SHA1(str)', info: 'Returns SHA-1 hash (160-bit)' },
  { label: 'SHA2', detail: 'SHA2(str, bits)', info: 'Returns SHA-2 hash (224/256/384/512)' },
  { label: 'AES_ENCRYPT', detail: 'AES_ENCRYPT(str, key)', info: 'Encrypts with AES' },
  { label: 'AES_DECRYPT', detail: 'AES_DECRYPT(crypt, key)', info: 'Decrypts AES-encrypted data' },
  { label: 'RANDOM_BYTES', detail: 'RANDOM_BYTES(len)', info: 'Generates random byte string' },
  // Aggregate (extra)
  { label: 'BIT_AND', detail: 'BIT_AND(expr)', info: 'Returns bitwise AND of all values' },
  { label: 'BIT_OR', detail: 'BIT_OR(expr)', info: 'Returns bitwise OR of all values' },
  { label: 'BIT_XOR', detail: 'BIT_XOR(expr)', info: 'Returns bitwise XOR of all values' },
  { label: 'STD', detail: 'STD(expr)', info: 'Returns population standard deviation' },
  { label: 'STDDEV', detail: 'STDDEV(expr)', info: 'Synonym for STD()' },
  { label: 'STDDEV_POP', detail: 'STDDEV_POP(expr)', info: 'Population standard deviation' },
  { label: 'STDDEV_SAMP', detail: 'STDDEV_SAMP(expr)', info: 'Sample standard deviation' },
  { label: 'VARIANCE', detail: 'VARIANCE(expr)', info: 'Population variance' },
  { label: 'VAR_POP', detail: 'VAR_POP(expr)', info: 'Population variance (synonym)' },
  { label: 'VAR_SAMP', detail: 'VAR_SAMP(expr)', info: 'Sample variance' },
  { label: 'ANY_VALUE', detail: 'ANY_VALUE(col)', info: 'Suppresses ONLY_FULL_GROUP_BY rejection' },
  { label: 'BIT_COUNT', detail: 'BIT_COUNT(num)', info: 'Returns number of set bits' },
  // Window functions
  { label: 'ROW_NUMBER', detail: 'ROW_NUMBER() OVER(...)', info: 'Sequential row number' },
  { label: 'RANK', detail: 'RANK() OVER(...)', info: 'Rank with gaps' },
  { label: 'DENSE_RANK', detail: 'DENSE_RANK() OVER(...)', info: 'Rank without gaps' },
  { label: 'NTILE', detail: 'NTILE(n) OVER(...)', info: 'Divides rows into n buckets' },
  { label: 'LAG', detail: 'LAG(col, offset) OVER(...)', info: 'Value from previous row' },
  { label: 'LEAD', detail: 'LEAD(col, offset) OVER(...)', info: 'Value from next row' },
  { label: 'FIRST_VALUE', detail: 'FIRST_VALUE(col) OVER(...)', info: 'First value in window' },
  { label: 'LAST_VALUE', detail: 'LAST_VALUE(col) OVER(...)', info: 'Last value in window' },
  { label: 'NTH_VALUE', detail: 'NTH_VALUE(col, n) OVER(...)', info: 'Value of n-th row in window' },
  { label: 'PERCENT_RANK', detail: 'PERCENT_RANK() OVER(...)', info: 'Relative rank (0..1)' },
  { label: 'CUME_DIST', detail: 'CUME_DIST() OVER(...)', info: 'Cumulative distribution (0..1)' },
  { label: 'OVER', detail: 'OVER (PARTITION BY ... ORDER BY ...)', info: 'Window specification' },
  // Info functions
  { label: 'DATABASE', detail: 'DATABASE()', info: 'Returns current database name' },
  { label: 'SCHEMA', detail: 'SCHEMA()', info: 'Synonym for DATABASE()' },
  { label: 'USER', detail: 'USER()', info: 'Returns current user and host' },
  { label: 'CURRENT_USER', detail: 'CURRENT_USER()', info: 'Returns authenticated user' },
  { label: 'SESSION_USER', detail: 'SESSION_USER()', info: 'Synonym for USER()' },
  { label: 'SYSTEM_USER', detail: 'SYSTEM_USER()', info: 'Synonym for USER()' },
  { label: 'VERSION', detail: 'VERSION()', info: 'Returns MySQL server version' },
  { label: 'CONNECTION_ID', detail: 'CONNECTION_ID()', info: 'Returns connection thread ID' },
  { label: 'LAST_INSERT_ID', detail: 'LAST_INSERT_ID()', info: 'Returns last AUTO_INCREMENT ID' },
  { label: 'ROW_COUNT', detail: 'ROW_COUNT()', info: 'Returns rows affected by last statement' },
  { label: 'FOUND_ROWS', detail: 'FOUND_ROWS()', info: 'Returns rows from last SELECT with SQL_CALC_FOUND_ROWS' },
  { label: 'CHARSET', detail: 'CHARSET(str)', info: 'Returns character set of string' },
  { label: 'COLLATION', detail: 'COLLATION(str)', info: 'Returns collation of string' },
  // Misc functions
  { label: 'SLEEP', detail: 'SLEEP(sec)', info: 'Pauses for specified seconds' },
  { label: 'BENCHMARK', detail: 'BENCHMARK(count, expr)', info: 'Repeatedly executes expression' },
  { label: 'UUID', detail: 'UUID()', info: 'Returns a Universal Unique Identifier' },
  { label: 'UUID_SHORT', detail: 'UUID_SHORT()', info: 'Returns short UUID integer' },
  { label: 'INET_ATON', detail: 'INET_ATON(addr)', info: 'Converts IPv4 address to integer' },
  { label: 'INET_NTOA', detail: 'INET_NTOA(num)', info: 'Converts integer to IPv4 address' },
  { label: 'INET6_ATON', detail: 'INET6_ATON(addr)', info: 'Converts IPv6 address to binary' },
  { label: 'INET6_NTOA', detail: 'INET6_NTOA(bin)', info: 'Converts binary to IPv6 address' },
  { label: 'IS_IPV4', detail: 'IS_IPV4(addr)', info: 'Tests if argument is IPv4' },
  { label: 'IS_IPV6', detail: 'IS_IPV6(addr)', info: 'Tests if argument is IPv6' },
  { label: 'BIN_TO_UUID', detail: 'BIN_TO_UUID(bin)', info: 'Converts binary UUID to string' },
  { label: 'UUID_TO_BIN', detail: 'UUID_TO_BIN(uuid)', info: 'Converts string UUID to binary' },
  { label: 'DEFAULT', detail: 'DEFAULT(col)', info: 'Returns default value of column' },
  { label: 'VALUES', detail: 'VALUES(col)', info: 'Value of col in INSERT ON DUPLICATE KEY' },
  { label: 'GROUPING', detail: 'GROUPING(col)', info: 'Distinguishes super-aggregate rows' },
];

// ── Custom completion source ──────────────────────────────────────
function buildCompletionSource(tables: TableSchema[]) {
  return (ctx: CompletionContext) => {
    // Match word characters, dots (for table.col), and underscores
    const word = ctx.matchBefore(/[\w.]+/);
    if (!word && !ctx.explicit) return null;

    const from = word?.from ?? ctx.pos;
    const typed = (word?.text ?? '').toLowerCase();

    // Detect if user typed "table." for column completions
    const dotIndex = typed.lastIndexOf('.');
    if (dotIndex >= 0) {
      const tableName = typed.slice(0, dotIndex);
      const colPrefix = typed.slice(dotIndex + 1);
      const table = tables.find(
        (t) => t.name.toLowerCase() === tableName,
      );
      if (table) {
        const options: Completion[] = table.columns
          .filter((c) => c.name.toLowerCase().startsWith(colPrefix))
          .map((c) => ({
            label: `${table.name}.${c.name}`,
            displayLabel: c.name,
            detail: c.type.toUpperCase(),
            type: c.primaryKey ? 'constant' : c.foreignKey ? 'property' : 'variable',
            info: [
              c.primaryKey ? '🔑 Primary Key' : '',
              c.foreignKey ? `🔗 FK → ${c.foreignKey.table}.${c.foreignKey.column}` : '',
              c.nullable ? 'Nullable' : 'NOT NULL',
              c.defaultValue ? `Default: ${c.defaultValue}` : '',
            ].filter(Boolean).join(' · '),
            boost: c.primaryKey ? 3 : c.foreignKey ? 2 : 1,
          }));
        return { from, options };
      }
    }

    const options: Completion[] = [];

    // Get the full text to understand context
    const docText = ctx.state.doc.toString();
    const textBefore = docText.slice(0, ctx.pos).toUpperCase();
    const currentStatement = textBefore.split(';').pop()?.split('\n').pop()?.trim() ?? '';
    const statementTokens = currentStatement.split(/\s+/).filter(Boolean);
    const contextTokens = statementTokens.length > 1 ? statementTokens.slice(0, -1) : [];

    const matchesCommandByContext = (candidate: string): boolean => {
      if (contextTokens.length === 0 || typed.length === 0) return false;

      const candidateTokens = candidate.toUpperCase().split(/\s+/).filter(Boolean);
      if (candidateTokens.length <= contextTokens.length) return false;

      for (let i = 0; i < contextTokens.length; i += 1) {
        if (candidateTokens[i] !== contextTokens[i]) return false;
      }

      return candidateTokens[contextTokens.length].startsWith(typed.toUpperCase());
    };

    const buildContextualTail = (candidate: string): string | null => {
      if (contextTokens.length === 0) return null;
      const candidateTokens = candidate.split(/\s+/).filter(Boolean);
      if (candidateTokens.length <= contextTokens.length) return null;

      for (let i = 0; i < contextTokens.length; i += 1) {
        if (candidateTokens[i]?.toUpperCase() !== contextTokens[i]) return null;
      }

      return candidateTokens.slice(contextTokens.length).join(' ');
    };

    // Determine context: after FROM/JOIN → boost tables; after SELECT/WHERE/ON → boost columns
    const isAfterFrom = /(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+\w*$/i.test(textBefore);
    const isAfterSelect = /(?:SELECT|WHERE|ON|BY|HAVING|SET|AND|OR)\s+\w*$/i.test(textBefore);
    const isShowContext = /\bSHOW\s+\w*$/i.test(textBefore);
    const isCreateContext = /\bCREATE\s+\w*$/i.test(textBefore);
    const isGrantContext = /\bGRANT\s+\w*$/i.test(textBefore);
    const isPlSqlContext = /\b(DECLARE|BEGIN|EXCEPTION|WHEN|DBMS_OUTPUT)\b[\s\S]*$/i.test(textBefore);

    // SQL Keywords
    for (const kw of SQL_KEYWORDS) {
      const kwLower = kw.toLowerCase().replace(/\s+/g, '');
      const typedNormalized = typed.replace(/\s+/g, '');
      const kwUpper = kw.toUpperCase();

      const baseMatch = kwLower.startsWith(typedNormalized) || kw.toLowerCase().startsWith(typed);
      const contextualTokenMatch = matchesCommandByContext(kw);

      if (baseMatch || contextualTokenMatch) {
        const isShowKeyword = kwUpper.startsWith('SHOW ');
        const isCreateKeyword = kwUpper.startsWith('CREATE ');
        const isGrantKeyword = kwUpper.startsWith('GRANT ') || kwUpper.startsWith('REVOKE ');
        const isPlSqlKeyword =
          kwUpper.includes('EXCEPTION') ||
          kwUpper.includes('NO_DATA_FOUND') ||
          kwUpper.includes('DBMS_OUTPUT') ||
          kwUpper.includes('RAISE_APPLICATION_ERROR');

        let boost = isAfterFrom || isAfterSelect ? -1 : 2;
        if (contextTokens.length > 0) {
          // Prefer command-continuation completions (e.g., SHOW TABLES) over unrelated bare keywords.
          boost += contextualTokenMatch ? 20 : -8;
        }
        if (isShowContext && isShowKeyword) boost += 4;
        if (isCreateContext && isCreateKeyword) boost += 4;
        if (isGrantContext && isGrantKeyword) boost += 4;
        if (isPlSqlContext && isPlSqlKeyword) boost += 4;

        options.push({
          label: kw,
          type: 'keyword',
          apply: contextualTokenMatch
            ? (view, _completion, insertFrom, insertTo) => {
              const tail = buildContextualTail(kw) ?? kw;
              view.dispatch({
                changes: { from: insertFrom, to: insertTo, insert: tail },
                selection: { anchor: insertFrom + tail.length },
              });
            }
            : undefined,
          boost,
        });
      }
    }

    // SQL Functions
    for (const fn of SQL_FUNCTIONS) {
      if (fn.label.toLowerCase().startsWith(typed)) {
        options.push({
          label: fn.label,
          displayLabel: fn.label,
          detail: fn.detail,
          type: 'function',
          info: fn.info,
          apply: (view, _completion, from, to) => {
            const insert = `${fn.label}()`;
            const cursorPos = from + fn.label.length + 1;

            view.dispatch({
              changes: { from, to, insert },
              selection: { anchor: cursorPos },
            });
          },
          boost: isAfterSelect ? 2 : 0,
        });
      }
    }

    // Table names
    for (const t of tables) {
      if (t.name.toLowerCase().startsWith(typed)) {
        const colNames = t.columns.map((c) => c.name).join(', ');
        options.push({
          label: t.name,
          detail: `${t.columns.length} cols`,
          type: 'class',
          info: `Columns: ${colNames}`,
          boost: isAfterFrom ? 10 : 1,
        });
      }
    }

    // Column names (unqualified)
    for (const t of tables) {
      for (const c of t.columns) {
        if (c.name.toLowerCase().startsWith(typed)) {
          options.push({
            label: c.name,
            detail: `${t.name} · ${c.type.toUpperCase()}`,
            type: c.primaryKey ? 'constant' : c.foreignKey ? 'property' : 'variable',
            info: [
              c.primaryKey ? '🔑 Primary Key' : '',
              c.foreignKey ? `🔗 FK → ${c.foreignKey.table}.${c.foreignKey.column}` : '',
            ].filter(Boolean).join(' · ') || undefined,
            boost: isAfterSelect ? 5 : 0,
          });
        }
      }
    }

    // Common snippets
    const firstTable = tables[0]?.name ?? 'your_table';
    const snippets: { label: string; template: string; detail: string; info: string; category?: 'show' | 'create' | 'grant' | 'plsql' }[] = [
      { label: 'SELECT *', template: 'SELECT * FROM ', detail: 'snippet', info: 'Select all columns from a table' },
      { label: 'SELECT COUNT', template: 'SELECT COUNT(*) FROM ', detail: 'snippet', info: 'Count all rows in a table' },
      { label: 'INSERT INTO', template: 'INSERT INTO  () VALUES ();', detail: 'snippet', info: 'Insert a row into a table' },
      { label: 'CREATE TABLE', template: 'CREATE TABLE  (\n  id INTEGER PRIMARY KEY,\n  \n);', detail: 'snippet', info: 'Create a new table' },
      { label: 'ALTER TABLE', template: 'ALTER TABLE  ADD COLUMN  TEXT;', detail: 'snippet', info: 'Add column to existing table' },
      { label: 'UPDATE SET', template: 'UPDATE  SET  =  WHERE ;', detail: 'snippet', info: 'Update rows in a table' },
      { label: 'DELETE FROM', template: 'DELETE FROM  WHERE ;', detail: 'snippet', info: 'Delete rows from a table' },
      { label: 'GROUP BY', template: 'SELECT , COUNT(*)\nFROM \nGROUP BY \nHAVING COUNT(*) > 1;', detail: 'snippet', info: 'Group with aggregate and filter' },
      {
        label: 'SHOW TRIGGERS',
        template: 'SHOW TRIGGERS;',
        detail: 'snippet',
        info: 'List all triggers in current database',
        category: 'show',
      },
      {
        label: 'SHOW CREATE TRIGGER',
        template: 'SHOW CREATE TRIGGER trigger_name;',
        detail: 'snippet',
        info: 'Show exact SQL definition for a trigger',
        category: 'show',
      },
      {
        label: 'CREATE TRIGGER (audit)',
        template:
          `CREATE TRIGGER trg_${firstTable}_ai\nAFTER INSERT ON ${firstTable}\nBEGIN\n  INSERT INTO audit_log(message) VALUES ('inserted:' || NEW.id);\nEND;`,
        detail: 'snippet',
        info: 'Create AFTER INSERT trigger template',
        category: 'create',
      },
      {
        label: 'CREATE PROCEDURE',
        template:
          `CREATE PROCEDURE proc_demo(IN p_id INT)\nBEGIN\n  UPDATE ${firstTable} SET id = id WHERE id = p_id;\nEND;`,
        detail: 'snippet',
        info: 'Create stored procedure template (IN params)',
        category: 'create',
      },
      {
        label: 'CALL PROCEDURE',
        template: 'CALL proc_demo(1);',
        detail: 'snippet',
        info: 'Execute a stored procedure',
        category: 'create',
      },
      {
        label: 'SHOW PROCEDURE STATUS',
        template: 'SHOW PROCEDURE STATUS;',
        detail: 'snippet',
        info: 'List available procedures',
        category: 'show',
      },
      {
        label: 'SHOW CREATE PROCEDURE',
        template: 'SHOW CREATE PROCEDURE proc_demo;',
        detail: 'snippet',
        info: 'Show exact SQL definition for a procedure',
        category: 'show',
      },
      {
        label: 'CREATE USER + GRANT',
        template:
          "CREATE USER IF NOT EXISTS 'analyst'@'localhost' IDENTIFIED BY 'pass';\nGRANT SELECT, EXECUTE ON main.* TO 'analyst'@'localhost';\nFLUSH PRIVILEGES;",
        detail: 'snippet',
        info: 'Create a user and grant basic read + execute permissions',
        category: 'grant',
      },
      {
        label: 'SHOW USERS',
        template: 'SHOW USERS;',
        detail: 'snippet',
        info: 'List all users in the virtual auth model',
        category: 'show',
      },
      {
        label: 'PL/SQL EXCEPTION block',
        template:
          `BEGIN\n  RAISE_APPLICATION_ERROR(-20001, 'boom');\nEXCEPTION\n  WHEN OTHERS THEN\n    DBMS_OUTPUT.PUT_LINE('handled');\nEND;`,
        detail: 'snippet',
        info: 'Anonymous block with EXCEPTION handling',
        category: 'plsql',
      },
      {
        label: 'PL/SQL CURSOR block',
        template:
          `DECLARE\n  CURSOR c_data IS SELECT id FROM ${firstTable};\n  v_id NUMBER;\nBEGIN\n  OPEN c_data;\n  FETCH c_data INTO v_id;\n  DBMS_OUTPUT.PUT_LINE(v_id);\n  CLOSE c_data;\nEND;`,
        detail: 'snippet',
        info: 'Anonymous block with cursor lifecycle',
        category: 'plsql',
      },
    ];
    for (const s of snippets) {
      const snippetBaseMatch = s.label.toLowerCase().replace(/\s+/g, '').startsWith(typed.replace(/\s+/g, ''));
      const snippetContextMatch = matchesCommandByContext(s.label);

      if (snippetBaseMatch || snippetContextMatch) {
        let snippetBoost = typed.length >= 2 ? 3 : -2;
        if (contextTokens.length > 0) {
          snippetBoost += snippetContextMatch ? 20 : -8;
        }
        if (isShowContext && s.category === 'show') snippetBoost += 5;
        if (isCreateContext && s.category === 'create') snippetBoost += 5;
        if (isGrantContext && s.category === 'grant') snippetBoost += 5;
        if (isPlSqlContext && s.category === 'plsql') snippetBoost += 5;

        options.push({
          label: s.label,
          detail: s.detail,
          type: 'text',
          info: s.info,
          apply:
            snippetContextMatch
              ? (view, _completion, insertFrom, insertTo) => {
                const tail = buildContextualTail(s.template) ?? s.template;
                view.dispatch({
                  changes: { from: insertFrom, to: insertTo, insert: tail },
                  selection: { anchor: insertFrom + tail.length },
                });
              }
              : s.template,
          boost: snippetBoost,
        });
      }
    }

    if (options.length === 0) return null;
    return { from, options };
  };
}

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  tables?: TableSchema[];
  historyCommands?: string[];
  executionFeedback?: 'idle' | 'success' | 'error';
  hasOutput?: boolean;
  className?: string;
  focusRequestKey?: number;
}

export function SqlEditor({
  value,
  onChange,
  onExecute,
  tables = [],
  historyCommands = [],
  executionFeedback = 'idle',
  hasOutput = false,
  className,
  focusRequestKey,
}: SqlEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onExecuteRef = useRef(onExecute);
  const isApplyingExternalChangeRef = useRef(false);
  const historyCommandsRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number | null>(null);
  const historyDraftRef = useRef('');
  const [isMac] = useState(() =>
    typeof navigator !== 'undefined' ? /Mac|iPhone|iPad|iPod/.test(navigator.platform) : false,
  );

  useEffect(() => {
    onExecuteRef.current = onExecute;
  }, [onExecute]);

  useEffect(() => {
    const unique = Array.from(
      new Set(historyCommands.map((command) => command.trim()).filter(Boolean)),
    );
    historyCommandsRef.current = unique;
  }, [historyCommands]);

  useEffect(() => {
    if (!editorRef.current) return;

    const schemaObj: Record<string, string[]> = {};
    tables.forEach((t) => {
      schemaObj[t.name] = t.columns.map((c) => c.name);
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        sql({ dialect: MySQL, schema: schemaObj, upperCaseKeywords: true }),
        closeBrackets(),
        autocompletion({
          override: [buildCompletionSource(tables)],
          activateOnTyping: true,
          maxRenderedOptions: 30,
          icons: true,
        }),
        oneDark,
        keymap.of([
          {
            key: 'ArrowUp',
            run: (view) => {
              if (completionStatus(view.state) === 'active') return false;

              const selection = view.state.selection.main;
              if (!selection.empty) return false;

              const line = view.state.doc.lineAt(selection.head);
              if (line.number !== 1) return false;

              const history = historyCommandsRef.current;
              if (history.length === 0) return false;

              const nextIndex =
                historyIndexRef.current === null
                  ? 0
                  : Math.min(historyIndexRef.current + 1, history.length - 1);

              if (historyIndexRef.current === null) {
                historyDraftRef.current = view.state.doc.toString();
              }

              const nextCommand = history[nextIndex] ?? '';
              historyIndexRef.current = nextIndex;
              view.dispatch({
                changes: {
                  from: 0,
                  to: view.state.doc.length,
                  insert: nextCommand,
                },
                selection: { anchor: nextCommand.length },
              });
              return true;
            },
          },
          {
            key: 'ArrowDown',
            run: (view) => {
              if (completionStatus(view.state) === 'active') return false;

              const selection = view.state.selection.main;
              if (!selection.empty) return false;

              const line = view.state.doc.lineAt(selection.head);
              if (line.number !== view.state.doc.lines) return false;

              if (historyIndexRef.current === null) return false;

              const nextIndex = historyIndexRef.current - 1;
              if (nextIndex < 0) {
                historyIndexRef.current = null;
                const draft = historyDraftRef.current;
                view.dispatch({
                  changes: { from: 0, to: view.state.doc.length, insert: draft },
                  selection: { anchor: draft.length },
                });
                return true;
              }

              const history = historyCommandsRef.current;
              const nextCommand = history[nextIndex] ?? '';
              historyIndexRef.current = nextIndex;
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: nextCommand },
                selection: { anchor: nextCommand.length },
              });
              return true;
            },
          },
          {
            key: 'Mod-Enter',
            run: () => {
              onExecuteRef.current();
              return true;
            },
          },
          ...closeBracketsKeymap,
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isApplyingExternalChangeRef.current) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': {
            fontSize: '13px',
            background: 'transparent',
            height: '100%',
          },
          '.cm-content': {
            padding: '14px 0',
            fontFamily: 'var(--font-mono), monospace',
          },
          '.cm-editor': { height: '100%' },
          '.cm-gutters': { background: 'transparent', border: 'none', color: '#3f3f46' },
          '.cm-scroller': {
            borderRadius: '12px',
            overflow: 'auto',
            maxHeight: '100%',
          },
          '.cm-activeLine': { backgroundColor: 'rgba(113,113,122,0.08)' },
          '.cm-activeLineGutter': { backgroundColor: 'transparent' },
          '.cm-tooltip-autocomplete': {
            border: '1px solid rgba(63,63,70,0.6) !important',
            borderRadius: '10px !important',
            background: 'rgba(24,24,27,0.98) !important',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4) !important',
            overflow: 'hidden',
          },
          '.cm-tooltip-autocomplete ul': {
            fontFamily: 'var(--font-mono), monospace',
            fontSize: '12px',
          },
          '.cm-tooltip-autocomplete li': {
            padding: '4px 10px !important',
            borderRadius: '0 !important',
          },
          '.cm-tooltip-autocomplete li[aria-selected]': {
            background: 'rgba(139,92,246,0.15) !important',
            color: '#e4e4e7 !important',
          },
          '.cm-completionLabel': {
            color: '#d4d4d8',
          },
          '.cm-completionDetail': {
            color: '#71717a',
            fontStyle: 'normal !important',
            marginLeft: '8px',
            fontSize: '11px',
          },
          '.cm-completionMatchedText': {
            color: '#a78bfa !important',
            textDecoration: 'none !important',
            fontWeight: '600',
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // Only recreate editor on mount/tables change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.map((t) => t.name).join(',')]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (currentValue === value) return;

    isApplyingExternalChangeRef.current = true;
    view.dispatch({
      changes: { from: 0, to: currentValue.length, insert: value },
      selection: EditorSelection.create([EditorSelection.cursor(value.length)], 0),
    });
    isApplyingExternalChangeRef.current = false;
  }, [value]);

  useEffect(() => {
    if (focusRequestKey === undefined) return;
    const view = viewRef.current;
    if (!view) return;

    requestAnimationFrame(() => {
      const latestView = viewRef.current;
      if (!latestView) return;
      const cursorPos = latestView.state.doc.length;
      latestView.focus();
      latestView.dispatch({
        selection: EditorSelection.create([EditorSelection.cursor(cursorPos)], 0),
        scrollIntoView: true,
      });
    });
  }, [focusRequestKey]);

  return (
    <div className={`min-h-0 ${className ?? ''}`}>
      <div
        className={`overflow-hidden rounded-xl border border-zinc-700/50 transition-[height] duration-200 ${hasOutput ? 'h-[clamp(220px,36vh,420px)]' : 'h-[clamp(300px,58vh,680px)]'
          } ${executionFeedback === 'success'
            ? 'execute-feedback-success'
            : executionFeedback === 'error'
              ? 'execute-feedback-error'
              : ''
          }`}
        style={{ background: 'linear-gradient(180deg, rgba(24,24,27,0.95) 0%, rgba(18,18,21,0.98) 100%)' }}
        ref={editorRef}
      />
      <p className="mt-1.5 text-right text-[11px] text-zinc-600">
        Press <kbd className="rounded-md border border-zinc-700/50 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{isMac ? '⌘' : 'Ctrl'} Enter</kbd> to execute
      </p>
    </div>
  );
}
